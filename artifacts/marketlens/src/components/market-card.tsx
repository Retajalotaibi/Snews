import { ArrowDownRight, ArrowUpRight, Minus, Radio } from 'lucide-react';
import type { MarketAsset } from '@workspace/api-client-react';

export function MarketCard({ asset, index = 0 }: { asset: MarketAsset; index?: number }) {
  const positive = asset.status === 'up';
  const negative = asset.status === 'down';
  const TrendIcon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  const tone = positive ? 'text-teal-700' : negative ? 'text-orange-700' : 'text-muted-foreground';
  return (
    <article
      className={`card-lift reveal reveal-delay-${Math.min(index + 1, 4)} relative overflow-hidden rounded-xl border bg-card p-5`}
      data-testid={`card-market-${asset.id}`}
    >
      <div className="absolute right-0 top-0 h-20 w-20 translate-x-8 -translate-y-8 rounded-full border-[14px] border-primary/5" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">{asset.symbol}</p>
          <h3 className="mt-1 font-editorial text-[1.35rem] font-semibold leading-none">{asset.name}</h3>
        </div>
        <span className="font-data text-[10px] uppercase tracking-[.12em] text-muted-foreground">
          <Radio size={11} className="mr-1 inline text-primary" /> live
        </span>
      </div>
      <div className="mt-7 flex items-end justify-between gap-3">
        <p className="font-data text-2xl font-medium tracking-tight" data-testid={`text-value-${asset.id}`}>
          {asset.formattedValue}
        </p>
        <div className={`flex items-center gap-1 text-sm font-bold ${tone}`} data-testid={`status-change-${asset.id}`}>
          <TrendIcon size={16} strokeWidth={2.4} />
          {asset.changePercent > 0 ? '+' : ''}{asset.changePercent.toFixed(2)}%
        </div>
      </div>
      <div className="mt-4 flex h-7 items-end gap-1 opacity-55" aria-hidden="true">
        {[34, 45, 39, 53, 47, 62, 58, 71, 66, 78, 72, 86].map((height, itemIndex) => (
          <span key={itemIndex} className={`w-full rounded-t-sm ${positive ? 'bg-primary/45' : negative ? 'bg-accent/45' : 'bg-muted-foreground/35'}`} style={{ height: `${height}%` }} />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
        <span>{asset.source}</span>
        <span>{new Date(asset.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </article>
  );
}