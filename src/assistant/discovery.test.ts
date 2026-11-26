// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setDbClient, type DatabaseStatement } from '../db/client';
import { discoveryTools } from './discoveryTools';
import { encode, indexedRow, relevance, retrievalModel, vectorFor } from './discoveryEmbedding';

let db: DatabaseSync;
let catalogReads = 0;
function call(name: string, args: unknown, userId = 'alice') {
  const tool = discoveryTools.find((t) => t.name === name)!;
  return tool.execute(args, { userId, env: {} }) as Promise<any>;
}
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  for (const migration of [
    '0001_initial',
    '0002_anime_search_indexes',
    '0003_watching_schedule',
    '0004_assistant_library',
    '0005_assistant_discovery',
    '0006_assistant_franchises',
    '0008_catalog_title_metadata',
    '0009_assistant_discovery_cache',
    '0014_discovery_franchise_cache',
  ]) {
    db.exec(readFileSync(new URL(`../../migrations/d1/${migration}.sql`, import.meta.url), 'utf8'));
  }
  const execute = async (statement: DatabaseStatement) => {
    const { sql, args = [] } = typeof statement === 'string' ? { sql: statement } : statement;
    if (sql.includes('WHERE c.mal_id>?')) catalogReads++;
    return { rows: db.prepare(sql).all(...(args as SQLInputValue[])), rowsAffected: 0 };
  };
  setDbClient({ execute, batch: (stmts) => Promise.all(stmts.map(execute)) });
  const add = (
    media: string,
    id: number,
    title: string,
    score: number,
    tags: string,
    synopsis: string,
    count: number
  ) => {
    db.prepare(
      `INSERT INTO ${media}_data(mal_id,title,title_english,url,genres,themes,score,year,synopsis,${media === 'anime' ? 'episodes' : 'chapters'},members,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      id,
      title,
      title,
      `https://myanimelist.net/${media}/${id}`,
      tags,
      '{}',
      score,
      2023,
      synopsis,
      count,
      100000,
      'Finished'
    );
  };
  add(
    'anime',
    910001,
    'Unassuming Mage',
    8,
    '{"Fantasy":1}',
    'At a magic academy, a wizard is unaware of his own strength and grows stronger.',
    26
  );
  add(
    'anime',
    910002,
    'Guild Quartermaster',
    9,
    '{"Fantasy":1}',
    'A guild master grows stronger with every quest in an MMORPG.',
    120
  );
  add(
    'anime',
    910003,
    'Racing Dreams',
    9.8,
    '{"Sports":1}',
    'An aspiring runner competes at the national sprint meet.',
    12
  );
  add(
    'manga',
    910001,
    'Kingdom Council',
    8.8,
    '{"Fantasy":1}',
    'A reincarnated king must rebuild the kingdom, facing political intrigue in a parallel world.',
    60
  );
  add(
    'manga',
    910004,
    'Hoop Club',
    7,
    '{"Sports":1}',
    'A team of school basketball players plays in a local league.',
    80
  );
});
afterEach(() => db.close());

describe('assistant discovery', () => {
  it('uses actual trained synopsis embeddings for both media and unseen query text', () => {
    expect(retrievalModel.indexed_anime).toBeGreaterThan(14000);
    expect(retrievalModel.indexed_manga).toBeGreaterThan(19000);
    const cowboy = indexedRow('anime', 1)!;
    const query = encode('bounty hunters in space aboard a spaceship');
    expect(relevance(query.vector, vectorFor(cowboy))).toBeGreaterThan(0.2);
    expect(encode('qzxwjv').vector).toBeNull();
  });
  it('requires fantasy intent before boosting serious fantasy', async () => {
    db.exec(`UPDATE anime_data SET title='Fixture',title_english='Fixture',score=8,synopsis=NULL,episodes=12
             WHERE mal_id IN (910001,910003);
             UPDATE anime_data SET genres='{"Fantasy":1,"Drama":1}' WHERE mal_id=910001`);
    async function first(query: string) {
      const results = await call(
        'semantic_search',
        { media_type: 'anime', query, filters: { title: 'Fixture' } },
        ''
      );
      return results.results[0].mal_id;
    }
    expect(await first('serious sports')).toBe(910003);
    expect(await first('serious fantasy')).toBe(910001);
  });
  it('ranks unseen titles using live synopsis vectors, keyword and trope evidence', async () => {
    const search = await call('semantic_search', {
      query: 'OP protagonist unaware of strength at a magical academy',
      media_type: 'anime',
    });
    expect(search.results[0]).toMatchObject({
      mal_id: 910001,
      tropes: expect.arrayContaining(['Unaware of own strength', 'Magical academy']),
      semantic_relevance: expect.any(Number),
    });
    expect(search.results[0].semantic_relevance).toBeGreaterThan(0);
    const seeds = await call('get_similar_titles', {
      seed: { media_type: 'anime', mal_id: 910001 },
      media_type: 'both',
    });
    expect(seeds.resolved_seeds[0].mal_id).toBe(910001);
    expect(seeds.results.every((r: any) => r.media_type !== 'anime' || r.mal_id !== 910001)).toBe(
      true
    );
    expect(seeds.results.some((r: any) => r.media_type === 'manga')).toBe(true);
  });
  it('excludes each owner’s Done/Dropped titles and applies overrides and paging to both media', async () => {
    db.exec(`INSERT INTO user_tags(id,user_id,name) VALUES ('completed','alice','Completed'),('dropped','alice','Avoiding');
      INSERT INTO anime_watchlist(user_id,mal_id,tag_id) VALUES ('alice','910001','completed');
      INSERT INTO manga_watchlist(user_id,mal_id,tag_id) VALUES ('alice','910001','dropped');`);
    const first = await call('discover_titles', { limit: 2 });
    expect(first.total).toBe(3);
    expect(first.next_offset).toBe(2);
    const second = await call('discover_titles', { limit: 2, offset: first.next_offset });
    expect(second.next_offset).toBeNull();
    expect([...first.results, ...second.results].map((r) => r.mal_id)).not.toContain(910001);
    expect((await call('discover_titles', {}, 'bob')).total).toBe(5);
    await call('update_user_preferences', {
      hard_filters: { min_score: 8, genres: ['Fantasy'] },
      preferences: { prefer_longer_series: true },
    });
    const saved = await call('discover_titles', {});
    expect(saved.results.map((r: any) => r.mal_id)).toEqual([910002]);
    const overridden = await call('discover_titles', { filters: { genres: ['Sports'] } });
    expect(overridden.results.map((r: any) => r.mal_id)).toEqual([910003]);
    const listed = await call('discover_titles', {
      filters: { exclude_watch_statuses: [], include_unlisted: false },
    });
    expect(listed.results.map((r: any) => r.user_status).sort()).toEqual(['Done', 'Dropped']);
    expect((await call('get_user_preferences', {}, 'bob')).hard_filters).toEqual({});
  });
  it('searches public alias and studio metadata and rejects account filters without identity', async () => {
    db.exec(`INSERT INTO catalog_title_metadata(media,mal_id,aliases,studios)
      VALUES ('anime',910001,'["魔法学校","Spell School"]','["Studio Test"]')`);
    const result = await call(
      'semantic_search',
      { query: '魔法学校', filters: { studio: 'Studio Test', title: '魔法学校' } },
      ''
    );
    expect(result.results[0]).toMatchObject({
      mal_id: 910001,
      alternative_titles: ['魔法学校', 'Spell School'],
      studios: ['Studio Test'],
      user_status: null,
    });
    const similar = await call(
      'get_similar_titles',
      { seed: { media_type: 'anime', mal_id: 910001 } },
      ''
    );
    expect(similar.results.length).toBeGreaterThan(0);
    await expect(
      call('semantic_search', { query: 'fantasy', filters: { include_unlisted: true } }, '')
    ).rejects.toMatchObject({ code: 'invalid_argument' });
    await expect(
      call('semantic_search', { query: 'fantasy', use_saved_preferences: true }, '')
    ).rejects.toMatchObject({ code: 'invalid_argument' });
  });
  it('uses indexed franchise edges across media and resolves multiple source titles by name', async () => {
    db.exec(`INSERT INTO assistant_franchise_edges (source_id,relation,target_type,target_id,target_title)
      VALUES (910001,'adaptation','manga',910001,'Kingdom Council')`);
    const result = await call('discover_titles', { filters: { franchise_id: 910001 } });
    expect(result.results.map((r: any) => r.media_type).sort()).toEqual(['anime', 'manga']);
    expect(result.results.map((r: any) => r.franchise.franchise_id)).toEqual([
      'anime:910001',
      'anime:910001',
    ]);
    const related = await call(
      'semantic_search',
      { query: 'similar to Unassuming Mage and Kingdom Council' },
      ''
    );
    expect(related.resolved_seeds.map((r: any) => r.media_type)).toEqual(['anime', 'manga']);
    expect(related.results.map((r: any) => r.mal_id)).not.toContain(910001);
  });
  it('reads current franchise membership and labels without flushing unrelated catalogs', async () => {
    const args = { media_type: 'anime' };
    const franchise = { filters: { franchise_id: 910001 } };
    await call('discover_titles', args);
    expect((await call('discover_titles', franchise)).total).toBe(1);
    const before = catalogReads;
    db.exec(`INSERT INTO assistant_franchise_edges (source_id,relation,target_type,target_id,target_title)
      VALUES (910001,'adaptation','manga',910001,'Kingdom Council')`);
    const page = await call('discover_titles', args);
    expect(catalogReads).toBe(before);
    expect(page.results.find((r: any) => r.mal_id === 910001).franchise.franchise_id).toBe(
      'anime:910001'
    );
    expect((await call('discover_titles', franchise)).total).toBe(2);
  });
  it('reuses catalog reads across accounts and invalidates them on catalog or alias changes', async () => {
    catalogReads = 0;
    const args = { media_type: 'anime', filters: { min_score: 9 } };
    expect((await call('discover_titles', args)).total).toBe(2);
    const cold = catalogReads;
    expect(cold).toBeGreaterThan(0);
    expect((await call('discover_titles', args, 'bob')).total).toBe(2);
    expect(catalogReads).toBe(cold);
    db.exec('UPDATE anime_data SET score=7 WHERE mal_id=910002');
    expect((await call('discover_titles', args)).total).toBe(1);
    expect(catalogReads).toBeGreaterThan(cold);
    const studio = { filters: { studio: 'Studio Z' } };
    expect((await call('discover_titles', studio)).total).toBe(0);
    db.exec(
      `INSERT INTO catalog_title_metadata (media,mal_id,studios) VALUES ('anime',910001,'["Studio Z"]')`
    );
    expect((await call('discover_titles', studio)).total).toBe(1);
  });
  it('uses feedback for newly cataloged titles as a ranking signal in subsequent searches', async () => {
    const args = { media_type: 'anime' };
    const before = await call('discover_titles', args);
    const original = before.results.find((r: any) => r.mal_id === 910002).ranking_score;
    await call('record_recommendation_feedback', {
      media_type: 'anime',
      mal_id: 910001,
      signal: 'like',
    });
    const after = await call('discover_titles', args);
    const guild = after.results.find((r: any) => r.mal_id === 910002);
    expect(guild.ranking_score).toBeGreaterThan(original);
    expect(
      (await call('discover_titles', args, 'bob')).results.find((r: any) => r.mal_id === 910002)
        .ranking_score
    ).toBe(original);
  });
  it('returns compact synopses with product links and expands only when requested', async () => {
    const synopsis = 'A magical academy. '.repeat(40);
    db.prepare('UPDATE anime_data SET synopsis=? WHERE mal_id=910001').run(synopsis);
    const filter = { filters: { title: 'Unassuming Mage' } };
    const compact = (await call('discover_titles', filter)).results[0];
    expect(compact.synopsis.length).toBeLessThanOrEqual(350);
    expect(compact.canonical_url).toBe('https://anime.significanthobbies.com/anime/910001');
    expect(
      (await call('discover_titles', { ...filter, include_full_synopsis: true })).results[0]
        .synopsis
    ).toBe(synopsis);
  });
  it('validates a trained title against the live synopsis and reprojects same-length edits', async () => {
    const title = JSON.parse(
      readFileSync(new URL('../../cleaned_anime_data.json', import.meta.url), 'utf8')
    )[0];
    db.prepare(
      'INSERT INTO anime_data(mal_id,title,title_english,url,synopsis,genres,themes,demographics,score) VALUES(?,?,?,?,?,?,?,?,?)'
    ).run(
      title.mal_id,
      title.title,
      title.title_english,
      title.url,
      title.synopsis,
      JSON.stringify(title.genres),
      JSON.stringify(title.themes),
      JSON.stringify(title.demographics),
      title.score
    );
    const filter = { media_type: 'anime', filters: { title: title.title } };
    expect((await call('discover_titles', filter)).results[0].semantic_source).toBe(
      'indexed-synopsis'
    );
    const plot =
      'A magical academy and a wizard who is unaware of his own strength, politics and war. ';
    const newSynopsis = plot
      .repeat(Math.ceil(title.synopsis.length / plot.length))
      .slice(0, title.synopsis.length);
    db.prepare('UPDATE anime_data SET synopsis=? WHERE mal_id=?').run(newSynopsis, title.mal_id);
    const updated = await call('semantic_search', { ...filter, query: 'magical academy' }, '');
    expect(updated.results[0]).toMatchObject({
      mal_id: title.mal_id,
      semantic_source: 'live-synopsis',
      tropes: expect.arrayContaining(['Magical academy']),
    });
    db.prepare('UPDATE anime_data SET synopsis=NULL WHERE mal_id=?').run(title.mal_id);
    expect((await call('discover_titles', filter)).results[0]).toMatchObject({
      semantic_source: 'metadata',
      synopsis: null,
    });
  });
  it('rejects contradictory partial preference updates atomically', async () => {
    await call('update_user_preferences', { hard_filters: { min_score: 8 } });
    await expect(
      call('update_user_preferences', { hard_filters: { max_score: 6 } })
    ).rejects.toMatchObject({ code: 'invalid_argument' });
    expect((await call('get_user_preferences', {})).hard_filters).toEqual({ min_score: 8 });
  });
  it('persists feedback for the correct title namespace and invalidates dismissed titles immediately', async () => {
    const target = { media_type: 'anime', mal_id: 910001 };
    await call('record_recommendation_feedback', {
      ...target,
      signal: 'dislike',
      reason: 'not my style',
    });
    await call('record_recommendation_feedback', { ...target, signal: 'dismiss' });
    expect((await call('get_recommendation_feedback', {})).total).toBe(1);
    expect((await call('get_recommendation_feedback', {}, 'bob')).total).toBe(0);
    const seen = await call('discover_titles', { filters: { genres: ['Fantasy'] } });
    expect(seen.results.map((r: any) => [r.media_type, r.mal_id])).toContainEqual([
      'manga',
      910001,
    ]);
    expect(seen.results.map((r: any) => [r.media_type, r.mal_id])).not.toContainEqual([
      'anime',
      910001,
    ]);
    await call('record_recommendation_feedback', { ...target, signal: 'neutral' });
    expect((await call('discover_titles', { media_type: 'anime' })).total).toBe(3);
    await expect(
      call('record_recommendation_feedback', { media_type: 'manga', mal_id: 999, signal: 'like' })
    ).rejects.toMatchObject({ code: 'not_found' });
  });
  it('enforces combinations of numeric constraints, known language, format-specific fields and tags', async () => {
    db.exec('UPDATE manga_data SET available_languages=\'["Japanese"]\' WHERE mal_id=910001');
    const result = await call('discover_titles', {
      filters: {
        language: 'ja',
        min_chapters: 40,
        min_year: 2020,
        min_score: 8,
        include_tags: ['Kingdom building'],
      },
    });
    expect(result.results.map((r: any) => [r.media_type, r.mal_id])).toEqual([['manga', 910001]]);
    expect(
      (await call('discover_titles', { filters: { min_episodes: 80 } })).results.map(
        (r: any) => r.mal_id
      )
    ).toEqual([910002]);
    expect((await call('discover_titles', { filters: { studio: 'Unknown' } })).total).toBe(0);
  });
});
