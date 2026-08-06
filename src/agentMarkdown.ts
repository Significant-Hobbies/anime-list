import type { SeoEntry, SeoKind } from './seoRewrite';

const ORIGIN = 'https://anime.significanthobbies.com';

function line(label: string, value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? null : `- **${label}:** ${value}`;
}

export function renderDetailMarkdown(entry: SeoEntry, kind: SeoKind): string {
  const kindLabel = kind === 'anime' ? 'Anime' : 'Manga';
  const facts = [
    line('Type', entry.type),
    line('Score', entry.score ? `${entry.score} / 10` : null),
    line('Scored by', entry.scoredBy?.toLocaleString()),
    line('Year', entry.year),
    line('Genres', entry.genres.join(', ')),
    line('Episodes', kind === 'anime' ? entry.episodes : null),
    line('Chapters', kind === 'manga' ? entry.chapters : null),
    line('Volumes', kind === 'manga' ? entry.volumes : null),
  ].filter(Boolean);

  return `# ${entry.title}

${entry.titleEnglish ? `**English title:** ${entry.titleEnglish}\n\n` : ''}${entry.synopsis || `No synopsis is currently available for this ${kind}.`}

## ${kindLabel} facts

${facts.join('\n')}

## Links

- [HTML detail page](${ORIGIN}/${kind}/${entry.id})
- [${kindLabel} discovery](${ORIGIN}/${kind === 'anime' ? 'search' : 'manga'})
- [Anime List by Significant Hobbies home](${ORIGIN}/)
`;
}

export function markdownResponse(body: string, status = 200) {
  return new Response(body.trimEnd() + '\n', {
    status,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=86400',
    },
  });
}
