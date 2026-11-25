import WatchlistView from '@/components/WatchlistView';

export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Watchlist</h1>
      <WatchlistView />
    </div>
  );
}
