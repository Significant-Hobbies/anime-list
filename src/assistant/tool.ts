import { z } from 'zod';

export interface AssistantContext {
  userId: string;
  env: Record<string, unknown>;
}

export class AssistantError extends Error {
  constructor(
    readonly code: 'invalid_argument' | 'not_found' | 'conflict' | 'upstream_unavailable' | 'rate_limited',
    message: string
  ) {
    super(message);
  }
}

export function defineTool<I extends z.ZodObject, O extends z.ZodObject>(definition: {
  name: string;
  description: string;
  access: 'public' | 'read' | 'write';
  input: I;
  output: O;
  example: Record<string, unknown>;
  run: (args: z.output<I>, ctx: AssistantContext) => Promise<z.input<O>>;
}) {
  return {
    ...definition,
    execute: async (raw: unknown, ctx: AssistantContext) => {
      const validated = definition.input.safeParse(raw);
      if (!validated.success) {
        throw new AssistantError('invalid_argument', z.prettifyError(validated.error));
      }
      return definition.output.parse(await definition.run(validated.data, ctx));
    },
  };
}
