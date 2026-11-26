import { z } from 'zod';

export const pageSchema = {
  total: z.number(),
  returned: z.number(),
  limit: z.number(),
  offset: z.number(),
  has_more: z.boolean(),
  next_offset: z.number().nullable(),
};

export function pageMetadata(
  total: number,
  offset: number,
  limit: number,
  returned: number,
  consumed = returned
) {
  const next = offset + consumed;
  const has_more = consumed > 0 && next < total;
  return { total, offset, limit, returned, has_more, next_offset: has_more ? next : null };
}
