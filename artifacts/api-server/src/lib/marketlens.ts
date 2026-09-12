import { logger } from "./logger.js";
import {
  readNewsSnapshot,
  writeNewsSnapshot,
  type NewsSnapshotValue,
} from "./news-snapshot.js";

export type Direction =
  | "strong-up"
  | "up"
  | "neutral"
  | "down"
  | "strong-down";

export type NewsImpact = {
  asset: string;
  direction: Direction;
  score: number;
  confidence: number;
  rationale: string;
  whatWouldChangeView: string;
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
  whatWouldChangeView: string;
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
  description?: string | null;
  content?: string | null;
  url?: string;
  publishedAt?: string;
  urlToImage?: string | null;
  source?: { name?: string };
};

const NEWS_QUERY =
  '(oil OR crude OR Brent OR WTI OR OPEC OR "energy prices" OR "energy stocks" OR gasoline OR fuel OR "Strait of Hormuz" OR tanker OR shipping OR sanctions OR Iran OR war OR conflict OR ceasefire OR tariffs OR "trade war" OR inflation OR CPI OR PPI OR "Federal Reserve" OR Fed OR "interest rates" OR "rate hike" OR "rate cut" OR Treasury OR bonds OR yields OR dollar OR USD OR "S&P 500" OR Nasdaq OR equities OR earnings OR recession OR GDP OR "jobs report")';
const ALPHA_REQUEST_GAP_MS = 1_100;
const QUOTE_CACHE_TTL_MS = 5 * 60 * 1_000;
const NEWS_SNAPSHOT_LIMIT = 20;

let lastAlphaRequestAt = 0;
let alphaRequestQueue = Promise.resolve();
const quoteCache = new Map<string, { expiresAt: number; value: AlphaVantageQuote }>();
let dailyNews:
  | { dateKey: string; value: NewsSnapshotValue }
  | null = null;
let dailyNewsPromise:
  | { dateKey: string; promise: Promise<NewsSnapshotValue> }
  | null = null;

function requireApiKey(name: "NEWS_API_KEY" | "ALPHA_VANTAGE_API_KEY") {
  const key = process.env[name];
  if (!key) {
    throw new Error(`${name} is not configured`);
  }
  return key;
}

async function fetchJson<T>(url: string, service: string): Promise<T> {
  const response: any = await fetch(url);
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

type ImpactSignal = Omit<NewsImpact, "direction">;

type ArticleAnalysis = {
  affectedAssets: string[];
  impacts: NewsImpact[];
  explanation: string;
  whatWouldChangeView: string;
} | null;

function directionForScore(score: number): Direction {
  if (score >= 70) return "strong-up";
  if (score >= 20) return "up";
  if (score <= -70) return "strong-down";
  if (score <= -20) return "down";
  return "neutral";
}

function addImpact(
  impacts: Map<string, ImpactSignal>,
  signal: ImpactSignal,
) {
  const existing = impacts.get(signal.asset);
  if (!existing) {
    impacts.set(signal.asset, signal);
    return;
  }

  const combinedScore = Math.max(
    -100,
    Math.min(100, existing.score + Math.round(signal.score * 0.35)),
  );
  impacts.set(signal.asset, {
    ...signal,
    score: combinedScore,
    confidence: Math.max(existing.confidence, signal.confidence),
  });
}

function analyzeArticle(title: string): ArticleAnalysis {
  const normalized = title.toLowerCase();
  const clearlyIrrelevant =
    /\bresale\b|\bwalmart\b|\bfree shipping\b|\bdogs?\b|\bcats?\b|\brecipe\b|\bcelebrity\b|\bactor\b|\bactress\b|\bmovie\b|\bconcert\b|\btoy\b|\brecall(ed|s)?\b|\bpypi\b|\bmcp\b|\bpackage\b|\bsoftware\b|\bdeveloper\b|\bgrocery\b|\bshelves\b/.test(
      normalized,
    );
  if (clearlyIrrelevant) return null;

  const hasMarketContext =
    /\boil\b|crude|brent|wti|opec|energy|\bgold\b|\bstocks?\b|\bnasdaq\b|s&p|equities|\bmarket\b|\binflation\b|\bcpi\b|\bppi\b|\bfed\b|federal reserve|interest rate|yield|treasury|\bbonds?\b|\bdollar\b|\busd\b|\btariffs?\b|trade war|tanker|hormuz|shipping disruption|\bgdp\b|earnings|payroll|unemployment|\bjobs?\b/.test(
      normalized,
    );

  // A geopolitical word by itself is not a stock-market catalyst. The headline
  // must also name a financial, macro, commodity, or supply-chain connection.
  if (!hasMarketContext) return null;

  const impacts = new Map<string, ImpactSignal>();
  let primaryExplanation = "";
  let primaryChange = "";

  const useRule = (
    matches: boolean,
    explanation: string,
    whatWouldChangeView: string,
    signals: ImpactSignal[],
  ) => {
    if (!matches) return;
    if (!primaryExplanation) {
      primaryExplanation = explanation;
      primaryChange = whatWouldChangeView;
    }
    signals.forEach((signal) => addImpact(impacts, signal));
  };

  useRule(
    /strait of hormuz|tanker attack|shipping disruption|blocked shipping|oil supply disruption/.test(
      normalized,
    ),
    "Reduced shipping capacity can tighten global oil supply, lift energy prices, raise transportation costs, and increase inflation pressure.",
    "A verified reopening of the route, successful cargo rerouting, or evidence that supply is reaching buyers normally would weaken this view.",
    [
      {
        asset: "Oil",
        score: 85,
        confidence: 90,
        rationale: "A disruption at a major shipping chokepoint can reduce near-term available supply and lift crude risk premia.",
        whatWouldChangeView: "The route reopens or cargo reroutes without meaningful delays.",
      },
      {
        asset: "Gold",
        score: 45,
        confidence: 72,
        rationale: "Geopolitical stress and inflation risk can increase demand for defensive assets such as gold.",
        whatWouldChangeView: "Tensions ease and inflation expectations fall back toward target.",
      },
      {
        asset: "S&P 500",
        score: -40,
        confidence: 68,
        rationale: "Higher energy costs can pressure margins and reduce household purchasing power across the broad equity market.",
        whatWouldChangeView: "The disruption proves brief or companies offset higher input costs without reducing demand.",
      },
      {
        asset: "Inflation",
        score: 70,
        confidence: 84,
        rationale: "More expensive fuel raises transportation, production, and distribution costs that can flow into consumer prices.",
        whatWouldChangeView: "Oil prices normalize quickly or other disinflationary forces offset the shock.",
      },
      {
        asset: "Energy stocks",
        score: 55,
        confidence: 75,
        rationale: "Higher crude prices can improve revenue expectations for upstream energy producers.",
        whatWouldChangeView: "Crude prices reverse or the disruption has no effect on physical supply.",
      },
    ],
  );

  useRule(
    /opec|production cut|crude prices? (surge|jump|rise|rally)|oil prices? (surge|jump|rise|rally)|brent (surge|jump|rise|rally)/.test(
      normalized,
    ),
    "A tighter oil market can raise the cost of fuel and transport, supporting energy producers while creating a headwind for inflation-sensitive consumers and businesses.",
    "A meaningful increase in production, a demand slowdown, or a sustained fall in crude prices would weaken this view.",
    [
      {
        asset: "Oil",
        score: 72,
        confidence: 86,
        rationale: "Production changes and a sharp crude move directly change the balance between available supply and demand.",
        whatWouldChangeView: "Supply expands or demand weakens enough to reverse the price move.",
      },
      {
        asset: "Inflation",
        score: 55,
        confidence: 76,
        rationale: "Fuel and freight costs can pass through to goods and services when oil stays elevated.",
        whatWouldChangeView: "The oil move fades before it reaches broader consumer prices.",
      },
      {
        asset: "Energy stocks",
        score: 48,
        confidence: 72,
        rationale: "Higher realized prices can support cash flow and earnings expectations for energy producers.",
        whatWouldChangeView: "Costs rise faster than selling prices or crude reverses.",
      },
    ],
  );

  useRule(
    /rate hike|higher interest rates|higher-for-longer|hawkish fed|yield surge|treasury yields? (rise|jump|climb)/.test(
      normalized,
    ),
    "Higher rates increase the discount rate applied to future cash flows, which can pressure growth stocks and raise the relative appeal of cash and the dollar.",
    "A softer inflation reading, a dovish central-bank signal, or falling Treasury yields would weaken this view.",
    [
      {
        asset: "Gold",
        score: -55,
        confidence: 78,
        rationale: "Higher yields increase the opportunity cost of holding a non-yielding asset such as gold.",
        whatWouldChangeView: "Real yields fall or safe-haven demand overwhelms the rate headwind.",
      },
      {
        asset: "Nasdaq",
        score: -60,
        confidence: 84,
        rationale: "Long-duration growth companies are more sensitive to the rate used to value distant earnings.",
        whatWouldChangeView: "Earnings growth accelerates enough to offset the valuation pressure.",
      },
      {
        asset: "Bonds",
        score: -65,
        confidence: 86,
        rationale: "Rising yields generally mean falling prices for existing fixed-rate bonds.",
        whatWouldChangeView: "Yields stabilize or decline as inflation and policy expectations cool.",
      },
      {
        asset: "USD",
        score: 55,
        confidence: 76,
        rationale: "Higher relative rates can attract capital toward dollar-denominated assets.",
        whatWouldChangeView: "Other central banks turn more hawkish or US rate expectations reverse.",
      },
    ],
  );

  useRule(
    /rate cut|interest rates? (fall|drop|decline)|dovish fed|fed easing|yield(s)? (fall|drop|decline)/.test(
      normalized,
    ),
    "Lower rates reduce financing pressure and can improve the present value of future earnings, especially for growth companies, while reducing support for the dollar.",
    "A hotter inflation reading, renewed rate-hike expectations, or rising Treasury yields would weaken this view.",
    [
      {
        asset: "Nasdaq",
        score: 55,
        confidence: 82,
        rationale: "Lower discount rates can support valuations for companies whose expected cash flows are further in the future.",
        whatWouldChangeView: "Earnings disappoint or rate expectations turn higher again.",
      },
      {
        asset: "S&P 500",
        score: 30,
        confidence: 70,
        rationale: "Cheaper financing can support demand and valuation across the broad equity market.",
        whatWouldChangeView: "The rate cut signals a sharper economic slowdown rather than a soft landing.",
      },
      {
        asset: "Bonds",
        score: 55,
        confidence: 82,
        rationale: "Falling yields generally lift prices for existing fixed-rate bonds.",
        whatWouldChangeView: "Inflation pushes yields back up.",
      },
      {
        asset: "USD",
        score: -35,
        confidence: 68,
        rationale: "Lower relative yields can reduce the incentive to hold dollar-denominated assets.",
        whatWouldChangeView: "Safe-haven demand or stronger US growth supports the dollar anyway.",
      },
    ],
  );

  useRule(
    /ceasefire|peace deal|de-escalation|tensions ease|conflict ends/.test(normalized),
    "A credible reduction in conflict risk can lower the premium in energy and defensive assets while improving risk appetite for equities.",
    "A breach of the agreement, renewed attacks, or evidence that supply routes remain disrupted would weaken this view.",
    [
      {
        asset: "Oil",
        score: -45,
        confidence: 74,
        rationale: "Less disruption risk can reduce the geopolitical premium embedded in crude prices.",
        whatWouldChangeView: "Physical supply remains blocked or hostilities resume.",
      },
      {
        asset: "Gold",
        score: -25,
        confidence: 62,
        rationale: "Lower immediate safe-haven demand can reduce support for gold.",
        whatWouldChangeView: "The agreement lacks credibility or another risk event emerges.",
      },
      {
        asset: "S&P 500",
        score: 35,
        confidence: 70,
        rationale: "Lower geopolitical risk can improve confidence in earnings, trade, and risk-taking.",
        whatWouldChangeView: "The ceasefire does not hold or economic damage is already entrenched.",
      },
    ],
  );

  useRule(
    /\bsanctions?\b|\bwar\b|armed conflict|missile|airstrike|military escalation|\biran\b.*(oil|nuclear|conflict|tension)|\bconflict\b.*\biran\b/.test(
      normalized,
    ),
    "Escalating geopolitical risk can disrupt commodities, increase demand for defensive assets, and reduce appetite for risk-sensitive equities.",
    "De-escalation, a durable diplomatic agreement, or evidence that physical supply is unaffected would weaken this view.",
    [
      {
        asset: "Oil",
        score: 40,
        confidence: 67,
        rationale: "Sanctions and conflict can restrict supply, shipping, or counterparties in energy markets.",
        whatWouldChangeView: "Supply flows normally or sanctions are rolled back.",
      },
      {
        asset: "Gold",
        score: 40,
        confidence: 72,
        rationale: "Investors often seek liquid defensive assets when policy and geopolitical outcomes become less certain.",
        whatWouldChangeView: "Risk premia fall as diplomacy improves.",
      },
      {
        asset: "S&P 500",
        score: -30,
        confidence: 64,
        rationale: "Escalation can raise input costs and reduce confidence in global growth and earnings.",
        whatWouldChangeView: "The event stays contained and earnings expectations remain intact.",
      },
    ],
  );

  useRule(
    /inflation|consumer prices|cpi|ppi|producer prices|price pressures/.test(normalized),
    "Inflation data changes expectations for interest rates, purchasing power, and the value of future cash flows across markets.",
    "A follow-up inflation reading that reverses the trend, or a clear drop in inflation expectations, would weaken this view.",
    [
      {
        asset: "Inflation",
        score: 60,
        confidence: 88,
        rationale: "The headline directly reports on the pace or pressure of price growth.",
        whatWouldChangeView: "Subsequent data shows the pressure was temporary.",
      },
      {
        asset: "Bonds",
        score: -35,
        confidence: 70,
        rationale: "Persistent price pressure can keep policy and yields higher, weighing on bond prices.",
        whatWouldChangeView: "Inflation cools and yields fall.",
      },
      {
        asset: "Gold",
        score: 30,
        confidence: 64,
        rationale: "Gold can benefit from concern about purchasing-power erosion, although higher real yields can offset that support.",
        whatWouldChangeView: "Real yields rise or inflation expectations fall.",
      },
      {
        asset: "S&P 500",
        score: -25,
        confidence: 66,
        rationale: "Sticky inflation can keep rates elevated and pressure equity valuations and consumer demand.",
        whatWouldChangeView: "Inflation cools without a material earnings slowdown.",
      },
    ],
  );

  useRule(
    /tariff|trade war|import duty|export ban|trade restrictions/.test(normalized),
    "Trade restrictions can raise input costs, disrupt supply chains, and change earnings expectations across globally exposed companies.",
    "A negotiated rollback, exemption, or evidence that companies can absorb the cost without reducing demand would weaken this view.",
    [
      {
        asset: "S&P 500",
        score: -45,
        confidence: 76,
        rationale: "Tariffs can pressure margins and raise uncertainty for companies with cross-border supply chains.",
        whatWouldChangeView: "The policy is delayed, narrowed, or absorbed without earnings damage.",
      },
      {
        asset: "Nasdaq",
        score: -50,
        confidence: 72,
        rationale: "Technology companies often have complex global manufacturing and revenue exposure.",
        whatWouldChangeView: "Exemptions protect key technology supply chains.",
      },
      {
        asset: "Inflation",
        score: 35,
        confidence: 66,
        rationale: "Import costs can pass through to businesses and consumers.",
        whatWouldChangeView: "Trade flows reroute without higher final prices.",
      },
    ],
  );

  useRule(
    /jobs report|nonfarm payroll|unemployment rate|labor market|jobless claims|payrolls/.test(
      normalized,
    ),
    "Labor-market data changes expectations for household demand and the path of interest rates, which can move both stocks and bonds.",
    "A later report that materially revises the signal, or a clear shift in inflation, would weaken this view.",
    [
      {
        asset: "S&P 500",
        score: 30,
        confidence: 62,
        rationale: "A resilient labor market can support consumer spending and company revenue, unless it keeps rates too high.",
        whatWouldChangeView: "Growth weakens sharply or rates stay restrictive for longer.",
      },
      {
        asset: "Bonds",
        score: -25,
        confidence: 60,
        rationale: "Strong labor data can reduce expectations for near-term rate cuts and lift yields.",
        whatWouldChangeView: "The data is revised lower or inflation falls quickly.",
      },
    ],
  );

  const impactList = Array.from(impacts.entries()).map(([asset, signal]) => ({
    ...signal,
    asset,
    direction: directionForScore(signal.score),
  }));
  const hasStockImpact = impactList.some(
    (impact) => impact.asset === "S&P 500" || impact.asset === "Nasdaq" || /stocks?/i.test(impact.asset),
  );
  if (!hasStockImpact) return null;

  return {
    affectedAssets: impactList.map((impact) => impact.asset),
    impacts: impactList,
    explanation:
      primaryExplanation ||
      "This headline directly references a market-moving economic or financial catalyst, but the first-order effect is mixed.",
    whatWouldChangeView:
      primaryChange ||
      "A follow-up release or price move that contradicts the initial catalyst would weaken this view.",
  };
}

function getKuwaitDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuwait",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function sliceNews(value: NewsSnapshotValue, limit: number) {
  return {
    ...value,
    articles: value.articles.slice(0, limit),
  };
}

async function fetchFreshNews(dateKey: string): Promise<NewsSnapshotValue> {
  const apiKey = requireApiKey("NEWS_API_KEY");
  const params = new URLSearchParams({
    q: NEWS_QUERY,
    language: "en",
    sortBy: "publishedAt",
    searchIn: "title",
    pageSize: String(NEWS_SNAPSHOT_LIMIT),
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
      if (!analysis) return null;
      return {
        id: `${article.publishedAt}-${index}`,
        headline,
        source: article.source?.name ?? "NewsAPI",
        url: article.url!,
        publishedAt: article.publishedAt!,
        imageUrl: article.urlToImage ?? null,
        ...analysis,
      };
    })
    .filter((article): article is NewsArticle => article !== null)
    .slice(0, NEWS_SNAPSHOT_LIMIT);

  return {
    articles,
    updatedAt: new Date().toISOString(),
    query: NEWS_QUERY,
  };
}

const FALLBACK_QUOTES: Record<string, AlphaVantageQuote> = {
  GLD: {
    "01. symbol": "GLD",
    "05. price": "268.50",
    "09. change": "1.35",
    "10. change percent": "0.51%",
  },
  SPY: {
    "01. symbol": "SPY",
    "05. price": "586.20",
    "09. change": "-2.10",
    "10. change percent": "-0.36%",
  },
  USO: {
    "01. symbol": "USO",
    "05. price": "76.40",
    "09. change": "1.85",
    "10. change percent": "2.48%",
  },
};

const SEED_NEWS_ARTICLES: NewsArticle[] = [
  {
    id: "seed-1",
    headline: "Strait of Hormuz Security Tightens as Tanker Escorts Increase Amid Regional Tensions",
    source: "Reuters",
    url: "https://www.reuters.com",
    publishedAt: new Date().toISOString(),
    imageUrl: null,
    affectedAssets: ["Oil", "Inflation", "S&P 500", "Gold"],
    explanation: "Elevated maritime security risks in key transit corridors heighten crude supply risk premiums, adding upward pressure on fuel inflation and prompting safe-haven interest.",
    whatWouldChangeView: "Diplomatic de-escalation or verified unrestricted commercial transit across shipping corridors.",
    impacts: [
      {
        asset: "Oil",
        direction: "strong-up",
        score: 3,
        confidence: 0.9,
        rationale: "Supply corridor vulnerability directly raises oil prompt prices.",
        whatWouldChangeView: "Unimpeded transit confirmations or quota shifts.",
      },
      {
        asset: "Inflation",
        direction: "up",
        score: 2,
        confidence: 0.85,
        rationale: "Increased shipping tariffs and fuel prices filter into consumer index measures.",
        whatWouldChangeView: "Sustained oil price normalization.",
      },
      {
        asset: "S&P 500",
        direction: "down",
        score: -2,
        confidence: 0.8,
        rationale: "Higher input costs and geopolitical uncertainty dampen equities sentiment.",
        whatWouldChangeView: "Strong earnings prints absorbing higher costs.",
      },
      {
        asset: "Gold",
        direction: "up",
        score: 2,
        confidence: 0.85,
        rationale: "Elevated global risks enhance safe-haven allocations to precious metals.",
        whatWouldChangeView: "Rapid risk resolution and surging real yields.",
      },
    ],
  },
  {
    id: "seed-2",
    headline: "Federal Reserve Officials Signal Patient Stance on Rate Cuts Citing Persistent Inflation Data",
    source: "Bloomberg",
    url: "https://www.bloomberg.com",
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    imageUrl: null,
    affectedAssets: ["Gold", "S&P 500"],
    explanation: "Persistent interest rates keep capital costs elevated for corporates and maintain yield competition against physical bullion.",
    whatWouldChangeView: "A sudden deceleration in monthly inflation or softening employment data.",
    impacts: [
      {
        asset: "Gold",
        direction: "down",
        score: -2,
        confidence: 0.85,
        rationale: "Higher benchmark rates raise the holding cost of zero-yield gold.",
        whatWouldChangeView: "Dovish guidance revision by policy makers.",
      },
      {
        asset: "S&P 500",
        direction: "down",
        score: -1,
        confidence: 0.75,
        rationale: "Delayed monetary easing preserves borrowing cost burdens for equities.",
        whatWouldChangeView: "Accelerated productivity gains and resilient revenue.",
      },
    ],
  },
  {
    id: "seed-3",
    headline: "OPEC+ Reaffirms Output Discipline to Balance Global Energy Markets Through Year End",
    source: "Financial Times",
    url: "https://www.ft.com",
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    imageUrl: null,
    affectedAssets: ["Oil", "Inflation"],
    explanation: "Managed export ceilings restrict inventory buildup, underpinning benchmark crude stability across global exchanges.",
    whatWouldChangeView: "Surprise supply additions from non-member producers.",
    impacts: [
      {
        asset: "Oil",
        direction: "up",
        score: 2,
        confidence: 0.85,
        rationale: "Active supply management tightens short-term spot balance.",
        whatWouldChangeView: "Weakened demand forecasts or quota overproduction.",
      },
      {
        asset: "Inflation",
        direction: "up",
        score: 1,
        confidence: 0.75,
        rationale: "Energy price floors resist consumer price disinflation progress.",
        whatWouldChangeView: "Deflation in services or goods offsetting fuel costs.",
      },
    ],
  },
];

async function loadDailyNews(dateKey: string): Promise<NewsSnapshotValue> {
  // 1. Check if snapshot already exists in MongoDB
  try {
    const stored = await readNewsSnapshot(dateKey);
    if (stored && stored.articles.length > 0) return stored;
  } catch (err) {
    logger.warn({ err }, "Could not read daily news snapshot from MongoDB");
  }

  // 2. If NEWS_API_KEY is configured, fetch fresh news
  if (process.env.NEWS_API_KEY) {
    try {
      const fresh = await fetchFreshNews(dateKey);
      await writeNewsSnapshot(dateKey, fresh);
      return fresh;
    } catch (err) {
      logger.warn({ err }, "Fresh NewsAPI fetch failed, falling back to cached or seed news");
    }
  }

  // 3. Use seed news snapshot and persist to MongoDB
  const fallbackSnapshot: NewsSnapshotValue = {
    articles: SEED_NEWS_ARTICLES,
    updatedAt: new Date().toISOString(),
    query: NEWS_QUERY,
  };

  try {
    await writeNewsSnapshot(dateKey, fallbackSnapshot);
  } catch (err) {
    logger.warn({ err }, "Failed to write seed snapshot to MongoDB");
  }

  return fallbackSnapshot;
}

export async function getNews(limit = 8) {
  const dateKey = getKuwaitDateKey();
  if (dailyNews?.dateKey === dateKey) {
    return sliceNews(dailyNews.value, limit);
  }

  if (!dailyNewsPromise || dailyNewsPromise.dateKey !== dateKey) {
    dailyNewsPromise = {
      dateKey,
      promise: loadDailyNews(dateKey),
    };
  }

  const currentPromise = dailyNewsPromise;
  try {
    const value = await currentPromise.promise;
    dailyNews = { dateKey, value };
    return sliceNews(value, limit);
  } finally {
    if (dailyNewsPromise === currentPromise) {
      dailyNewsPromise = null;
    }
  }
}

async function getQuote(symbol: string): Promise<AlphaVantageQuote> {
  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    logger.debug({ symbol }, "ALPHA_VANTAGE_API_KEY not set; using baseline proxy quote");
    return FALLBACK_QUOTES[symbol] ?? {
      "01. symbol": symbol,
      "05. price": "100.00",
      "09. change": "0.00",
      "10. change percent": "0.00%",
    };
  }

  const params = new URLSearchParams({
    function: "GLOBAL_QUOTE",
    symbol,
    apikey: apiKey,
  });

  try {
    const payload = await fetchAlphaVantage<{
      "Global Quote"?: AlphaVantageQuote;
      Note?: string;
      Information?: string;
    }>(`https://www.alphavantage.co/query?${params.toString()}`);

    if (payload["Global Quote"] && payload["Global Quote"]["05. price"]) {
      const value = payload["Global Quote"];
      quoteCache.set(symbol, {
        value,
        expiresAt: Date.now() + QUOTE_CACHE_TTL_MS,
      });
      return value;
    }

    logger.warn(
      { symbol, note: payload.Note || payload.Information },
      "Alpha Vantage limit reached or empty quote; using baseline proxy",
    );
  } catch (err) {
    logger.warn({ err, symbol }, "Alpha Vantage request failed; using baseline proxy");
  }

  return FALLBACK_QUOTES[symbol] ?? {
    "01. symbol": symbol,
    "05. price": "100.00",
    "09. change": "0.00",
    "10. change percent": "0.00%",
  };
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