import { ArrowUpRight, Gauge, ShieldAlert, Sparkles } from 'lucide-react';
import { useGetMarketOverview, getGetMarketOverviewQueryKey } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { MarketCard } from '@/components/market-card';
import { QueryEmpty, QueryError, QueryLoading } from '@/components/query-states';

export default function Home() {
  const overviewQuery = useGetMarketOverview({ query: { queryKey: getGetMarketOverviewQueryKey(), refetchInterval: 60_000 } });
  const overview = overviewQuery.data;

  return (
    <div className="space-y-10">
      <section className="reveal flex flex-col justify-between gap-7 border-b pb-8 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <div className="mb-4 flex items-center gap-2 font-data text-[10px] font-medium uppercase tracking-[.18em] text-primary"><Sparkles size={13} /> The morning read</div>
          <h1 className="font-editorial text-5xl font-semibold leading-[.92] tracking-tight md:text-7xl">What moved.<br /><span className="text-primary">Why it matters.</span></h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">A live read on the forces moving markets — translated into plain English, with uncertainty left visible.</p>
        </div>
        {overview ? <div className="shrink-0 text-left md:text-right"><p className="font-data text-[10px] uppercase tracking-[.16em] text-muted-foreground">Last market refresh</p><p className="mt-1 font-data text-sm">{new Date(overview.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p></div> : null}
      </section>

      {overviewQuery.isLoading ? <QueryLoading label="Connecting to live markets" /> : overviewQuery.isError ? <QueryError onRetry={() => overviewQuery.refetch()} /> : !overview ? <QueryEmpty label="Market overview is not available yet." /> : (
        <>
          {overview.assets?.length ? (
            <section>
              <div className="mb-4 flex items-end justify-between"><div><p className="font-data text-[10px] uppercase tracking-[.16em] text-muted-foreground">The board</p><h2 className="mt-1 font-editorial text-3xl font-semibold">Key markets</h2></div><span className="font-data text-[10px] uppercase tracking-[.14em] text-muted-foreground">{overview.assets.length} instruments</span></div>
              {overview.assets.length < 3 ? <div className="mb-4 rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 text-xs leading-5 text-muted-foreground" data-testid="status-partial-market">This market snapshot is partial. Some instruments have not reported a current value.</div> : null}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {overview.assets.map((asset, index) => <MarketCard key={asset.id} asset={asset} index={index} />)}
              </div>
            </section>
          ) : <QueryEmpty label="Prices are unavailable for this snapshot." />}

          <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
            <div className="rounded-xl bg-primary p-6 text-primary-foreground md:p-8" data-testid="panel-risk">
              <div className="flex items-start justify-between gap-6"><div><div className="flex items-center gap-2 font-data text-[10px] uppercase tracking-[.17em] text-primary-foreground/65"><ShieldAlert size={14} /> Geopolitical risk</div><h2 className="mt-5 font-editorial text-4xl font-semibold">{overview.geopoliticalRiskLabel}</h2></div><div className="font-data text-5xl font-medium">{overview.geopoliticalRiskScore}<span className="text-lg text-primary-foreground/60">/100</span></div></div>
              <div className="mt-7 h-2 overflow-hidden rounded-full bg-primary-foreground/15"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${overview.geopoliticalRiskScore}%` }} /></div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">{overview.riskDrivers?.length ? overview.riskDrivers.map((driver, index) => <div key={`${driver}-${index}`} className="flex gap-2 text-sm leading-5 text-primary-foreground/80"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{driver}</div>) : <p className="text-sm text-primary-foreground/70">No specific drivers were reported for this snapshot.</p>}</div>
            </div>
            <div className="rounded-xl border bg-card p-6 md:p-8"><div className="flex items-center gap-2 font-data text-[10px] uppercase tracking-[.17em] text-muted-foreground"><Gauge size={14} className="text-accent" /> How to read this</div><p className="mt-5 font-editorial text-2xl leading-tight">Markets price stories before they become consensus.</p><p className="mt-4 text-sm leading-6 text-muted-foreground">The number is the starting point. The explanation around it is the edge — especially when the signal is mixed or incomplete.</p><Link href="/news" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary" data-testid="link-read-news">Read the news desk <ArrowUpRight size={15} /></Link></div>
          </section>
        </>
      )}
    </div>
  );
}