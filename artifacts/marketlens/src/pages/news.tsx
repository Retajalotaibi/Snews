import { Clock3, Newspaper, Radio } from 'lucide-react';
import { useGetNews, getGetNewsQueryKey } from '@workspace/api-client-react';
import { NewsCard } from '@/components/news-card';
import { QueryEmpty, QueryError, QueryLoading } from '@/components/query-states';

export default function News() {
  const newsQuery = useGetNews({ limit: 8 }, { query: { queryKey: getGetNewsQueryKey({ limit: 8 }), refetchInterval: 120_000 } });
  const response = newsQuery.data;
  return (
    <div className="space-y-9">
      <section className="reveal flex flex-col justify-between gap-6 border-b pb-8 md:flex-row md:items-end">
        <div><div className="mb-4 flex items-center gap-2 font-data text-[10px] font-medium uppercase tracking-[.18em] text-primary"><Newspaper size={13} /> The news desk</div><h1 className="font-editorial text-5xl font-semibold leading-[.92] md:text-7xl">Headlines,<br /><span className="text-primary">decoded.</span></h1><p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">Rules-based impact notes for the stories that can move oil, gold, stocks, and inflation expectations.</p></div>
        {response ? <div className="font-data text-[10px] uppercase tracking-[.14em] text-muted-foreground md:text-right"><div className="flex items-center gap-2 md:justify-end"><Radio size={12} className="text-primary" /> Feed refreshed</div><p className="mt-1 text-foreground">{new Date(response.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p></div> : null}
      </section>
      {newsQuery.isLoading ? <QueryLoading label="Scanning the newswire" /> : newsQuery.isError ? <QueryError onRetry={() => newsQuery.refetch()} label="The news feed is temporarily unavailable." /> : !response || !response.articles?.length ? <QueryEmpty label="No current headlines match this desk." /> : (
        <section>
          <div className="mb-5 flex items-center justify-between"><p className="font-data text-[10px] uppercase tracking-[.16em] text-muted-foreground">{response.articles.length} stories in view</p><p className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Clock3 size={13} /> Plain-English impact, not predictions</p></div>
          {response.articles.length < 8 ? <div className="mb-5 rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 text-xs leading-5 text-muted-foreground" data-testid="status-partial-news">This feed returned a partial set of stories. The context below reflects only what is currently available.</div> : null}
          <div className="grid gap-4 md:grid-cols-2">{response.articles.map((article, index) => <NewsCard key={article.id} article={article} featured={index === 0} />)}</div>
        </section>
      )}
    </div>
  );
}