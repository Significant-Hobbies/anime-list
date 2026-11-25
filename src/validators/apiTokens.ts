import { z } from 'zod';

export const createTokenSchema = z.object({
  canWrite: z.boolean().default(false),
  name: z.string().trim().min(1).max(64),
});

export const revokeTokenParamsSchema = z.object({
  id: z.string().min(1),
});
