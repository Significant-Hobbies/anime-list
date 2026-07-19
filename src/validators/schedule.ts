import { z } from 'zod';

const malIdSchema = z.union([z.string().min(1), z.number()]).transform((value) => value.toString());

export const addToScheduleSchema = z.object({
  mal_ids: z.array(malIdSchema).nonempty({
    message: 'mal_ids must contain at least one id',
  }),
  episodes_per_day: z.number().int().min(1).max(100).optional().default(3),
});

export const updateScheduleItemSchema = z
  .object({
    episodes_per_day: z.number().int().min(1).max(100).optional(),
    episodes_watched: z.number().int().min(0).optional(),
  })
  .refine((v) => v.episodes_per_day !== undefined || v.episodes_watched !== undefined, {
    message: 'At least one field required',
  });

export const removeFromScheduleSchema = z.object({
  mal_ids: z.array(malIdSchema).nonempty({
    message: 'mal_ids must contain at least one id',
  }),
});

export const reorderScheduleSchema = z.object({
  mal_ids: z.array(malIdSchema).nonempty({
    message: 'mal_ids must contain at least one id',
  }),
});
