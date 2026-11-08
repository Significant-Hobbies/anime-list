export const CATALOG_PAGE_SIZE = 200;

export function catalogPages(anime, manga) {
  return [
    { path: '/catalog', title: 'Anime and manga title catalog', kind: null, page: 0 },
    ...[
      ['anime', anime],
      ['manga', manga],
    ].flatMap(([kind, entries]) =>
      Array.from({ length: Math.ceil(entries.length / CATALOG_PAGE_SIZE) }, (_, index) => ({
        path: `/catalog/${kind}/${index + 1}`,
        title: `${kind === 'anime' ? 'Anime' : 'Manga'} title catalog — page ${index + 1}`,
        kind,
        page: index + 1,
      }))
    ),
  ];
}
