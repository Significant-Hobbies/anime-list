// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setDbClient, type DatabaseStatement } from '../../db/client';
import {
  getSchedule,
  removeScheduleItems,
  reorderSchedule,
  updateScheduleItem,
} from '../../db/schedule';
import { addScheduleItems, buildScheduleTimelineResponse } from '../../services/scheduleService';

let db: DatabaseSync;
function migrate(name: string) {
  db.exec(readFileSync(new URL(`../../../migrations/d1/${name}.sql`, import.meta.url), 'utf8'));
}
function status(user: string, id: string, tag: string) {
  db.prepare(`INSERT INTO anime_watchlist (user_id, mal_id, tag_id, title, episodes)
    VALUES (?, ?, ?, ?, 12) ON CONFLICT(user_id, mal_id) DO UPDATE SET tag_id=excluded.tag_id`).run(
    user,
    id,
    tag,
    `Imported title ${id}`
  );
}
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  migrate('0001_initial');
  db.exec(`INSERT INTO user_tags (id, user_id, name) VALUES ('w','a','Watching'),('c','a','Completed'),('b-w','b','watching');
    INSERT INTO anime_schedule (user_id, mal_id, sort_order, episodes_watched) VALUES ('a','1',0,4);
    INSERT INTO anime_data (mal_id,title,url,episodes) VALUES (1,'Manual title','/anime/1',26);`);
  status('a', '1', 'w');
  status('a', '3', 'w');
  status('a', '2', 'w');
  status('b', '4', 'b-w');
  migrate('0003_watching_schedule');
  async function execute(statement: DatabaseStatement) {
    const { sql, args = [] } = typeof statement === 'string' ? { sql: statement } : statement;
    return { rows: db.prepare(sql).all(...(args as (string | number | null)[])), rowsAffected: 0 };
  }
  setDbClient({ execute, batch: (statements) => Promise.all(statements.map(execute)) });
});
afterEach(() => db.close());

describe('Watching schedule', () => {
  it('includes existing and new Watching items in owner order and preserves manual plans', async () => {
    const plan = await getSchedule('a');
    expect(plan.map((i) => i.mal_id)).toEqual(['1', '2', '3']);
    expect(plan[0]).toMatchObject({ title: 'Manual title', episodes_watched: 4 });
    expect(plan[1]).toMatchObject({ title: 'Imported title 2', episodes: 12 });
    expect((await getSchedule('b')).map((i) => i.mal_id)).toEqual(['4']);
    status('a', '1', 'c');
    status('a', '2', 'c');
    status('a', '5', 'w');
    expect((await getSchedule('a')).map((i) => i.mal_id)).toEqual(['1', '3', '5']);
    status('a', '1', 'w');
    expect((await getSchedule('a'))[0].episodes_watched).toBe(4);
    db.exec("UPDATE user_tags SET name='On hold' WHERE id='w'");
    expect((await getSchedule('a')).map((i) => i.mal_id)).toEqual(['1']);
  });

  it('saves automatic progress and order, and keeps explicit removals out of the plan', async () => {
    await updateScheduleItem('a', '2', { episodesWatched: 3, episodesPerDay: 2 });
    await reorderSchedule('a', ['3', '2', '1']);
    const { items, timeline } = await buildScheduleTimelineResponse('a');
    expect(items.map((i) => i.mal_id)).toEqual(['3', '2', '1']);
    expect(items[1]).toMatchObject({ episodes_watched: 3, episodes_per_day: 2 });
    expect(timeline.find((day) => day.entries[0].mal_id === '2')?.entries[0].episode_range).toEqual(
      [4, 5]
    );
    await removeScheduleItems('a', ['2', '1']);
    await updateScheduleItem('a', '2', { episodesWatched: 5 });
    expect((await getSchedule('a')).map((i) => i.mal_id)).toEqual(['3']);
    expect(
      db.prepare('SELECT COUNT(*) AS n FROM anime_watchlist WHERE user_id=?').get('a')?.n
    ).toBe(3);
    await addScheduleItems('a', ['2'], 3);
    await addScheduleItems('a', ['2'], 3);
    const restored = await getSchedule('a');
    expect(restored.map((i) => i.mal_id)).toEqual(['3', '2']);
    expect(restored[1]).toMatchObject({ episodes_watched: 3, episodes_per_day: 2 });
    status('a', '2', 'c');
    expect((await getSchedule('a')).map((i) => i.mal_id)).toEqual(['3']);
    db.exec("DELETE FROM anime_watchlist WHERE user_id='a' AND mal_id='3'");
    expect(await getSchedule('a')).toEqual([]);
  });
});

it('starts a fresh plan when a title returns to Watching', async () => {
  await updateScheduleItem('a', '2', { episodesWatched: 5, episodesPerDay: 2 });
  await removeScheduleItems('a', ['3']);
  for (const id of ['2', '3']) {
    status('a', id, 'c');
    status('a', id, 'w');
  }
  expect(
    (await getSchedule('a')).slice(1).map((i) => [i.mal_id, i.episodes_watched, i.episodes_per_day])
  ).toEqual([
    ['2', 0, 3],
    ['3', 0, 3],
  ]);
  await removeScheduleItems('a', ['2']);
  db.exec(
    "UPDATE user_tags SET name='On hold' WHERE id='w'; UPDATE user_tags SET name='Watching' WHERE id='w'"
  );
  expect((await getSchedule('a')).map((i) => i.mal_id)).toEqual(['1', '3']);
  await reorderSchedule('a', ['3', '1']);
  await addScheduleItems('a', ['2'], 3);
  expect((await getSchedule('a')).map((i) => [i.mal_id, i.sort_order])).toEqual([
    ['3', 0],
    ['1', 1],
    ['2', 2],
  ]);
});

it('appends manual titles after all visible rows and preserves existing positions on retry', async () => {
  await addScheduleItems('a', ['9', '8'], 2);
  await addScheduleItems('a', ['8', '9'], 4);
  status('a', '7', 'w');
  await addScheduleItems('a', ['6'], 3);
  expect((await getSchedule('a')).map((i) => i.mal_id)).toEqual([
    '1',
    '2',
    '3',
    '9',
    '8',
    '7',
    '6',
  ]);
  expect((await getSchedule('b')).map((i) => i.mal_id)).toEqual(['4']);
});
