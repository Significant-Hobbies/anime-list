'use client';

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { getApiUrl } from '@/lib/apiConfig';
import { listTokens, createToken, revokeToken, type ApiTokenMetadata } from '@/lib/api';
import { SITE_NAME } from '@/lib/brand';

const API_URL = getApiUrl();
const MCP_ENDPOINT = `${API_URL}/api/mcp`;

const PUBLIC_TOOLS = [
  {
    name: 'search_anime',
    desc: 'Filter the anime catalog (filters, sortBy, airing, pagesize, offset).',
  },
  { name: 'search_manga', desc: 'Filter the manga catalog (filters, sortBy, pagesize, offset).' },
  { name: 'get_anime_detail', desc: 'Full detail for one anime by MAL id.' },
  { name: 'get_manga_detail', desc: 'Full detail for one manga by MAL id.' },
  { name: 'get_anime_stats', desc: 'Aggregate stats over the anime catalog.' },
  { name: 'get_random_anime', desc: 'Random anime, optionally filtered by genre.' },
];

const AUTH_TOOLS = [
  { name: 'list_watchlist', desc: 'Your anime watchlist with statuses.' },
  { name: 'list_manga_watchlist', desc: 'Your manga watchlist with statuses.' },
  { name: 'list_watchlist_tags', desc: 'Your watchlist tags with per-tag counts.' },
  {
    name: 'get_watchlist_enriched',
    desc: 'Your watchlist joined with catalog metadata (title, image, score, genres).',
  },
];

const CLAUDE_CONFIG = `{
  "mcpServers": {
    "shelf": {
      "command": "npx",
      "args": ["mcp-remote", "${MCP_ENDPOINT}"],
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
      <td className="py-2 pr-4 text-sm font-medium">{token.name}</td>
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
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['tokens'],
    queryFn: listTokens,
  });

  const createMut = useMutation({
    mutationFn: () => createToken(name.trim()),
    onSuccess: (res) => {
      setCreatedToken(res.token);
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

      <div className="mt-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data?.tokens?.length ? (
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
          <p className="text-sm text-muted-foreground">No tokens yet.</p>
        )}
      </div>
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
  const { user } = useAuth();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Home
      </Link>

      <section className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">MCP Server</h1>
        <p className="mt-4 max-w-prose text-base leading-7 text-muted-foreground">
          {SITE_NAME} exposes an MCP (Model Context Protocol) server so AI tools like Claude Desktop
          or Cursor can search the catalog and read your watchlist. Public tools (search, detail,
          stats) work without auth. Watchlist tools require a Personal Access Token.
        </p>
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <span className="text-muted-foreground">Endpoint: </span>
          <code className="font-mono">{MCP_ENDPOINT}</code>
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

        <h2 className="mt-6 text-sm font-medium text-muted-foreground">
          Watchlist tools (require a token)
        </h2>
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
          <code className="mx-1 font-mono">Authorization: Bearer shelf_…</code>
          header.
        </p>
      </section>

      {user ? (
        <TokenManager />
      ) : (
        <div className="mt-10 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Sign in to create and manage Personal Access Tokens for watchlist access.
        </div>
      )}
    </main>
  );
}
