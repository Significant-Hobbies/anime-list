import { PRODUCTION_API_URL } from '../lib/apiConfig';
import { DEFAULT_ANIME_MIN_MEMBERS, DEFAULT_ANIME_PAGE_SIZE } from '../lib/animeSearchDefaults';
import pages from './data/public-markdown.json';

const ORIGIN = 'https://anime.significanthobbies.com';
type PublicRecord = Record<string, unknown>;
const text = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '';
const label = (value: unknown) =>
  text(value)
    .replace(/[\\[\]]/g, '\\$&')
    .replace(/[\r\n]+/g, ' ');
const field = (name: string, value: unknown) =>
  value == null || value === '' ? '' : `- **${name}:** ${text(value)}\n`;
const names = (value: unknown) => (Array.isArray(value) ? value.map(text).join(', ') : '');

async function publicJson(path: string, body?: object): Promise<PublicRecord> {
  // Deliberately build a new request: no incoming cookies, auth, query or user state.
  const response = await fetch(`${PRODUCTION_API_URL}/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
    redirect: 'manual',
  });
  if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json'))
    throw new Error('Public catalog unavailable');
  const raw = await response.text();
  if (raw.length > 2_000_000) throw new Error('Public catalog response too large');
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('Invalid public catalog response');
  return data;
}

function detailFacts(entry: PublicRecord) {
  return [
    ...Object.entries({
      Type: 'type',
      Score: 'score',
      'Scored by': 'scored_by',
      Rank: 'rank',
      Popularity: 'popularity',
      Status: 'status',
      Members: 'members',
      Favorites: 'favorites',
      Year: 'year',
      Season: 'season',
      Episodes: 'episodes',
      Chapters: 'chapters',
      Volumes: 'volumes',
    }).map(([name, key]) => field(name, entry[key])),
    field('Genres', names(entry.genres)),
    field('Themes', names(entry.themes)),
    field('Demographics', names(entry.demographics)),
    field('Available languages', names(entry.available_languages)),
    field('Available in English', entry.available_in_english),
    field('Colored edition', entry.has_colored),
    field('Completed', entry.is_completed),
  ].join('');
}

function titleLinks(items: unknown, heading: string, kind: string) {
  if (!Array.isArray(items) || !items.length) return '';
  const lines = items.map((item: PublicRecord) => {
    const id = Number(item.mal_id);
    if (!Number.isSafeInteger(id) || id <= 0) return '';
    const target = item.type === 'manga' ? 'manga' : kind;
    return `- [${label(item.title_english || item.title)}](${ORIGIN}/${target}/${id})${item.relation ? ' — ' + text(item.relation) : ''}${item.type ? ' · ' + text(item.type) : ''}${item.year ? ' · ' + text(item.year) : ''}${item.votes != null ? ' · ' + text(item.votes) + ' votes' : ''}`;
  });
  return `\n## ${heading}\n\n${lines.join('\n')}\n`;
}

async function renderPublicDetail(path: string) {
  const match = /^\/(anime|manga)\/(\d+)$/.exec(path);
  if (!match) throw new Error('Invalid public detail path');
  const kind = match[1];
  const data = await publicJson(path);
  const entry = data[kind] as PublicRecord;
  if (!entry || Number(entry.mal_id) !== Number(match[2]) || !entry.title)
    throw new Error('Invalid public detail');
  const title = label(entry.title_english || entry.title);
  return `# ${title}\n\nCanonical: ${ORIGIN}${path}\n\n${entry.title_english && entry.title_english !== entry.title ? text(entry.title) + '\n\n' : ''}${entry.image ? `![${title}](${text(entry.image)})\n\n` : ''}${detailFacts(entry)}\n## Synopsis\n\n${text(entry.synopsis) || 'No synopsis available.'}\n${titleLinks(data.relations, 'Related titles', kind)}${titleLinks(data.recommendations, 'Recommendations', kind)}\n[MyAnimeList](${text(entry.url) || `https://myanimelist.net/${kind}/${match[2]}`}) · [Browse ${kind}](${ORIGIN}${kind === 'anime' ? '/search' : '/manga'})\n`;
}

function statsMarkdown(data: PublicRecord) {
  const sections = Object.entries({
    'Score Distribution': 'scoreDistribution',
    'Members Distribution': 'membersDistribution',
    'Year Distribution': 'yearDistribution',
    'Favorites Distribution': 'favoritesDistribution',
    'Type Distribution': 'typeDistribution',
    'Genre Counts': 'genreCounts',
    'Theme Counts': 'themeCounts',
    'Demographic Counts': 'demographicCounts',
  }).map(([title, key]) => {
    const entries = data[key];
    if (!Array.isArray(entries)) throw new Error('Invalid public statistics');
    return `## ${title}\n\n| Label | Count |\n| --- | --- |\n${entries.map((entry) => `| ${label(entry.range ?? entry.type ?? entry.field)} | ${text(entry.count)} |`).join('\n')}`;
  });
  const percentiles = data.percentiles as Record<string, PublicRecord>;
  if (!percentiles || typeof data.totalAnime !== 'number')
    throw new Error('Invalid public statistics');
  return `Total titles: ${data.totalAnime}\n\n${sections.join('\n\n')}\n\n## Percentiles\n\n${Object.entries(
    percentiles
  )
    .map(
      ([metric, values]) =>
        `### ${metric}\n\n${Object.entries(values)
          .map(([name, val]) => field(name, val))
          .join('')}`
    )
    .join('\n')}\n`;
}

function searchEntry(entry: PublicRecord, kind: string) {
  return `### [${label(entry.title_english || entry.name)}](${ORIGIN}/${kind}/${Number(entry.id)})\n\n${detailFacts(entry)}\n${text(entry.synopsis)}\n`;
}

async function searchMarkdown(kind: 'anime' | 'manga') {
  const min = kind === 'anime' ? DEFAULT_ANIME_MIN_MEMBERS : 50_000;
  const data = await publicJson(kind === 'anime' ? '/search' : '/manga/search', {
    filters: [{ field: 'members', action: 'GREATER_THAN_OR_EQUALS', value: min }],
    pagesize: DEFAULT_ANIME_PAGE_SIZE,
    offset: 0,
    sortBy: 'score',
    airing: 'any',
    hideWatched: [],
    includeWatched: [],
  });
  if (!Array.isArray(data.filteredList) || typeof data.totalFiltered !== 'number')
    throw new Error('Invalid public search');
  return `\n## Default public results\n\n${data.totalFiltered} matching titles; first ${DEFAULT_ANIME_PAGE_SIZE}, sorted by score, at least ${min} members. Query parameters and personal filters are excluded.\n\n${data.filteredList.map((entry: PublicRecord) => searchEntry(entry, kind)).join('\n')}`;
}

export async function renderPublicMarkdown(path: string) {
  if (/^\/(anime|manga)\/\d+$/.test(path)) return renderPublicDetail(path);
  let body = (pages as Record<string, string>)[path];
  if (!body) return null;
  if (path === '/search' || path === '/manga')
    body += await searchMarkdown(path === '/search' ? 'anime' : 'manga');
  if (path === '/stats' || path === '/manga/stats')
    body += '\n' + statsMarkdown(await publicJson(path === '/stats' ? '/stats' : '/manga/stats'));
  if (path === '/') {
    const data = await publicJson('/catalog/counts');
    if (typeof data.anime !== 'number' || typeof data.manga !== 'number')
      throw new Error('Invalid catalog totals');
    body += `\nUnfiltered catalog totals: ${data.anime} anime and ${data.manga} manga.\n`;
  }
  if (path === '/catalog-updates') {
    const data = await publicJson('/changelog?limit=200');
    if (!Array.isArray(data.changes)) throw new Error('Invalid catalog history');
    body +=
      '\n' +
      data.changes
        .map(
          (entry: PublicRecord) =>
            `- ${text(entry.date)} — Added [${label(entry.title_english || entry.title)}](${ORIGIN}/anime/${Number(entry.mal_id)})${entry.type ? ' · ' + text(entry.type) : ''}`
        )
        .join('\n') +
      '\n';
  }
  return body;
}
