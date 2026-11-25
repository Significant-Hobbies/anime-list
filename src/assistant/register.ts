import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { AssistantError, type AssistantContext } from './tool';

export interface AssistantDefinition {
  name: string;
  description: string;
  access: 'public' | 'read' | 'write';
  input: z.ZodObject;
  output: z.ZodObject;
  example: Record<string, unknown>;
  execute: (raw: unknown, ctx: AssistantContext) => Promise<Record<string, unknown>>;
}

interface AssistantSession extends AssistantContext {
  canWrite: boolean;
}

function failure(code: string, message: string) {
  const error = {
    code,
    message,
    retryable: ['rate_limited', 'upstream_unavailable'].includes(code),
  };
  return {
    isError: true,
    structuredContent: { ok: false, error },
    content: [{ type: 'text' as const, text: JSON.stringify(error) }],
  };
}

export type ResolveSession = () => Promise<AssistantSession>;

export function registerAssistantTools(
  server: McpServer,
  tools: AssistantDefinition[],
  resolveSession: ResolveSession
) {
  for (const tool of tools) {
    const write = tool.access === 'write';
    const inputSchema = write
      ? tool.input.extend({
          user_authorized: z
            .literal(true)
            .describe('Set true only when the user explicitly requested these changes.'),
        })
      : tool.input;
    const example = write ? { ...tool.example, user_authorized: true } : tool.example;
    server.registerTool(
      tool.name,
      {
        description: tool.description + ' Example: ' + JSON.stringify(example),
        inputSchema,
        outputSchema: tool.output,
        annotations: { readOnlyHint: !write, destructiveHint: write, openWorldHint: false },
      },
      async (raw: Record<string, unknown>) => {
        const session =
          tool.access === 'public'
            ? { userId: '', canWrite: false, env: {} }
            : await resolveSession();
        if (tool.access !== 'public' && !session.userId)
          return failure('unauthorized', 'Connect your Anime List account to use this tool.');
        if (write && !session.canWrite)
          return failure(
            'forbidden',
            'Authorize anime-list.write or use a personal token with write permission.'
          );
        const { user_authorized, ...args } = raw;
        if (write && user_authorized !== true)
          return failure('invalid_argument', 'Explicit user authorization is required.');
        try {
          const data = await tool.execute(args, {
            userId: tool.access === 'public' ? '' : session.userId,
            env: session.env,
          });
          return {
            structuredContent: data,
            content: [{ type: 'text' as const, text: JSON.stringify(data) }],
          };
        } catch (error) {
          if (error instanceof AssistantError) return failure(error.code, error.message);
          return failure(
            'upstream_unavailable',
            'Anime List could not complete this request. Check the current entry before retrying a change.'
          );
        }
      }
    );
  }
}
