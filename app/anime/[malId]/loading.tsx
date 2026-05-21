export default function AnimeDetailLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-outline/30 border-t-transparent"
        aria-hidden
      />
      <p className="text-sm text-muted-foreground">Loading anime details…</p>
    </div>
  );
}
