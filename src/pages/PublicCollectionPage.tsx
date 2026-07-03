import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { getPublicCollection } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { trackCollectionViewed, trackCollectionPublicViewed } from '@/lib/engagement';

export default function PublicCollectionPage() {
  const { slug } = useParams({ from: '/app/c/$slug' });
  const { data, isLoading, error } = useQuery({
    queryKey: ['collection', slug],
    queryFn: () => getPublicCollection(slug),
  });

  // Fires once per mount after the collection resolves (404s don't count).
  // via_share=true when the visit came through a copied ?ref=share link.
  const viewedRef = useRef(false);
  useEffect(() => {
    if (data && !viewedRef.current) {
      viewedRef.current = true;
      const viaShare = new URLSearchParams(window.location.search).get('ref') === 'share';
      trackCollectionViewed(slug, viaShare);
      trackCollectionPublicViewed(slug, viaShare);
    }
  }, [data, slug]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-sm text-muted-foreground">
        Loading collection…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Collection not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This collection may be private or removed.
          </p>
          <Link to="/search" className="mt-4 inline-block text-sm text-primary hover:underline">
            Browse search
          </Link>
        </Card>
      </div>
    );
  }

  const { collection, items } = data;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Public collection</p>
        <h1 className="text-3xl font-semibold tracking-tight">{collection.title}</h1>
        {collection.description && (
          <p className="max-w-2xl text-sm text-muted-foreground">{collection.description}</p>
        )}
        <div className="flex gap-3 pt-2">
          <Link to="/search" className="text-sm font-medium text-primary hover:underline">
            Discover more
          </Link>
          <Link to="/watchlist" className="text-sm text-muted-foreground hover:text-foreground">
            Your watchlist
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <Link
            key={item.id}
            to="/anime/$malId"
            params={{ malId: item.mal_id }}
            className="group rounded-xl border border-border overflow-hidden hover:border-primary/40 transition-colors"
          >
            {item.image ? (
              <img
                src={item.image}
                alt=""
                className="aspect-[2/3] w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="aspect-[2/3] bg-muted" />
            )}
            <div className="p-3">
              <p className="text-sm font-medium line-clamp-2 group-hover:text-primary">
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {item.score != null ? `${item.score}` : '—'}
                {item.year ? ` · ${item.year}` : ''}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
