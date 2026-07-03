import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Copy, ExternalLink, Plus, Trash2 } from 'lucide-react';
import {
  createCollection,
  deleteCollection,
  getEnrichedWatchlist,
  listMyCollections,
  updateCollection,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import {
  trackCollectionCreated,
  trackCollectionShareClick,
  trackCollectionsViewed,
} from '@/lib/engagement';

export default function CollectionsPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Funnel: viewed -> share clicked -> shared-link visit (fires once per
  // mount, after auth resolves so signed_in is accurate).
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!loading && !viewedRef.current) {
      viewedRef.current = true;
      trackCollectionsViewed(!!user);
    }
  }, [loading, user]);

  const copyShareLink = (slug: string) => {
    trackCollectionShareClick(slug);
    // ?ref=share marks visits from this copied link as shared-link visits.
    const url = `${window.location.origin}/c/${slug}?ref=share`;
    void navigator.clipboard?.writeText(url).then(() => {
      setCopiedSlug(slug);
      window.setTimeout(() => setCopiedSlug((prev) => (prev === slug ? null : prev)), 2000);
    });
  };

  const { data: collectionsData, isLoading } = useQuery({
    queryKey: ['collections', 'mine'],
    queryFn: listMyCollections,
    enabled: !!user,
  });

  const { data: watchlistData } = useQuery({
    queryKey: ['watchlist', 'enriched'],
    queryFn: getEnrichedWatchlist,
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createCollection({
        title,
        description,
        visibility: 'public',
        items: selectedIds.map((mal_id) => ({ mal_id, media_type: 'anime' })),
      }),
    onSuccess: (data) => {
      trackCollectionCreated(data.collection.slug, selectedIds.length);
      setTitle('');
      setDescription('');
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  });

  const watchlistItems = watchlistData?.items ?? [];
  const collections = collectionsData?.collections ?? [];
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-muted-foreground">Loading…</div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Collections</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to publish curated anime lists.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Package watchlist picks into a public, shareable page.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-medium">Create from watchlist</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Collection title"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short description"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="max-h-56 overflow-y-auto rounded-md border border-border p-2 space-y-1">
          {watchlistItems.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">Add titles to your watchlist first.</p>
          ) : (
            watchlistItems.slice(0, 40).map((item) => (
              <label
                key={item.mal_id}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent/40"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(item.mal_id)}
                  onChange={(event) => {
                    setSelectedIds((prev) =>
                      event.target.checked
                        ? [...prev, item.mal_id]
                        : prev.filter((id) => id !== item.mal_id)
                    );
                  }}
                />
                <span className="truncate">{item.title}</span>
              </label>
            ))
          )}
        </div>
        <button
          type="button"
          disabled={!title.trim() || selectedIds.length === 0 || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Publish collection
        </button>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Your collections</h2>
        {isLoading ? (
          <Card className="p-5 text-sm text-muted-foreground">Loading…</Card>
        ) : collections.length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">No collections yet.</Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {collections.map((collection) => (
              <Card key={collection.id} className="p-4 space-y-3">
                <div>
                  <p className="font-medium">{collection.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {collection.description || 'No description'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/c/$slug"
                    params={{ slug: collection.slug }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Public page
                  </Link>
                  <button
                    type="button"
                    onClick={() => copyShareLink(collection.slug)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copiedSlug === collection.slug ? 'Copied' : 'Copy link'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateCollection(collection.id, {
                        visibility: collection.visibility === 'public' ? 'private' : 'public',
                      }).then(() => queryClient.invalidateQueries({ queryKey: ['collections'] }))
                    }
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {collection.visibility === 'public' ? 'Make private' : 'Make public'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(collection.id)}
                    className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent text-destructive"
                    aria-label="Delete collection"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
