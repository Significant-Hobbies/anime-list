import { pageSchema, pageMetadata } from './pagination';
import { z } from 'zod';
import { getDb } from '../db/client';
import { defineTool } from './tool';
import { completeGraph } from './franchiseGraph';
import { releaseChanges, sequelRows } from './franchiseCatalog';
import { readSeason, refreshTitle } from './franchiseProvider';

const medium = z.enum(['anime', 'manga']);
const id = z.number().int().positive();
const pagination = {
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().nonnegative().default(0),
};
const spoiler = z.enum(['metadata_only', 'provider_synopsis']).default('metadata_only');
const maybeString = z.string().nullable();
const titleSchema = z.object({
  mal_id: id,
  media: medium,
  chapters: z.number().nullable(),
  volumes: z.number().nullable(),
  title: maybeString,
  format: maybeString,
  status: maybeString,
  start: maybeString,
  episodes: z.number().nullable(),
  synopsis: z.string().optional(),
  source_url: z.string(),
  metadata_at: maybeString,
});
const relationSchema = z.object({
  mal_id: id,
  media: z.enum(['anime', 'manga']),
  relation: z.string(),
  title: z.string(),
});
const asString = (s: unknown) => (typeof s === 'string' ? s : null);
type Row = Record<string, unknown>;

function title(row: Row, synopsis = false) {
  return {
    mal_id: Number(row.id),
    media: row.media === 'manga' ? ('manga' as const) : ('anime' as const),
    chapters: typeof row.chapters === 'number' ? row.chapters : null,
    volumes: typeof row.volumes === 'number' ? row.volumes : null,
    title: asString(row.title),
    format: asString(row.format),
    status: asString(row.status),
    start: asString(row.start),
    episodes: typeof row.episodes === 'number' ? row.episodes : null,
    ...(synopsis && row.synopsis ? { synopsis: String(row.synopsis) } : {}),
    source_url: 'https://myanimelist.net/' + (row.media ?? 'anime') + '/' + row.id,
    metadata_at: asString(row.metadata_at),
  };
}
function page<T>(rows: T[], offset: number, limit: number) {
  const items = rows.slice(offset, offset + limit);
  return {
    items,
    ...pageMetadata(rows.length, offset, limit, items.length),
  };
}

function storyLinks(byId: Map<string, Row>, edges: Row[]) {
  const after = new Map<string, Set<string>>();
  const degree = new Map([...byId.keys()].map((id) => [id, 0]));
  for (const e of edges) {
    if (!['prequel', 'sequel'].includes(String(e.relation))) continue;
    const source = e.source_type + ':' + e.source_id;
    const target = e.target_type + ':' + e.target_id;
    const [a, b] = e.relation === 'sequel' ? [source, target] : [target, source];
    if (!byId.has(a) || !byId.has(b) || a === b) continue;
    const successors = after.get(a) ?? new Set<string>();
    if (!successors.has(b)) {
      successors.add(b);
      after.set(a, successors);
      degree.set(b, (degree.get(b) ?? 0) + 1);
    }
  }
  return { after, degree };
}

function orderByPrequels(members: Row[], edges: Row[]) {
  // Stable topological order. Members without story-order edges keep their release ordering.
  const byId = new Map(members.map((row) => [row.media + ':' + row.id, row]));
  const { after, degree } = storyLinks(byId, edges);
  const result: Row[] = [];
  while (degree.size) {
    const next = [...degree].find(([, n]) => n === 0)?.[0];
    if (next === undefined) return { rows: members, conflict: true };
    degree.delete(next);
    result.push(byId.get(next)!);
    for (const later of after.get(next) ?? []) degree.set(later, degree.get(later)! - 1);
  }
  return { rows: result, conflict: false };
}

const getFranchise = defineTool({
  name: 'get_franchise',
  access: 'public',
  description:
    'Traverse MAL anime relationships from any anime or manga MAL ID. Each page includes typed links (including manga adaptations), release or prequel-first order, and source coverage. Repeat from offset zero while fetching missing members; paginate after coverage stabilizes. Default summaries contain metadata only.',
  input: z.strictObject({
    mal_id: id,
    media: medium.default('anime'),
    order: z.enum(['release', 'prequel_first']).default('release'),
    summary: spoiler,
    ...pagination,
  }),
  output: z.object({
    ...pageSchema,
    franchise_id: z
      .string()
      .describe(
        'First media-qualified identifier in the known component. May change with newly indexed relationships.'
      ),
    items: z.array(titleSchema.extend({ relations: z.array(relationSchema) })),
    order: z.enum(['release', 'prequel_first', 'release_due_to_conflicting_edges']),
    coverage: z.object({
      source: z.literal('MAL relationships via Tenrai'),
      complete: z.boolean(),
      missing_relation_records: z.number(),
      oldest_record: maybeString,
      stale_records: z.number(),
    }),
  }),
  example: { mal_id: 1, order: 'release' },
  run: async (args) => {
    const { members, edges } = await completeGraph(args.media, args.mal_id);
    const ordered =
      args.order === 'release'
        ? { rows: members, conflict: false }
        : orderByPrequels(members, edges);
    const p = page(ordered.rows, args.offset, args.limit);
    const dates = members
      .map((row) => asString(row.relations_at))
      .filter((s): s is string => !!s)
      .sort();
    const missing = members.length - dates.length;
    const stale = dates.filter((s) => Date.parse(s) < Date.now() - 7 * 86400000).length;
    const relations = new Map<string, z.infer<typeof relationSchema>[]>();
    for (const edge of edges) {
      const source = edge.source_type + ':' + edge.source_id;
      const list = relations.get(source) ?? [];
      list.push({
        mal_id: Number(edge.target_id),
        media: edge.target_type as 'anime' | 'manga',
        relation: String(edge.relation),
        title: String(edge.target_title),
      });
      relations.set(source, list);
    }
    return {
      ...p,
      franchise_id: members.map((r) => r.media + ':' + r.id).sort()[0],
      items: p.items.map((row) => ({
        ...title(row, args.summary === 'provider_synopsis'),
        relations: relations.get(row.media + ':' + row.id) ?? [],
      })),
      order: ordered.conflict ? ('release_due_to_conflicting_edges' as const) : args.order,
      coverage: {
        source: 'MAL relationships via Tenrai' as const,
        complete: missing === 0 && stale === 0,
        missing_relation_records: missing,
        oldest_record: dates[0] ?? null,
        stale_records: stale,
      },
    };
  },
});

export function releaseState(row: Row, today: string) {
  const status = String(row.status ?? '')
    .trim()
    .toLowerCase();
  const date =
    typeof row.start === 'string' && Number.isFinite(Date.parse(row.start))
      ? row.start.slice(0, 10)
      : null;
  const future = date !== null && date > today;
  if (
    [
      'finished airing',
      'currently airing',
      'publishing',
      'finished',
      'on hiatus',
      'discontinued',
    ].includes(status)
  )
    return future ? 'unknown' : 'released';
  if (['not yet aired', 'not yet published'].includes(status))
    return date !== null && date < today ? 'unknown' : 'upcoming';
  return future ? 'upcoming' : 'unknown';
}
function sequelTool(which: 'released' | 'upcoming') {
  return defineTool({
    name: 'get_' + which + '_sequels',
    access: 'read',
    description:
      'Find ' +
      which +
      ' anime or manga sequels from explicit MAL sequel/prequel edges. Defaults to Done and Watching library entries. Excludes completed sequels. Optional MAL ID narrows the traversal. Coverage describes indexed sources and unknown release states.',
    input: z.strictObject({ mal_id: id.optional(), media: medium.default('anime'), ...pagination }),
    example: { limit: 25 },
    output: z.object({
      ...pageSchema,
      items: z.array(titleSchema.extend({ origin_ids: z.array(id) })),
      as_of: z.string(),
      coverage: z.object({
        origins_and_descendants: z.number(),
        relation_records: z.number(),
        oldest_record: maybeString,
        unknown_release_states: z.number(),
      }),
    }),
    run: async (args, ctx) => {
      const { items, coverage } = await sequelRows(
        ctx.userId,
        args.media,
        args.mal_id,
        args.offset === 0
      );
      const today = new Date().toISOString().slice(0, 10);
      const selected = items.filter((row) => releaseState(row, today) === which);
      const p = page(selected, args.offset, args.limit);
      return {
        ...p,
        items: p.items.map((row) => ({
          ...title(row),
          origin_ids: JSON.parse(String(row.origin_ids)),
        })),
        as_of: today,
        coverage: {
          origins_and_descendants: Number(coverage.total),
          relation_records: Number(coverage.known),
          oldest_record: asString(coverage.oldest),
          unknown_release_states: items.filter((row) => releaseState(row, today) === 'unknown')
            .length,
        },
      };
    },
  });
}

const seasonal = defineTool({
  name: 'get_seasonal_anime',
  access: 'public',
  description:
    'Read a season directly from the provider, including unscored announcements. Follow next_page. Metadata-only is the default; provider_synopsis explicitly includes source plot summaries.',
  input: z.strictObject({
    year: z.number().int().min(1900).max(2200),
    season: z.enum(['winter', 'spring', 'summer', 'fall']),
    page: id.default(1),
    premieres_only: z.boolean().default(false),
    summary: spoiler,
  }),
  output: z.object({
    items: z.array(titleSchema),
    page: id,
    next_page: id.nullable(),
    last_page: z.number(),
    source_url: z.string(),
    as_of: z.string(),
  }),
  example: { year: 2025, season: 'spring' },
  run: async (args) => {
    const { data, pagination } = await readSeason(args.year, args.season, args.page);
    const at = new Date().toISOString();
    return {
      items: data
        .filter((v) => !args.premieres_only || (v.year === args.year && v.season === args.season))
        .map((v) =>
          title(
            {
              id: v.mal_id,
              title: v.title_english ?? v.title,
              format: v.type,
              status: v.status,
              start: v.aired?.from,
              episodes: v.episodes,
              synopsis: v.synopsis,
              metadata_at: at,
            },
            args.summary === 'provider_synopsis'
          )
        ),
      page: pagination.current_page,
      next_page: pagination.has_next_page ? pagination.current_page + 1 : null,
      last_page: pagination.last_visible_page,
      source_url: 'https://myanimelist.net/anime/season/' + args.year + '/' + args.season,
      as_of: at,
    };
  },
});

const streaming = defineTool({
  name: 'get_streaming_links',
  access: 'public',
  description:
    'Get source-listed streaming service links. Licenses and regional availability are unspecified by the provider.',
  input: z.strictObject({ mal_id: id }),
  example: { mal_id: 1 },
  output: z.object({
    mal_id: id,
    services: z.array(z.object({ name: z.string(), url: z.url() })),
    territory: z.literal('unspecified'),
    source_url: z.string(),
    checked_at: z.string(),
    stale: z.boolean(),
  }),
  run: async ({ mal_id }) => {
    const db = getDb();
    const statement = {
      sql: 'SELECT updated_at,streaming FROM assistant_anime_details WHERE mal_id=?',
      args: [mal_id],
    };
    let row = (await db.execute(statement)).rows[0];
    const staleBefore = Date.now() - 86400000;
    if (!row || Date.parse(String(row.updated_at)) < staleBefore) {
      try {
        await refreshTitle(mal_id);
        row = (await db.execute(statement)).rows[0];
      } catch (error) {
        if (!row) throw error;
      }
    }
    return {
      mal_id,
      services: JSON.parse(String(row.streaming)),
      territory: 'unspecified' as const,
      source_url: 'https://myanimelist.net/anime/' + mal_id,
      checked_at: String(row.updated_at),
      stale: Date.parse(String(row.updated_at)) < staleBefore,
    };
  },
});

const monitor = defineTool({
  name: 'set_franchise_monitor',
  access: 'write',
  description:
    'Start or stop monitoring releases and schedule changes in this anime franchise. Poll get_franchise_updates for observed changes.',
  input: z.strictObject({ mal_id: id, enabled: z.boolean() }),
  output: z.object({ mal_id: id, enabled: z.boolean() }),
  example: { mal_id: 1, enabled: true },
  run: async ({ mal_id, enabled }, ctx) => {
    if (enabled) {
      await completeGraph('anime', mal_id);
      await getDb().execute({
        sql: 'INSERT INTO assistant_franchise_monitors(user_id,mal_id,created_at) VALUES(?,?,?) ON CONFLICT(user_id,mal_id) DO NOTHING',
        args: [ctx.userId, mal_id, new Date().toISOString()],
      });
    } else
      await getDb().execute({
        sql: 'DELETE FROM assistant_franchise_monitors WHERE user_id=? AND mal_id=?',
        args: [ctx.userId, mal_id],
      });
    return { mal_id, enabled };
  },
});
const updates = defineTool({
  name: 'get_franchise_updates',
  access: 'read',
  description:
    'Poll release observations for the franchises you monitor. Continue with after_id=last_id on subsequent calls, including after an empty page.',
  input: z.strictObject({
    after_id: z.number().int().nonnegative().default(0),
    limit: pagination.limit,
  }),
  output: z.object({
    items: z.array(
      z.object({
        id,
        mal_id: id,
        title: z.string(),
        observed_at: z.string(),
        previous_status: maybeString,
        status: maybeString,
        previous_start: maybeString,
        scheduled_start: maybeString,
      })
    ),
    has_more: z.boolean(),
    last_id: z.number(),
  }),
  example: { after_id: 0 },
  run: async ({ after_id, limit }, ctx) => {
    const rows = await releaseChanges(ctx.userId, after_id, limit + 1);
    const items = rows.slice(0, limit).map((r) => ({
      id: Number(r.id),
      mal_id: Number(r.mal_id),
      title: String(r.title),
      observed_at: String(r.observed_at),
      previous_status: asString(r.previous_status),
      status: asString(r.status),
      previous_start: asString(r.previous_start),
      scheduled_start: asString(r.scheduled_start),
    }));
    return { items, last_id: items.at(-1)?.id ?? after_id, has_more: rows.length > limit };
  },
});
export const franchiseTools = [
  getFranchise,
  sequelTool('released'),
  sequelTool('upcoming'),
  seasonal,
  streaming,
  monitor,
  updates,
];
