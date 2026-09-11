import { logger } from "./logger";

export type Direction =
  | "strong-up"
  | "up"
  | "neutral"
  | "down"
  | "strong-down";

export type NewsImpact = {
  asset: string;
  direction: Direction;
};

export type NewsArticle = {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  imageUrl: string | null;
  affectedAssets: string[];
  explanation: string;
  impacts: NewsImpact[];
};

export type MarketAsset = {
  id: string;
  name: string;
  symbol: string;
  value: number;
  formattedValue: string;
  change: number;
  changePercent: number;
  lastUpdated: string;
  source: string;
  status: "up" | "down" | "neutral";
};

type AlphaVantageQuote = {
  "01. symbol"?: string;
  "05. price"?: string;
  "09. change"?: string;
  "10. change percent"?: string;
};

type NewsApiArticle = {
  title?: string;
  url?: string;
  publishedAt?: string;
  urlToImage?: string | null;
  source?: { name?: string };
};

const NEWS_QUERY =
  '(Iran OR "Strait of Hormuz" OR oil OR war OR sanctions OR inflation OR "Federal Reserve" OR markets)';
const ALPHA_REQUEST_GAP_MS = 1_100;
const QUOTE_CACHE_TTL_MS = 5 * 60 * 1_000;
const NEWS_CACHE_TTL_MS = 2 * 60 * 1_000;

let lastAlphaRequestAt = 0;
let alphaRequestQueue = Promise.resolve();
const quoteCache = new Map<string, { expiresAt: number; value: AlphaVantageQuote }>();
let newsCache: { expiresAt: number; value: Awaited<ReturnType<typeof getNews>> } | null = null;

function requireApiKey(name: "NEWS_API_KEY" | "ALPHA_VANTAGE_API_KEY") {
  const key = process.env[name];
  if (!key) {
    throw new Error(`${name} is not configured`);
  }
  return key;
}

async function fetchJson<T>(url: string, service: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${service} returned HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function fetchAlphaVantage<T>(url: string): Promise<T> {
  const request = alphaRequestQueue.then(async () => {
    const waitMs = Math.max(
      0,
      ALPHA_REQUEST_GAP_MS - (Date.now() - lastAlphaRequestAt),
    );
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    lastAlphaRequestAt = Date.now();
    return fetchJson<T>(url, "Alpha Vantage");
  });
  alphaRequestQueue = request.then(
    () => undefined,
    () => undefined,
  );
  return request;
}

function formatValue(value: number, id: string) {
  if (id === "sp500") {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseQuote(
  quote: AlphaVantageQuote,
  id: string,
  name: string,
  symbol: string,
  source: string,
): MarketAsset {
  const value = Number(quote["05. price"]);
  const change = Number(quote["09. change"]);
  const changePercent = Number.parseFloat(
    quote["10. change percent"]?.replace("%", "") ?? "NaN",
  );

  if (
    !Number.isFinite(value) ||
    !Number.isFinite(change) ||
    !Number.isFinite(changePercent)
  ) {
    throw new Error(`Alpha Vantage returned an incomplete quote for ${symbol}`);
  }

  return {
    id,
    name,
    symbol,
    value,
    formattedValue: formatValue(value, id),
    change,
    changePercent,
    lastUpdated: new Date().toISOString(),
    source,
    status: changePercent > 0.05 ? "up" : changePercent < -0.05 ? "down" : "neutral",
  };
}

function analyzeArticle(title: string): {
  affectedAssets: string[];
  impacts: NewsImpact[];
  explanation: string;
} {
  const normalized = title.toLowerCase();
  const impacts = new Map<string, Direction>();
  const affectedAssets = new Set<string>();

  if (
    /strait of hormuz|oil supply|tanker attack|shipping disruption|supply disruption/.test(
      normalized,
    )
  ) {
    impacts.set("Oil", "strong-up");
    impacts.set("Inflation", "up");
    impacts.set("Stocks", "down");
    impacts.set("Gold", "up");
    affectedAssets.add("Oil");
    affectedAssets.add("Inflation");
    affectedAssets.add("Stocks");
    affectedAssets.add("Gold");
  }

  if (/rate hike|higher interest rates|interest rate/.test(normalized)) {
    impacts.set("Gold", "down");
    impacts.set("Growth stocks", "down");
    impacts.set("USD", "up");
    affectedAssets.add("Gold");
    affectedAssets.add("Growth stocks");
    affectedAssets.add("USD");
  }

  if (/ceasefire|peace deal|de-escalation/.test(normalized)) {
    impacts.set("Oil", "down");
    impacts.set("Stocks", "up");
    impacts.set("Gold", "down");
    affectedAssets.add("Oil");
    affectedAssets.add("Stocks");
    affectedAssets.add("Gold");
  }

  if (/sanction|war|conflict|iran/.test(normalized)) {
    if (!impacts.has("Gold")) impacts.set("Gold", "up");
    if (!impacts.has("Oil")) impacts.set("Oil", "up");
    affectedAssets.add("Gold");
    affectedAssets.add("Oil");
  }

  if (/inflation|consumer prices|cpi/.test(normalized)) {
    if (!impacts.has("Inflation")) impacts.set("Inflation", "up");
    affectedAssets.add("Inflation");
  }

  if (affectedAssets.size === 0) {
    affectedAssets.add("Markets");
  }

  const impactSummary = Array.from(impacts.entries())
    .slice(0, 3)
    .map(([asset, direction]) => `${asset} is ${direction.replace("-", " ")}`)
    .join(", ");

  return {
    affectedAssets: Array.from(affectedAssets),
    impacts: Array.from(impacts.entries()).map(([asset, direction]) => ({
      asset,
      direction,
    })),
    explanation: impactSummary
      ? `This headline may matter because ${impactSummary}. These are scenario-based signals, not certain predictions.`
      : "The market connection is still developing. Watch follow-on headlines and price action rather than treating this as a forecast.",
  };
}

export async function getNews(limit = 8): Promise<{
  articles: NewsArticle[];
  updatedAt: string;
  query: string;
}> {
  if (newsCache && newsCache.expiresAt > Date.now() && newsCache.value.articles.length >= limit) {
    return {
      ...newsCache.value,
      articles: newsCache.value.articles.slice(0, limit),
    };
  }

  const apiKey = requireApiKey("NEWS_API_KEY");
  const params = new URLSearchParams({
    q: NEWS_QUERY,
    language: "en",
    sortBy: "publishedAt",
    pageSize: String(limit),
    apiKey,
  });
  const payload = await fetchJson<{
    status?: string;
    code?: string;
    message?: string;
    articles?: NewsApiArticle[];
  }>(`https://newsapi.org/v2/everything?${params.toString()}`, "NewsAPI");

  if (payload.status !== "ok" || !Array.isArray(payload.articles)) {
    throw new Error(payload.message ?? "NewsAPI returned no articles");
  }

  const articles = payload.articles
    .filter((article) => article.title && article.url && article.publishedAt)
    .map((article, index) => {
      const headline = article.title!.replace(/\s+-\s+[^-]+$/, "").trim();
      const analysis = analyzeArticle(headline);
      return {
        id: `${article.publishedAt}-${index}`,
        headline,
        source: article.source?.name ?? "NewsAPI",
        url: article.url!,
        publishedAt: article.publishedAt!,
        imageUrl: article.urlToImage ?? null,
        ...analysis,
      };
    });

  const value = {
    articles,
    updatedAt: new Date().toISOString(),
    query: "Iran, Hormuz, oil, war, sanctions, inflation, Fed, markets",
  };
  newsCache = { value, expiresAt: Date.now() + NEWS_CACHE_TTL_MS };
  return value;
}

async function getQuote(symbol: string) {
  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const apiKey = requireApiKey("ALPHA_VANTAGE_API_KEY");
  const params = new URLSearchParams({
    function: "GLOBAL_QUOTE",
    symbol,
    apikey: apiKey,
  });
  const payload = await fetchAlphaVantage<{
    "Global Quote"?: AlphaVantageQuote;
    Note?: string;
    Information?: string;
  }>(`https://www.alphavantage.co/query?${params.toString()}`);

  if (!payload["Global Quote"]) {
    throw new Error(payload.Note ?? payload.Information ?? `No quote for ${symbol}`);
  }

  const value = payload["Global Quote"];
  quoteCache.set(symbol, {
    value,
    expiresAt: Date.now() + QUOTE_CACHE_TTL_MS,
  });
  return value;
}

export async function getMarketOverview() {
  const [gold, stocks, oil, news] = await Promise.all([
    getQuote("GLD"),
    getQuote("SPY"),
    getQuote("USO"),
    getNews(5),
  ]);

  const assets: MarketAsset[] = [
    parseQuote(gold, "gold", "Gold", "GLD", "Alpha Vantage · GLD proxy"),
    parseQuote(stocks, "sp500", "S&P 500", "SPY", "Alpha Vantage · SPY proxy"),
    parseQuote(oil, "oil", "Oil", "USO", "Alpha Vantage · USO proxy"),
  ];

  const riskSignals = news.articles.reduce((score, article) => {
    const title = article.headline.toLowerCase();
    if (/war|conflict|sanction|tanker attack|shipping disruption/.test(title)) {
      return score + 14;
    }
    if (/iran|hormuz|oil supply|inflation/.test(title)) {
      return score + 8;
    }
    return score;
  }, 18);
  const score = Math.min(100, riskSignals);
  const risk =
    score >= 75 ? "high" : score >= 50 ? "elevated" : score >= 30 ? "moderate" : "low";

  return {
    updatedAt: new Date().toISOString(),
    assets,
    geopoliticalRisk: risk,
    geopoliticalRiskScore: score,
    geopoliticalRiskLabel:
      risk === "high"
        ? "High"
        : risk === "elevated"
          ? "Elevated"
          : risk === "moderate"
            ? "Moderate"
            : "Low",
    riskDrivers: news.articles
      .slice(0, 3)
      .map((article) => article.headline),
  };
}

export async function getMarketComparison() {
  const [overview, news] = await Promise.all([getMarketOverview(), getNews(8)]);
  const inflationRisk = news.articles.some((article) =>
    /inflation|cpi|consumer prices|oil supply|hormuz/.test(article.headline.toLowerCase()),
  );
  const ratesRisk = news.articles.some((article) =>
    /rate hike|higher interest rates|interest rate/.test(article.headline.toLowerCase()),
  );
  const geopoliticalRisk = overview.geopoliticalRiskScore >= 50;

  const goldScore = Math.min(
    100,
    45 + (geopoliticalRisk ? 22 : 0) + (inflationRisk ? 18 : 0) - (ratesRisk ? 10 : 0),
  );
  const stocksScore = Math.min(
    100,
    55 - (geopoliticalRisk ? 18 : 0) - (inflationRisk ? 12 : 0) - (ratesRisk ? 12 : 0),
  );
  const favored = goldScore - stocksScore > 8 ? "gold" : stocksScore - goldScore > 8 ? "stocks" : "balanced";

  return {
    updatedAt: new Date().toISOString(),
    goldScore,
    stocksScore,
    favored,
    riskLevel: overview.geopoliticalRisk,
    supportiveFactors: [
      ...(geopoliticalRisk ? ["Elevated geopolitical risk can increase demand for defensive assets."] : []),
      ...(inflationRisk ? ["Inflation and energy headlines can support gold as a store-of-value narrative."] : []),
      ...(overview.assets.find((asset) => asset.id === "sp500" && asset.status === "up")
        ? ["Recent equity momentum remains a positive signal for stocks."]
        : []),
    ],
    negativeFactors: [
      ...(ratesRisk ? ["Higher-rate language can pressure gold and long-duration growth stocks."] : []),
      ...(geopoliticalRisk ? ["Geopolitical uncertainty can weigh on earnings expectations and risk appetite."] : []),
      ...(inflationRisk ? ["Sticky inflation can keep policy restrictive for longer."] : []),
    ],
    explanation:
      favored === "gold"
        ? "The current mix is more supportive of gold than broad US stocks, mainly because defensive and inflation-sensitive signals are outweighing growth support."
        : favored === "stocks"
          ? "The current mix is more supportive of broad US stocks, though the comparison can change quickly as rates and geopolitical headlines move."
          : "The signals are mixed. Neither asset has a decisive edge from this snapshot, so treat the comparison as a framework for learning rather than a call to action.",
  };
}

export function logMarketlensError(error: unknown, context: string) {
  logger.error({ err: error }, `MarketLens ${context} failed`);
}