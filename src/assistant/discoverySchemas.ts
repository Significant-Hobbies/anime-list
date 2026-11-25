import { z } from 'zod';

export const media = z.enum(['anime', 'manga']);
export const mediaChoice = z.enum(['anime', 'manga', 'both']);
export type Media = z.infer<typeof media>;
const text = z.string().trim().min(1).max(180);
const labels = z.array(text).max(24);
const number = z.number().int().nonnegative();
const rating = z.number().min(0).max(10);
export const filtersSchema = z.strictObject({
  title: text.optional(),
  min_score: rating.optional(),
  max_score: rating.optional(),
  year: number.optional(),
  min_year: number.optional(),
  max_year: number.optional(),
  min_episodes: number.optional(),
  max_episodes: number.optional(),
  min_chapters: number.optional(),
  max_chapters: number.optional(),
  min_popularity: number.optional(),
  max_popularity: number.optional(),
  min_members: number.optional(),
  max_members: number.optional(),
  min_user_rating: rating.optional(),
  max_user_rating: rating.optional(),
  genres: labels.optional(),
  themes: labels.optional(),
  tropes: labels.optional(),
  include_tags: labels.optional(),
  exclude_tags: labels.optional(),
  include_watch_statuses: labels.optional(),
  exclude_watch_statuses: labels.optional(),
  include_unlisted: z.boolean().optional(),
  format: text.optional(),
  airing_status: text.optional(),
  language: text.optional(),
  studio: text.optional(),
  franchise: text
    .optional()
    .describe('Catalog title in the franchise; a media-qualified franchise_id is more precise.'),
  franchise_media_type: media.optional(),
  franchise_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('MAL ID of a known member of the desired franchise (anime by default).'),
});
export type Filters = z.infer<typeof filtersSchema>;

export const preferencesSchema = z.strictObject({
  genres: labels.optional(),
  themes: labels.optional(),
  tropes: labels.optional(),
  avoid_genres: labels.optional(),
  avoid_themes: labels.optional(),
  avoid_tropes: labels.optional(),
  prefer_longer_series: z.boolean().optional(),
  language: text.optional(),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const savedSchema = z.object({
  hard_filters: filtersSchema,
  preferences: preferencesSchema,
  updated_at: z.string().nullable(),
});
export const seedSchema = z.strictObject({
  media_type: media,
  mal_id: z.number().int().positive(),
});
export type Seed = z.infer<typeof seedSchema>;
export const signalSchema = z.enum(['like', 'dislike', 'dismiss', 'neutral']);
export const feedbackSchema = seedSchema.extend({
  signal: signalSchema,
  reason: z.string().nullable(),
  updated_at: z.string(),
});
export const pageInput = {
  limit: z.number().int().min(1).max(50).default(10),
  offset: z.number().int().min(0).max(1_000_000).default(0),
};
const outputNumber = z.number().nullable();
export const resultSchema = z.object({
  media_type: media,
  mal_id: z.number().int(),
  title: z.string(),
  title_english: z.string().nullable(),
  alternative_titles: z.array(z.string()),
  score: outputNumber,
  year: outputNumber,
  synopsis: z.string().nullable(),
  genres: z.array(z.string()),
  themes: z.array(z.string()),
  tropes: z.array(z.string()),
  episodes: outputNumber,
  chapters: outputNumber,
  airing_status: z.string().nullable(),
  format: z.string().nullable(),
  popularity: outputNumber,
  members: outputNumber,
  user_status: z.string().nullable(),
  user_rating: outputNumber,
  user_tags: z.array(z.string()),
  franchise: z
    .object({
      franchise_id: z.string(),
      media_type: media,
      mal_id: z.number(),
      title: z.string().nullable(),
    })
    .nullable(),
  studios: z.array(z.string()),
  languages: z.array(z.string()),
  semantic_relevance: outputNumber,
  ranking_score: z.number(),
  reasons: z.array(z.string()),
  image: z.string().nullable(),
  url: z.string(),
  canonical_url: z.string().url(),
});
export const searchOutput = z.object({
  results: z.array(resultSchema),
  total: z.number(),
  next_offset: outputNumber,
  resolved_seeds: z.array(seedSchema.extend({ title: z.string() })),
  retrieval: z.object({
    model: z.string(),
    indexed_anime: z.number(),
    indexed_manga: z.number(),
    query_has_embedding: z.boolean(),
    fallback: z.string(),
  }),
});
export const searchFields = {
  media_type: mediaChoice.default('both'),
  include_full_synopsis: z.boolean().default(false),
  filters: filtersSchema.default({}),
  preferences: preferencesSchema.default({}),
  use_saved_preferences: z.boolean().optional(),
  similar_to: z.array(seedSchema).max(6).default([]),
  ...pageInput,
};
export const discoverInput = z.strictObject({
  ...searchFields,
  query: z.string().trim().min(1).max(600).optional(),
});
export type DiscoverInput = z.output<typeof discoverInput>;
