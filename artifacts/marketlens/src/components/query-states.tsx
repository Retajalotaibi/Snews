import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

export function QueryLoading({ label = 'Reading the desk' }: { label?: string }) {
  return (
    <div className="space-y-4" data-testid="state-loading">
      <div className="skeleton h-6 w-44 rounded" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => <div key={item} className="skeleton h-44 rounded-xl" />)}
      </div>
      <p className="font-data text-[10px] uppercase tracking-[.16em] text-muted-foreground">{label}...</p>
    </div>
  );
}

export function QueryError({ onRetry, label = 'The desk could not reach the data source.' }: { onRetry: () => void; label?: string }) {
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-8 text-center" data-testid="state-error">
      <AlertTriangle className="mx-auto text-accent" size={25} />
      <h2 className="mt-3 font-editorial text-2xl font-semibold">A signal went quiet.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{label} Try again when you’re ready.</p>
      <button onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5" data-testid="button-retry">
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  );
}

export function QueryEmpty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card/60 p-10 text-center" data-testid="state-empty">
      <Inbox className="mx-auto text-muted-foreground" size={25} />
      <h2 className="mt-3 font-editorial text-2xl font-semibold">Nothing on the board.</h2>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}