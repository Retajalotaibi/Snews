import { Check, CircleAlert, Scale, X } from 'lucide-react';
import { useGetMarketComparison, getGetMarketComparisonQueryKey } from '@workspace/api-client-react';
import { QueryEmpty, QueryError, QueryLoading } from '@/components/query-states';

export default function Comparison() {
  const comparisonQuery = useGetMarketComparison({ query: { queryKey: getGetMarketComparisonQueryKey(), refetchInterval: 120_000 } });
  const comparison = comparisonQuery.data;
  return (
    <div className="space-y-9">
      <section className="reveal flex flex-col justify-between gap-6 border-b pb-8 md:flex-row md:items-end">
        <div><div className="mb-4 flex items-center gap-2 font-data text-[10px] font-medium uppercase tracking-[.18em] text-primary"><Scale size={13} /> The comparison</div><h1 className="font-editorial text-5xl font-semibold leading-[.92] md:text-7xl">Gold or<br /><span className="text-primary">stocks?</span></h1><p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">Not a timeless answer. A read on which exposure has the cleaner case in this particular backdrop.</p></div>
        {comparison ? <div className="font-data text-[10px] uppercase tracking-[.14em] text-muted-foreground md:text-right">Updated<br /><span className="text-foreground">{new Date(comparison.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span></div> : null}
      </section>
      {comparisonQuery.isLoading ? <QueryLoading label="Building the relative case" /> : comparisonQuery.isError ? <QueryError onRetry={() => comparisonQuery.refetch()} label="The comparison model is temporarily unavailable." /> : !comparison ? <QueryEmpty label="No comparison is available for this market snapshot." /> : (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-xl border bg-card p-6 md:p-8">
              <div className="flex items-center justify-between gap-4"><p className="font-data text-[10px] uppercase tracking-[.16em] text-muted-foreground">Relative score</p><span className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-primary-foreground">{comparison.riskLevel} risk</span></div>
              <div className="mt-9 grid gap-8 sm:grid-cols-2">
                <ScoreRow label="Gold" score={comparison.goldScore} favored={comparison.favored === 'gold'} tone="bg-accent" />
                <ScoreRow label="US stocks" score={comparison.stocksScore} favored={comparison.favored === 'stocks'} tone="bg-primary" />
              </div>
              <div className="mt-9 border-t pt-5"><p className="font-editorial text-2xl leading-tight">{comparison.favored === 'balanced' ? 'The case is balanced.' : `${comparison.favored === 'gold' ? 'Gold' : 'US stocks'} has the cleaner case right now.`}</p><p className="mt-3 text-sm leading-6 text-muted-foreground">{comparison.explanation}</p></div>
            </div>
            <div className="rounded-xl bg-secondary p-6 md:p-8"><div className="flex items-center gap-2 font-data text-[10px] uppercase tracking-[.16em] text-muted-foreground"><CircleAlert size={14} className="text-accent" /> Before you decide</div><p className="mt-5 font-editorial text-2xl leading-tight">A score is a lens, not a forecast.</p><p className="mt-4 text-sm leading-6 text-muted-foreground">This view weighs today’s backdrop. It does not remove time horizon, valuation, liquidity, or your own risk from the decision.</p></div>
          </section>
          <section className="grid gap-4 md:grid-cols-2">
            <FactorList title="What supports the favored case" items={comparison.supportiveFactors} positive />
            <FactorList title="What could change the read" items={comparison.negativeFactors} positive={false} />
          </section>
        </>
      )}
    </div>
  );
}

function ScoreRow({ label, score, favored, tone }: { label: string; score: number; favored: boolean; tone: string }) {
  return <div><div className="flex items-baseline justify-between gap-3"><span className="font-editorial text-2xl">{label}</span>{favored ? <span className="font-data text-[9px] font-bold uppercase tracking-[.14em] text-primary">Favored</span> : null}</div><div className="mt-3 flex items-center gap-3"><div className="h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${tone} transition-all duration-700`} style={{ width: `${score}%` }} /></div><span className="font-data text-lg">{score}</span></div></div>;
}

function FactorList({ title, items, positive }: { title: string; items: string[]; positive: boolean }) {
  const Icon = positive ? Check : X;
  return <div className="rounded-xl border bg-card p-6 md:p-8"><h2 className="font-editorial text-2xl font-semibold">{title}</h2>{items?.length ? <ul className="mt-5 space-y-4">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-3 text-sm leading-6 text-muted-foreground"><span className={`mt-1.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${positive ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}><Icon size={12} strokeWidth={3} /></span>{item}</li>)}</ul> : <p className="mt-5 text-sm text-muted-foreground">No factors were reported for this snapshot.</p>}</div>;
}