import { ArrowUpRight, Clock3, ExternalLink } from 'lucide-react';
import type { NewsArticle } from '@workspace/api-client-react';
import { ImpactBadge } from '@/components/impact-badge';

export function NewsCard({ article, featured = false }: { article: NewsArticle; featured?: boolean }) {
  return (
    <article className={`card-lift reveal overflow-hidden rounded-xl border bg-card ${featured ? 'md:grid md:grid-cols-[.85fr_1.15fr]' : ''}`} data-testid={`card-news-${article.id}`}>
      {featured && article.imageUrl ? (
        <div className="min-h-48 bg-secondary md:min-h-full">
          <img src={article.imageUrl} alt="" className="h-full w-full object-cover grayscale-[.18]" />
        </div>
      ) : null}
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
          <span className="text-primary">{article.source}</span>
          <span className="inline-flex items-center gap-1"><Clock3 size={11} /> {new Date(article.publishedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
        </div>
        <h2 className={`mt-3 font-editorial font-semibold leading-[1.05] ${featured ? 'text-3xl md:text-4xl' : 'text-2xl'}`} data-testid={`text-headline-${article.id}`}>
          {article.headline}
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {article.impacts?.map((impact) => <ImpactBadge key={`${article.id}-${impact.asset}`} asset={impact.asset} direction={impact.direction} />)}
        </div>
        <p className="mt-5 text-sm leading-6 text-muted-foreground">{article.explanation}</p>
        <div className="mt-5 flex items-center justify-between gap-4 border-t pt-4">
          <span className="text-[11px] font-semibold text-muted-foreground">{article.affectedAssets?.join(' · ') || 'Macro context'}</span>
          <a href={article.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-primary transition-transform hover:translate-x-0.5" data-testid={`link-source-${article.id}`}>
            Read source <ArrowUpRight size={14} />
            <ExternalLink size={11} className="opacity-50" />
          </a>
        </div>
      </div>
    </article>
  );
}