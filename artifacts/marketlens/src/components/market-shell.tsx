import { Activity, ArrowUpRight, BarChart3, Newspaper, Scale, Wifi } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/', label: 'Overview', icon: Activity },
  { href: '/news', label: 'News desk', icon: Newspaper },
  { href: '/gold-vs-stocks', label: 'Gold vs stocks', icon: Scale },
];

export function MarketShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-5 px-5 py-4 lg:px-10">
          <Link href="/" className="group flex items-center gap-3" data-testid="link-brand">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:rotate-[-8deg]"><BarChart3 size={19} /></span>
            <span>
              <span className="block font-editorial text-2xl font-semibold leading-none">MarketLens</span>
              <span className="mt-1 block font-data text-[9px] uppercase tracking-[.2em] text-muted-foreground">Context over noise</span>
            </span>
          </Link>
          <div className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground md:flex">
            <Wifi size={13} className="text-primary" /> Markets live
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-5 pb-3 lg:px-10" aria-label="Main navigation">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link key={href} href={href} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>
                <Icon size={15} /> {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10 lg:py-12">{children}</main>
      <footer className="mx-auto max-w-[1440px] border-t px-5 py-8 lg:px-10">
        <p className="font-data text-[10px] uppercase tracking-[.16em] text-muted-foreground">For educational purposes only. Not financial advice.</p>
      </footer>
    </div>
  );
}