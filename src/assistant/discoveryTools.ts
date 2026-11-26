import { pageSchema } from './pagination';
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
      'Search by plot description, theme or trope. Free text ranks candidates by similarity. Put required score, year or trope labels in filters. Compare recognized_query_tropes with the request. Check unconfirmed_tropes and verify other story details in the synopsis. Connected searches exclude Done, Dropped and dismissed titles by default.',
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
      'Recommend anime or manga for the connected account using ratings, watchlist and saved tastes. Use filters for requirements and preferences for ranking. Request filters override corresponding saved filters. Done and Dropped are excluded by default. Compare recognized_query_tropes with the request. Verify other details in the synopsis. preference_matches reports soft tastes separately.',
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
      'Find titles like a known anime or manga. Supply its media type and MAL ID in seed, and additional references in similar_to. Source titles are excluded. Set media_type to choose the result medium and filters for strict requirements.',
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
      ...pageSchema,
    }),
    example: { limit: 20, offset: 0 },
    run: async (args, ctx) => {
      const page = await history(ctx.userId, args.limit, args.offset, args.media_type);
      return { ...page, results: page.results.map((row) => feedbackSchema.parse(row)) };
    },
  }),
];
