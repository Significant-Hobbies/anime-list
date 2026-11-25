'use client';

import { ResourceBoundary } from '@saas-maker/ui/blocks/resource-boundary';
import { EmptyState } from '@saas-maker/ui/components/empty-state';
import { ErrorState } from '@saas-maker/ui/components/error-state';
import { useResourceQuery as useQuery } from '@/lib/use-resource-query';

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { getApiUrl } from '@/lib/apiConfig';
import { listTokens, createToken, revokeToken, type ApiTokenMetadata } from '@/lib/api';
import { SITE_NAME } from '@/lib/brand';
import { CompactSectionSkeleton, TableSkeleton } from '@/components/ui/loading-state';

const API_URL = getApiUrl();
const MCP_ENDPOINT = `${API_URL || 'https://anime.significanthobbies.com'}/api/mcp`;

const PUBLIC_TOOLS = [
  {
    name: 'semantic_search',
    desc: 'Find stories by synopsis, trope, or a natural-language description.',
  },
  { name: 'get_franchise', desc: 'Explore connected seasons and adaptations by catalog ID.' },
  { name: 'get_seasonal_anime', desc: 'Browse releases by year and season.' },
  {
    name: 'search_anime',
    desc: 'Search with filters and sorting. Use the recommended sort with a connected account for personalized results.',
  },
  {
    name: 'search_manga',
    desc: 'Search manga with filters and sorting.',
  },
  { name: 'list_search_fields', desc: 'Find available filter fields for anime or manga.' },
  { name: 'list_filter_actions', desc: 'Find available comparison and array filter actions.' },
  { name: 'get_anime_detail', desc: 'Full detail for one anime by MAL id.' },
  { name: 'get_manga_detail', desc: 'Full detail for one manga by MAL id.' },
  { name: 'get_anime_stats', desc: 'Aggregate stats over the anime catalog.' },
  { name: 'get_random_anime', desc: 'Random anime, optionally filtered by genre.' },
];

const AUTH_TOOLS = [
  { name: 'discover_titles', desc: 'Find candidates using your history and saved preferences.' },
  {
    name: 'get_watchlist_stats',
    desc: 'Count tracked seasons and manga entries by status and personal rating.',
  },
  {
    name: 'upsert_watchlist_entries',
    desc: 'Save statuses, notes, tags, or optional ratings with write permission.',
  },
  {
    name: 'remove_watchlist_entries',
    desc: 'Remove explicitly selected entries with write permission.',
  },
  {
    name: 'get_manga_watchlist_enriched',
    desc: 'Your manga list with titles, chapters, genres, and scores.',
  },
  { name: 'list_watchlist', desc: 'Your anime watchlist with statuses.' },
  { name: 'list_manga_watchlist', desc: 'Your manga watchlist with statuses.' },
  { name: 'list_watchlist_tags', desc: 'Legacy watch statuses with per-status counts.' },
  {
    name: 'get_watchlist_enriched',
    desc: 'Your watchlist joined with catalog metadata (title, image, score, genres).',
  },
];

const CLAUDE_CONFIG = `{
  "mcpServers": {
    "anime-list": {
      "command": "npx",
      "args": ["mcp-remote", "${MCP_ENDPOINT}", "--header", "Authorization: \${AUTHORIZATION_HEADER}"],
      "env": { "AUTHORIZATION_HEADER": "Bearer <paste-token-here>" }
    }
  }
}`;

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s.endsWith('Z') ? s : `${s}Z`);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function TokenRow({
  token,
  onRevoke,
}: {
  token: ApiTokenMetadata;
  onRevoke: (id: string) => void;
}) {
  const isRevoked = !!token.revokedAt;
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 text-sm font-medium">
        {token.name}
        <span className="block text-xs text-muted-foreground">
          {token.canWrite ? 'Read and write' : 'Read only'}
        </span>
      </td>
      <td className="py-2 pr-4 text-sm text-muted-foreground">{fmtDate(token.createdAt)}</td>
      <td className="py-2 pr-4 text-sm text-muted-foreground">{fmtDate(token.lastUsedAt)}</td>
      <td className="py-2 pr-4 text-sm">
        {isRevoked ? (
          <span className="text-muted-foreground/60">Revoked {fmtDate(token.revokedAt)}</span>
        ) : (
          <span className="text-emerald-500">Active</span>
        )}
      </td>
      <td className="py-2 text-right">
        {!isRevoked && (
          <button
            type="button"
            onClick={() => onRevoke(token.id)}
            className="text-sm text-muted-foreground hover:text-red-500 transition-colors"
          >
            Revoke
          </button>
        )}
      </td>
    </tr>
  );
}

function TokenManager() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resource = useQuery({
    queryKey: ['tokens'],
    queryFn: ({ signal }) => listTokens(signal),
  });
  const { data } = resource;

  const createMut = useMutation({
    mutationFn: () => createToken(name.trim(), canWrite),
    onSuccess: (res) => {
      setCreatedToken(res.token);
      setCanWrite(false);
      setCopied(false);
      setName('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeToken(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tokens'] }),
  });

  const copyToken = async () => {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
  };

  return (
    <div className="mt-10 rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold">Personal Access Tokens</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Create a token and paste it into your AI tool's MCP config. The token authenticates the
        watchlist tools below. Tokens are hashed at rest and shown only once — copy it now.
      </p>

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) createMut.mutate();
        }}
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Token name (e.g. Claude Desktop)"
          maxLength={64}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={canWrite}
            onChange={(event) => setCanWrite(event.target.checked)}
          />
          Allow changes to my library and preferences
        </label>
        <button
          type="submit"
          disabled={!name.trim() || createMut.isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {createMut.isPending ? 'Creating…' : 'Create token'}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {createdToken && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-600">
            Copy your token now — it won't be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="block flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">
              {createdToken}
            </code>
            <button
              type="button"
              onClick={copyToken}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <ResourceBoundary
        className="mt-6"
        resource={resource}
        delay={0}
        skeleton={<TableSkeleton label="loading access tokens" />}
        empty={<EmptyState title="no tokens yet" />}
        error={
          <ErrorState
            title="could not load access tokens"
            onRetry={() => {
              void resource.retry();
            }}
          />
        }
      >
        {data?.tokens?.length ? (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Created</th>
                <th className="pb-2 pr-4 font-medium">Last used</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.tokens.map((t) => (
                <TokenRow key={t.id} token={t} onRevoke={(id) => revokeMut.mutate(id)} />
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="no tokens yet" />
        )}
      </ResourceBoundary>
    </div>
  );
}

function ConfigBlock({ title, config }: { title: string; config: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(config);
    setCopied(true);
  };
  return (
    <div className="mt-4 rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          type="button"
          onClick={copy}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="mt-2 overflow-x-auto text-xs leading-5 text-muted-foreground">
        <code>{config}</code>
      </pre>
    </div>
  );
}

export default function McpPage() {
  const { user, loading: authLoading } = useAuth();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Home
      </Link>

      <section className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">MCP Server</h1>
        <p className="mt-4 max-w-prose text-base leading-7 text-muted-foreground">
          {SITE_NAME} exposes an MCP (Model Context Protocol) server so AI tools like ChatGPT,
          Claude Desktop, or Cursor can find anime and manga, compare seasons, and track your list.
          Connect your account for personal discovery. Grant write permission to save changes you
          request.
        </p>
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <span className="text-muted-foreground">Endpoint: </span>
          <code className="font-mono break-all">{MCP_ENDPOINT}</code>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-muted-foreground">Public tools (no auth)</h2>
        <ul className="mt-3 space-y-2">
          {PUBLIC_TOOLS.map((t) => (
            <li key={t.name} className="text-sm">
              <code className="font-mono text-foreground">{t.name}</code>
              <span className="text-muted-foreground"> — {t.desc}</span>
            </li>
          ))}
        </ul>

        <h2 className="mt-6 text-sm font-medium text-muted-foreground">Personal tools</h2>
        <ul className="mt-3 space-y-2">
          {AUTH_TOOLS.map((t) => (
            <li key={t.name} className="text-sm">
              <code className="font-mono text-foreground">{t.name}</code>
              <span className="text-muted-foreground"> — {t.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-muted-foreground">Client configuration</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Add the server to your AI tool. For watchlist tools, create a token below and replace
          <code className="mx-1 font-mono">{'<paste-token-here>'}</code>
          with it.
        </p>
        <ConfigBlock title="Claude Desktop" config={CLAUDE_CONFIG} />
        <p className="mt-3 text-xs text-muted-foreground">
          Cursor and other MCP clients: use the same URL with an
          <code className="mx-1 font-mono">Authorization: Bearer anime_list_…</code>
          header.
        </p>
      </section>

      {authLoading ? (
        <div className="mt-10">
          <CompactSectionSkeleton label="Loading personal access tokens" />
        </div>
      ) : user ? (
        <TokenManager />
      ) : (
        <div className="mt-10 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Sign in to create and manage Personal Access Tokens for watchlist access.
        </div>
      )}
    </main>
  );
}
