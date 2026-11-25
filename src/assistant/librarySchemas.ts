import { z } from 'zod';

const media = z.enum(['anime', 'manga']);
const tagName = z.string().trim().min(1).max(64);
const rating = z.number().min(1).max(10);
const timestamp = z.iso.datetime({ offset: true });
export const identity = z.strictObject({
  media_type: media,
  catalog_id: z.number().int().positive(),
});
export const pageFields = {
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(1_000_000).default(0),
};
export const libraryFilters = z.strictObject({
  media_type: media.optional(),
  watch_statuses: z.array(tagName).min(1).max(30).optional(),
  min_personal_rating: rating.optional(),
  max_personal_rating: rating.optional(),
  tags: z
    .array(tagName)
    .min(1)
    .max(20)
    .optional()
    .describe('Require every classification tag in this list.'),
});
export const libraryPage = libraryFilters.extend(pageFields);
export const entryInput = identity.extend({
  watch_status: tagName
    .optional()
    .describe(
      'Required for a new entry. Accepts Done, Watching, Delaying, Dropped, or a custom status.'
    ),
  personal_rating: rating.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  tags: z.array(tagName).max(20).nullable().optional(),
  completed_at: timestamp.nullable().optional(),
});
export const entryOutput = identity.extend({
  title: z.string(),
  watch_status: z.string(),
  legacy_status: z.string(),
  personal_rating: rating.nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  catalog_score: z.number().nullable(),
  year: z.number().nullable(),
  genres: z.array(z.string()),
  themes: z.array(z.string()),
});
export type EntryInput = z.infer<typeof entryInput>;
export type EntryKey = z.infer<typeof identity>;
export type Entry = z.infer<typeof entryOutput>;
export type Filters = z.infer<typeof libraryFilters>;
export type Page = z.infer<typeof libraryPage>;
export const tagCommand = z.strictObject({
  action: z.enum(['create', 'rename', 'delete']),
  name: tagName,
  new_name: tagName.optional(),
});
