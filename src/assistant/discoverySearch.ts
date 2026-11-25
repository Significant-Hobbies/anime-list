import { pageMetadata } from './pagination';
import {
  accountSignals,
  franchiseLabels,
  candidatePages,
  detailsFor,
  keyFor,
  mediaList,
  resolveName,
  type Title,
  type Account,
} from './discoveryCatalog';
import { catalogRevision } from './discoveryCache';
import { retrievalModel } from './discoveryEmbedding';
import { makeQuery, rankTitle } from './discoveryRank';
import type { DiscoverInput, Filters, Media, Seed } from './discoverySchemas';
import { owner, savedPreferences } from './discoveryState';
import { AssistantError } from './tool';

type Match = NonNullable<ReturnType<typeof rankTitle>>;
const descending = (a: Match, b: Match) =>
  b.points - a.points || a.media.localeCompare(b.media) || a.id - b.id;
const round = (x: number) => Math.round(x * 10000) / 10000;
async function resolveSeeds(ids: Seed[], query: string, choice: Media | 'both') {
  const seeds = new Map<string, Title>();
  for (const media of ['anime', 'manga'] as const) {
    const requested = ids.filter((s) => s.media_type === media);
    const rows = await detailsFor(
      media,
      requested.map((s) => s.mal_id)
    );
    for (const row of rows) seeds.set(keyFor(media, row.mal_id), row);
    if (requested.some((s) => !seeds.has(keyFor(media, s.mal_id))))
      throw new AssistantError('not_found', 'A requested seed title was not found.');
  }
  const similar = query.match(/^(?:titles?\s+)?(?:similar to|like)\s+(.+)$/i);
  if (similar) {
    const names = similar[1].split(/\s+(?:and|&)\s+|\s*,\s*/i).filter(Boolean);
    if (names.length > 6)
      throw new AssistantError('invalid_argument', 'Use at most six seed titles.');
    for (const name of names) {
      const row = await resolveName(name, choice);
      if (!row)
        throw new AssistantError(
          'not_found',
          `No catalog title matched "${name}". Supply its MAL ID in similar_to.`
        );
      seeds.set(keyFor(row.media_type, row.mal_id), row);
    }
  }
  return { seeds: [...seeds.values()], text: similar ? '' : query };
}

function validateBounds(filters: Filters) {
  const fields = [
    'score',
    'year',
    'episodes',
    'chapters',
    'members',
    'popularity',
    'user_rating',
  ] as const;
  for (const field of fields) {
    const min = filters[`min_${field}`],
      max = filters[`max_${field}`];
    if (min !== undefined && max !== undefined && min > max)
      throw new AssistantError('invalid_argument', `min_${field} exceeds max_${field}.`);
  }
}
function checkAccess(args: DiscoverInput, userId: string, allowPublic: boolean) {
  if (!allowPublic) owner(userId);
  const accountFilters = [
    'include_watch_statuses',
    'exclude_watch_statuses',
    'include_unlisted',
    'min_user_rating',
    'max_user_rating',
  ];
  if (
    !userId &&
    (args.use_saved_preferences === true || accountFilters.some((k) => k in args.filters))
  ) {
    throw new AssistantError(
      'invalid_argument',
      'Account filters require a connected account. Use discover_titles after connecting.'
    );
  }
}
export async function discover(args: DiscoverInput, userId: string, allowPublic = false) {
  checkAccess(args, userId, allowPublic);
  const emptyAccount: Account = { library: new Map(), feedback: new Map(), dismissed: new Set() };
  const [saved, account, seedQuery, revision] = await Promise.all([
    userId && args.use_saved_preferences !== false ? savedPreferences(userId) : null,
    userId ? accountSignals(userId) : emptyAccount,
    resolveSeeds(args.similar_to, args.query ?? '', args.media_type),
    catalogRevision(),
  ]);
  const filters = { ...saved?.hard_filters, ...args.filters };
  validateBounds(filters);
  if (filters.franchise && !filters.franchise_id) {
    const seed = await resolveName(filters.franchise, filters.franchise_media_type ?? 'both');
    if (!seed) throw new AssistantError('not_found', 'Franchise seed title not found.');
    filters.franchise_id = seed.mal_id;
    filters.franchise_media_type = seed.media_type;
  }
  const prefs = { ...saved?.preferences, ...args.preferences };
  const query = await makeQuery(seedQuery.text, seedQuery.seeds, account);
  let total = 0;
  let best: Match[] = [];
  for (const media of mediaList(args.media_type)) {
    for await (const page of candidatePages(media, filters, revision)) {
      const matched = page.flatMap((title) => {
        const item = rankTitle(title, account, query, filters, prefs);
        return item ? [item] : [];
      });
      total += matched.length;
      best = best
        .concat(matched)
        .sort(descending)
        .slice(0, args.offset + args.limit);
    }
  }
  const page = best.slice(args.offset);
  const details = await Promise.all(
    mediaList(args.media_type).map((media) =>
      detailsFor(
        media,
        page.filter((t) => t.media === media).map((t) => t.id)
      )
    )
  );
  const lookup = new Map(details.flat().map((row) => [keyFor(row.media_type, row.mal_id), row]));
  const franchises = await franchiseLabels(page);
  const results = page.flatMap((match) => {
    const key = keyFor(match.media, match.id),
      title = lookup.get(key);
    if (!title) return [];
    const entry = account.library.get(key);
    return [
      {
        ...title,
        semantic_source: title.document.source,
        synopsis:
          !args.include_full_synopsis && (title.synopsis?.length ?? 0) > 350
            ? title.synopsis!.slice(0, 349).trimEnd() + '…'
            : title.synopsis,
        canonical_url: `https://anime.significanthobbies.com/${match.media}/${match.id}`,
        tropes: match.tropes,
        ranking_score: round(match.points),
        semantic_relevance: match.semantic === null ? null : round(match.semantic),
        reasons: match.reasons,
        user_status: entry?.status ?? null,
        user_rating: entry?.rating ?? null,
        user_tags: entry?.tags ?? [],
        franchise: franchises.get(key) ?? null,
      },
    ];
  });
  return {
    results,
    ...pageMetadata(total, args.offset, args.limit, results.length, page.length),
    resolved_seeds: seedQuery.seeds.map((s) => ({
      media_type: s.media_type,
      mal_id: s.mal_id,
      title: s.title,
    })),
    retrieval: {
      ...retrievalModel,
      query_has_embedding: Boolean(query.vector),
      fallback:
        'Changed and new titles use their current synopsis. Titles without a usable synopsis use available tags and title words. Unknown metadata cannot satisfy hard filters.',
    },
  };
}
