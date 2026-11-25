import {
  centroid,
  encode,
  indexedRow,
  keywordHits,
  queryTropes,
  relevance,
  titleTropes,
  vectorFor,
} from './discoveryEmbedding';
import { fold, keyFor, type Account, type Entry, type Title } from './discoveryCatalog';
import type { Filters, Media, Preferences } from './discoverySchemas';

const includes = (values: string[], needle: string) => values.some((v) => fold(v) === fold(needle));
const hits = (wanted: string[] | undefined, values: string[]) =>
  (wanted ?? []).filter((v) => includes(values, v));
const containsAll = (wanted: string[] | undefined, values: string[]) =>
  (wanted ?? []).every((v) => includes(values, v));
const statusAliases: Record<string, string> = {
  completed: 'done',
  deferred: 'delaying',
  avoiding: 'dropped',
  reading: 'watching',
  'plan to watch': 'delaying',
};
const statusKey = (status: string) =>
  Object.hasOwn(statusAliases, fold(status)) ? statusAliases[fold(status)] : fold(status);
function languageKey(lang: string) {
  const value = fold(lang);
  if (['jp', 'ja', 'jpn', 'japanese'].includes(value)) return 'japanese';
  if (['en', 'eng', 'english'].includes(value)) return 'english';
  return value;
}
export function allowsEntry(entry: Entry | undefined, filters: Filters) {
  if (entry) {
    const status = statusKey(entry.status);
    if (
      (filters.exclude_watch_statuses ?? ['Done', 'Dropped']).some((s) => statusKey(s) === status)
    )
      return false;
    if (
      filters.include_watch_statuses?.length &&
      !filters.include_watch_statuses.some((s) => statusKey(s) === status)
    )
      return false;
  } else if (
    filters.include_unlisted === false ||
    (filters.include_watch_statuses?.length && filters.include_unlisted !== true)
  )
    return false;
  return ratingAllowed(entry?.rating, filters);
}

function ratingAllowed(rating: number | null | undefined, filters: Filters) {
  if (filters.min_user_rating !== undefined && (rating == null || rating < filters.min_user_rating))
    return false;
  if (filters.max_user_rating !== undefined && (rating == null || rating > filters.max_user_rating))
    return false;
  return true;
}
function allowsTags(title: Title, tropes: string[], userTags: string[], filters: Filters) {
  const allTags = [...title.genres, ...title.themes, ...title.demographics, ...tropes, ...userTags];
  return (
    containsAll(filters.genres, title.genres) &&
    containsAll(filters.themes, title.themes) &&
    containsAll(filters.tropes, tropes) &&
    containsAll(filters.include_tags, allTags) &&
    hits(filters.exclude_tags, allTags).length === 0 &&
    (!filters.language ||
      title.languages.some((x) => languageKey(x) === languageKey(filters.language!)))
  );
}

export function historyVector(account: Account) {
  const inputs: { vector: Int8Array; weight: number }[] = [];
  const keys = new Set([...account.feedback.keys(), ...account.library.keys()]);
  for (const key of keys) {
    const [media, id] = key.split(':');
    const row = indexedRow(media as Media, Number(id));
    if (row === undefined) continue;
    const feedback = account.feedback.get(key);
    const entry = account.library.get(key);
    let weight = entry?.status === 'Done' ? 0.25 : 0;
    if (entry?.rating != null) weight = (entry.rating - 6) / 4;
    if (feedback === 'like') weight = 1.4;
    if (feedback === 'dislike' || feedback === 'dismiss') weight = -1.4;
    if (weight) inputs.push({ vector: vectorFor(row), weight });
    if (inputs.length === 100) break;
  }
  return centroid(inputs);
}

export function makeQuery(text: string, seeds: Title[], account: Account) {
  const tropes = queryTropes(text);
  const embedding = encode([text, ...tropes].join(' '));
  const vectors: { vector: ArrayLike<number>; weight: number }[] = [];
  if (embedding.vector) vectors.push({ vector: embedding.vector, weight: 1 });
  for (const seed of seeds) {
    const row = indexedRow(seed.media_type, seed.mal_id);
    const vector =
      row === undefined
        ? encode([seed.synopsis, ...seed.genres, ...seed.themes].join(' ')).vector
        : vectorFor(row);
    if (vector) vectors.push({ vector, weight: 1 });
  }
  return {
    text: fold(text),
    textTokens: new Set(fold(text).split(/[^\p{L}\p{N}-]+/u)),
    tropes,
    words: embedding.words,
    vector: centroid(vectors),
    history: historyVector(account),
    seedIds: new Set(seeds.map((seed) => keyFor(seed.media_type, seed.mal_id))),
    seedTags: Array.from(new Set(seeds.flatMap((s) => [...s.genres, ...s.themes]))),
  };
}
type Query = ReturnType<typeof makeQuery>;

function preferred(title: Title, tropes: string[], prefs: Preferences) {
  const selected = [
    ...hits(prefs.genres, title.genres),
    ...hits(prefs.themes, title.themes),
    ...hits(prefs.tropes, tropes),
  ];
  const avoided = [
    ...hits(prefs.avoid_genres, title.genres),
    ...hits(prefs.avoid_themes, title.themes),
    ...hits(prefs.avoid_tropes, tropes),
  ];
  const length = title.episodes ?? title.chapters ?? 0;
  const lengthBonus = prefs.prefer_longer_series ? Math.min(0.13, Math.log1p(length) * 0.022) : 0;
  const languageBonus =
    prefs.language && title.languages.some((l) => languageKey(l) === languageKey(prefs.language!))
      ? 0.14
      : 0;
  return {
    selected,
    score:
      Math.min(0.4, selected.length * 0.12) -
      Math.min(0.6, avoided.length * 0.22) +
      lengthBonus +
      languageBonus,
  };
}

function textRelevance(title: Title, row: number | undefined, tropes: string[], query: Query) {
  const names = [title.title, title.title_english, ...title.alternative_titles]
    .filter((t): t is string => Boolean(t))
    .map(fold);
  const exact = Boolean(query.text) && names.includes(query.text);
  const titleMatch = Boolean(query.text) && names.some((t) => t.includes(query.text));
  const tags = [...title.genres, ...title.themes, ...title.demographics];
  const literalTags = tags.filter((t) => query.textTokens.has(fold(t)));
  const matchedTropes = hits(query.tropes, tropes);
  const vector =
    row !== undefined
      ? vectorFor(row)
      : encode([title.synopsis, ...tags, title.title].join(' ')).vector;
  const similarity = relevance(query.vector, vector);
  const affinity = relevance(query.history, vector) ?? 0;
  const seedMatch = query.seedTags.length
    ? hits(query.seedTags, tags).length / query.seedTags.length
    : 0;
  const keywords = row !== undefined ? keywordHits(query.words, row) : 0;
  const lexical =
    (exact ? 2 : titleMatch ? 0.65 : 0) +
    Math.min(0.36, keywords * 0.1) +
    Math.min(0.35, literalTags.length * 0.16);
  const tropeScore = query.tropes.length ? (matchedTropes.length / query.tropes.length) * 0.75 : 0;
  const relevanceScore = (similarity ?? 0) * 0.9 + lexical + tropeScore + seedMatch * 0.23;
  return { exact, matchedTropes, literalTags, similarity, affinity, relevanceScore };
}
export function rankTitle(
  title: Title,
  account: Account,
  query: Query,
  filters: Filters,
  prefs: Preferences
) {
  const key = keyFor(title.media_type, title.mal_id);
  const signal = account.feedback.get(key);
  if (
    query.seedIds.has(key) ||
    account.dismissed.has(key) ||
    signal === 'dismiss' ||
    signal === 'dislike'
  )
    return null;
  const entry = account.library.get(key);
  if (!allowsEntry(entry, filters)) return null;
  const row = indexedRow(title.media_type, title.mal_id);
  const tropes = titleTropes(row, title.synopsis ?? '', [...title.genres, ...title.themes]);
  if (!allowsTags(title, tropes, entry?.tags ?? [], filters)) return null;
  const match = textRelevance(title, row, tropes, query);
  if ((query.text || query.seedIds.size) && match.relevanceScore < 0.12) return null;
  const pref = preferred(title, tropes, prefs);
  const taste = match.affinity * 0.24 + pref.score + (signal === 'like' ? 0.18 : 0);
  const quality =
    ((title.score ?? 0) / 10) * 0.25 + Math.min(0.12, Math.log1p(title.members ?? 0) * 0.007);
  const reasons = [...match.matchedTropes, ...match.literalTags, ...pref.selected];
  if (match.exact) reasons.unshift('Exact title');
  if ((match.similarity ?? 0) > 0.35) reasons.push('Similar synopsis');
  if (match.affinity > 0.25) reasons.push('Matches your library or feedback');
  return {
    media: title.media_type,
    id: title.mal_id,
    points: match.relevanceScore + taste + quality,
    semantic: match.similarity,
    reasons: [...new Set(reasons)].slice(0, 5),
    tropes,
  };
}
