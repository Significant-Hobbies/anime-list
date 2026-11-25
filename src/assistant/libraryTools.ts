import { z } from 'zod';
import { AssistantError, defineTool } from './tool';
import { libraryStats, readLibraryEntry, readLibraryPage } from './library';
import {
  listLibraryTags,
  manageLibraryTag,
  removeLibraryEntry,
  upsertLibraryEntry,
} from './libraryWrite';
import {
  identity,
  entryInput,
  entryOutput,
  libraryFilters,
  libraryPage,
  pageFields,
  tagCommand,
  type EntryKey,
} from './librarySchemas';

const exampleKey = { media_type: 'anime', catalog_id: 5114 };
const page = {
  returned: z.number(),
  offset: z.number(),
  limit: z.number(),
  total: z.number(),
  hasMore: z.boolean(),
  nextOffset: z.number().nullable(),
};
const buckets = z.array(z.object({ label: z.string(), count: z.number() }));
const failure = z.object({
  code: z.enum([
    'invalid_argument',
    'not_found',
    'conflict',
    'upstream_unavailable',
    'rate_limited',
  ]),
  message: z.string(),
});
const editResult = identity.extend({
  ok: z.boolean(),
  entry: entryOutput.optional(),
  removed: z.boolean().optional(),
  observed_entry: entryOutput
    .nullable()
    .optional()
    .describe('Current stored state when a failed write could not confirm its commit.'),
  error: failure.optional(),
});
const editOutput = z.object({
  results: z.array(editResult),
  succeeded: z.number(),
  failed: z.number(),
});
type EditResult = z.infer<typeof editResult>;

async function bulk<T extends EntryKey>(
  userId: string,
  entries: T[],
  change: (input: T) => Promise<Partial<EditResult>>
) {
  const results: EditResult[] = [];
  for (const input of entries) {
    const key = { catalog_id: input.catalog_id, media_type: input.media_type };
    try {
      results.push({ ...key, ok: true, ...(await change(input)) });
    } catch (error) {
      const detail =
        error instanceof AssistantError
          ? { code: error.code, message: error.message }
          : {
              code: 'upstream_unavailable' as const,
              message:
                'Storage could not confirm this edit. Check observed_entry or read the entry before retrying.',
            };
      const observed =
        detail.code === 'upstream_unavailable'
          ? await readLibraryEntry(userId, key).catch(() => undefined)
          : undefined;
      results.push({ ...key, ok: false, error: detail, observed_entry: observed });
    }
  }
  const succeeded = results.filter((r) => r.ok).length;
  return { results, succeeded, failed: results.length - succeeded };
}

export const libraryTools = [
  defineTool({
    name: 'get_watchlist',
    access: 'read',
    description:
      'Read your anime and manga library. Filter by media, canonical or custom watch status, personal rating, and classification tags. Follow nextOffset to continue.',
    example: {
      media_type: 'anime',
      watch_statuses: ['Done', 'Watching'],
      min_personal_rating: 8,
      limit: 50,
      offset: 0,
    },
    input: libraryPage,
    output: z.object({ items: z.array(entryOutput), ...page }),
    run: (args, ctx) => readLibraryPage(ctx.userId, args),
  }),
  defineTool({
    name: 'get_watchlist_entry',
    access: 'read',
    description:
      'Read your private status, rating, notes, tags, known dates and catalog details for one anime or manga.',
    example: exampleKey,
    input: identity,
    output: z.object({ entry: entryOutput }),
    run: async (args, ctx) => {
      const entry = await readLibraryEntry(ctx.userId, args);
      if (!entry) throw new AssistantError('not_found', 'This title is not in your library.');
      return { entry };
    },
  }),
  defineTool({
    name: 'get_watchlist_stats',
    access: 'read',
    description:
      'Count your library by media, status, rating, catalog year, genre and theme. Returns highest personal ratings and known recent updates/completions. Unrated titles are excluded from the average.',
    example: { media_type: 'manga' },
    input: libraryFilters,
    output: z.object({
      total: z.number(),
      rated_count: z.number(),
      average_personal_rating: z.number().nullable(),
      by_media: buckets,
      by_status: buckets,
      by_year: buckets,
      by_rating: buckets,
      by_genre: buckets,
      by_theme: buckets,
      highest_rated: z.array(entryOutput),
      recently_updated: z.array(entryOutput),
      recently_completed: z.array(entryOutput),
    }),
    run: (args, ctx) => libraryStats(ctx.userId, args),
  }),
  defineTool({
    name: 'upsert_watchlist_entries',
    access: 'write',
    description:
      'Add or edit up to 50 anime or manga entries. Use a one-item array for a single edit. Supply watch_status for new entries. Omitted fields are preserved, null clears an optional field, and tags replaces the classification list. Each result reports success or a specific error.',
    example: {
      entries: [{ ...exampleKey, watch_status: 'Done', personal_rating: 9, tags: ['favorites'] }],
    },
    input: z.strictObject({ entries: z.array(entryInput).min(1).max(50) }),
    output: editOutput,
    run: (args, ctx) =>
      bulk(ctx.userId, args.entries, async (input) => ({
        entry: await upsertLibraryEntry(ctx.userId, input),
      })),
  }),
  defineTool({
    name: 'remove_watchlist_entries',
    access: 'write',
    description:
      'Remove one or more anime and manga entries from your private library. An already absent entry reports removed=false. Check the result for each requested title.',
    example: { entries: [exampleKey] },
    input: z.strictObject({ entries: z.array(identity).min(1).max(50) }),
    output: editOutput,
    run: (args, ctx) =>
      bulk(ctx.userId, args.entries, async (input) => ({
        removed: await removeLibraryEntry(ctx.userId, input),
      })),
  }),
  defineTool({
    name: 'list_library_tags',
    access: 'read',
    description:
      'List your classification tags and their anime and manga entry counts. Watch statuses are available through list_watchlist_tags.',
    example: { limit: 50, offset: 0 },
    input: z.strictObject(pageFields),
    output: z.object({
      items: z.array(z.object({ name: z.string(), count: z.number() })),
      ...page,
    }),
    run: (args, ctx) => listLibraryTags(ctx.userId, args.limit, args.offset),
  }),
  defineTool({
    name: 'manage_watchlist_tags',
    access: 'write',
    description:
      'Create, rename, or delete a private classification tag across your library. Renaming preserves assignments. Deleting a tag leaves titles in your library.',
    example: { action: 'rename', name: 'favourites', new_name: 'favorites' },
    input: tagCommand,
    output: z.object({ action: z.enum(['create', 'rename', 'delete']), name: z.string() }),
    run: (args, ctx) => manageLibraryTag(ctx.userId, args.action, args.name, args.new_name),
  }),
];
