import { z } from 'zod';
import { defineTool } from './tool';
import { discover } from './discoverySearch';
import { history, savedPreferences, savePreferences, writeFeedback } from './discoveryState';
import {
  discoverInput,
  feedbackSchema,
  filtersSchema,
  media,
  pageInput,
  preferencesSchema,
  savedSchema,
  searchFields,
  searchOutput,
  seedSchema,
  signalSchema,
} from './discoverySchemas';

export const discoveryTools = [
  defineTool({
    name: 'semantic_search',
    access: 'optional',
    description:
      'Search anime and manga by natural-language plot, trope, title, or themes using corpus-trained synopsis embeddings and keyword evidence. Use filters for strict constraints. Public catalog access supports content filters; use discover_titles for account filters. Connected account searches exclude Done, Dropped, and dismissed titles by default. Use next_offset to continue.',
    input: z.strictObject({ ...searchFields, query: z.string().trim().min(1).max(600) }),
    output: searchOutput,
    example: {
      query: 'magical academy with power progression',
      media_type: 'anime',
      filters: { min_score: 7 },
      limit: 10,
      offset: 0,
    },
    run: (args, ctx) => discover(args, ctx.userId, true),
  }),
  defineTool({
    name: 'discover_titles',
    access: 'read',
    description:
      'Find titles across the live filtered catalog using your saved tastes, ratings, and feedback. Hard filter fields supplied for this call override the corresponding saved fields. List finished or dropped titles only by explicitly changing exclude_watch_statuses.',
    input: discoverInput,
    output: searchOutput,
    example: {
      media_type: 'manga',
      filters: { min_score: 7, include_unlisted: true },
      preferences: { genres: ['Fantasy'] },
    },
    run: (args, ctx) => discover(args, ctx.userId),
  }),
  defineTool({
    name: 'get_similar_titles',
    access: 'optional',
    description:
      'Find similar works using one or more source titles and their synopses. Supply the source media and MAL ID, then optionally limit the target media or combine filters.',
    input: z.strictObject({
      ...searchFields,
      seed: seedSchema,
      query: z.string().trim().max(600).optional(),
    }),
    output: searchOutput,
    example: { seed: { media_type: 'anime', mal_id: 37430 }, media_type: 'both', limit: 5 },
    run: ({ seed, ...args }, ctx) =>
      discover({ ...args, similar_to: [seed, ...args.similar_to] }, ctx.userId, true),
  }),
  defineTool({
    name: 'get_user_preferences',
    access: 'read',
    description:
      'Read the current account’s saved hard discovery filters and soft ranking preferences.',
    input: z.strictObject({}),
    output: savedSchema,
    example: {},
    run: (_, ctx) => savedPreferences(ctx.userId),
  }),
  defineTool({
    name: 'update_user_preferences',
    access: 'write',
    description:
      'Save hard filters and soft tastes for future searches. Provided fields replace the same saved fields. Empty arrays clear a list. Set replace=true to replace both objects completely.',
    input: z.strictObject({
      hard_filters: filtersSchema.default({}),
      preferences: preferencesSchema.default({}),
      replace: z.boolean().default(false),
    }),
    output: savedSchema,
    example: {
      hard_filters: { exclude_watch_statuses: ['Done', 'Dropped'] },
      preferences: { themes: ['Isekai'], prefer_longer_series: true },
    },
    run: (args, ctx) =>
      savePreferences(ctx.userId, args.hard_filters, args.preferences, args.replace),
  }),
  defineTool({
    name: 'record_recommendation_feedback',
    access: 'write',
    description:
      'Record like, dislike, dismiss, or neutral for an anime or manga MAL ID. Repeating a call updates one account-owned record. Dislike and dismiss suppress the title. Neutral clears its ranking effect.',
    input: seedSchema.extend({
      signal: signalSchema,
      reason: z.string().trim().max(500).optional(),
    }),
    output: feedbackSchema,
    example: {
      media_type: 'anime',
      mal_id: 1,
      signal: 'like',
      reason: 'Enjoyed the ensemble cast.',
    },
    run: async (args, ctx) =>
      feedbackSchema.parse(
        await writeFeedback(ctx.userId, args.media_type, args.mal_id, args.signal, args.reason)
      ),
  }),
  defineTool({
    name: 'get_recommendation_feedback',
    access: 'read',
    description: 'Read and page through your feedback history, most recent first.',
    input: z.strictObject({ media_type: media.optional(), ...pageInput }),
    output: z.object({
      results: z.array(feedbackSchema),
      total: z.number(),
      next_offset: z.number().nullable(),
    }),
    example: { limit: 20, offset: 0 },
    run: async (args, ctx) => {
      const page = await history(ctx.userId, args.limit, args.offset, args.media_type);
      return { ...page, results: page.results.map((row) => feedbackSchema.parse(row)) };
    },
  }),
];
