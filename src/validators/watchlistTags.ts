import { z } from 'zod';
import { watchTagColorSchema, watchTagSchema } from './watchTags';

export const watchlistTagSchema = z.object({
  tag: watchTagSchema,
  color: watchTagColorSchema,
});

export const watchlistTagUpdateSchema = z
  .object({
    tag: watchTagSchema.optional(),
    color: watchTagColorSchema,
  })
  .refine((value) => typeof value.tag === 'string' || typeof value.color === 'string', {
    message: 'At least one of tag or color must be provided',
  });

export const watchlistTagDeleteSchema = z.object({
  moveToTagId: z.string().trim().optional(),
});
