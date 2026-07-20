import { z } from 'zod';
import { watchTagColorSchema, watchTagSchema } from './watchTags';

const malIdSchema = z.union([z.string().min(1), z.number()]).transform((value) => value.toString());

const watchlistIdsSchema = z.object({
  mal_ids: z.array(malIdSchema).nonempty({
    message: 'mal_ids must contain at least one id',
  }),
});

export const watchedListSchema = watchlistIdsSchema.extend({
  status: watchTagSchema,
  tagColor: watchTagColorSchema,
});

export const watchedListRemoveSchema = watchlistIdsSchema;
