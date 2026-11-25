import AnimeIdentityQuiz from '@/components/AnimeIdentityQuiz';

export default function DiscoverPage() {
  return (
    <div className="mx-auto max-w-2xl py-4 sm:py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
          Find your anime archetype
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Answer four private questions, then explore your results in anime search.
        </p>
      </header>
      <AnimeIdentityQuiz />
    </div>
  );
}
