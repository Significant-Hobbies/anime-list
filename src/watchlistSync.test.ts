import {
  buildAniListExport,
  buildShelfJsonExport,
  parseAniListJson,
  parseMalAnimeXml,
  parseShelfJson,
  safeParseAniListJson,
  withImportConflicts,
  applyImportMode,
} from './watchlistSync';

describe('watchlist sync', () => {
  it('parses MyAnimeList XML exports into local watch statuses', () => {
    const result = parseMalAnimeXml(`
      <myanimelist>
        <anime>
          <series_animedb_id>1</series_animedb_id>
          <series_title>Cowboy Bebop</series_title>
          <series_type>TV</series_type>
          <series_episodes>26</series_episodes>
          <my_status>Completed</my_status>
          <my_comments>classic</my_comments>
        </anime>
        <anime>
          <series_animedb_id>2</series_animedb_id>
          <my_status>Plan to Watch</my_status>
        </anime>
      </myanimelist>
    `);

    expect(result.entries).toHaveLength(2);
    expect(result.statusCounts).toEqual({ Completed: 1, BRR: 1 });
    expect(result.entries[0]).toMatchObject({
      malId: '1',
      status: 'Completed',
      title: 'Cowboy Bebop',
      episodes: 26,
      note: 'classic',
    });
  });

  it('parses AniList collection JSON and skips rows without MAL ids', () => {
    const result = parseAniListJson(
      JSON.stringify({
        lists: [
          {
            entries: [
              {
                status: 'CURRENT',
                notes: 'rewatch',
                media: {
                  idMal: 5114,
                  title: { english: 'Fullmetal Alchemist: Brotherhood' },
                  format: 'TV',
                  episodes: 64,
                },
              },
              { status: 'COMPLETED', media: { idMal: null } },
            ],
          },
        ],
      })
    );

    expect(result.entries).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.entries[0]).toMatchObject({
      malId: '5114',
      status: 'Watching',
      note: 'rewatch',
    });
  });

  it('rejects invalid AniList JSON without throwing', () => {
    expect(safeParseAniListJson('{not-json')).toEqual({
      ok: false,
      error: 'Invalid AniList JSON payload',
    });
  });

  it('exports local watchlist rows as AniList status rows', () => {
    const rows = buildAniListExport({
      '1': { id: '1', status: 'Completed', note: 'done' },
      '2': { id: '2', status: 'Done' },
      '3': { id: '3', status: 'BRR' },
    });

    expect(rows).toEqual([
      { mediaIdMal: 1, status: 'COMPLETED', notes: 'done' },
      { mediaIdMal: 2, status: 'COMPLETED', notes: '' },
      { mediaIdMal: 3, status: 'PLANNING', notes: '' },
    ]);
  });

  it('parses Anime List JSON backups and detects import conflicts', () => {
    const preview = parseShelfJson(
      JSON.stringify({
        version: 1,
        anime: [{ mal_id: '1', status: 'Watching', title: 'Bebop' }],
      })
    );
    const resolved = withImportConflicts(preview, {
      '1': { id: '1', status: 'Done', title: 'Bebop' },
    });
    expect(resolved.conflicts).toHaveLength(1);
    expect(applyImportMode(resolved, { '1': { id: '1', status: 'Done' } }, 'merge')).toHaveLength(
      0
    );
    expect(buildShelfJsonExport({ '1': { id: '1', status: 'Watching' } }).anime).toHaveLength(1);
  });
});
