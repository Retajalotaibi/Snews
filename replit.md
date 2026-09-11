# MarketLens

MarketLens turns live financial and geopolitical news into plain-English context for oil, gold, US stocks, and inflation.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required secrets: `NEWS_API_KEY`, `ALPHA_VANTAGE_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/marketlens/src/` — React pages, reusable market/news components, and theme
- `artifacts/api-server/src/lib/marketlens.ts` — server-only NewsAPI/Alpha Vantage clients and rules-based analysis
- `artifacts/api-server/src/routes/marketlens.ts` — live overview, comparison, and news endpoints
- `lib/api-spec/openapi.yaml` — source of truth for the shared API contract

## Architecture decisions

- API keys are read only by the API server; the browser uses generated React Query hooks against `/api`.
- Gold, S&P 500, and oil are represented by the GLD, SPY, and USO Alpha Vantage quote proxies.
- News impact is intentionally rules-based and labels scenarios as possible effects, never predictions.
- Alpha Vantage requests are queued and cached in memory to respect the free plan burst limit.

## Product

- Overview page with live market cards and a geopolitical risk read
- News desk with current headlines, affected assets, and simple impact badges
- Gold vs stocks comparison with supportive factors, negative factors, risk level, and educational framing

## User preferences

- Keep the app small and avoid database, authentication, payments, and AI additions unless explicitly requested.

## Gotchas

- Alpha Vantage free keys enforce roughly one request per second and a daily quota; preserve the server-side queue and cache when changing market data access.
- If either upstream service fails, show the error state rather than inventing market data.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
