import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

const REQUIRED_SCOPE = 'anime-list.read';
const MAX_TOKEN_LIFETIME_SECONDS = 3_600;
const GOOGLE_SUBJECT = /^google-oauth2\|([A-Za-z0-9._-]{3,256})$/u;

export type Auth0McpEnv = {
  AUTH0_ISSUER?: string;
  AUTH0_MCP_AUDIENCE?: string;
};

function auth0Issuer(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      !url.hostname.endsWith('.auth0.com')
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

function exactAudience(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      url.pathname !== '/anime-list/mcp'
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

function stringClaims(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/\s+/u).filter(Boolean);
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  return [];
}

let cachedIssuer: string | undefined;
let cachedJwks: JWTVerifyGetKey | undefined;

function remoteJwks(issuer: string): JWTVerifyGetKey {
  if (cachedIssuer !== issuer || !cachedJwks) {
    cachedIssuer = issuer;
    cachedJwks = createRemoteJWKSet(new URL('.well-known/jwks.json', issuer), {
      cacheMaxAge: 300_000,
      cooldownDuration: 30_000,
      timeoutDuration: 5_000,
    });
  }
  return cachedJwks;
}

export async function verifyAnimeAuth0Subject(
  token: string,
  env: Auth0McpEnv,
  getKey?: JWTVerifyGetKey
): Promise<string | null> {
  const issuer = auth0Issuer(env.AUTH0_ISSUER);
  const audience = exactAudience(env.AUTH0_MCP_AUDIENCE);
  if (!issuer || !audience) return null;
  try {
    const { payload } = await jwtVerify(token, getKey ?? remoteJwks(issuer), {
      algorithms: ['RS256'],
      audience,
      issuer,
      clockTolerance: 60,
      requiredClaims: ['iss', 'aud', 'sub', 'exp', 'iat'],
    });
    const match = typeof payload.sub === 'string' ? GOOGLE_SUBJECT.exec(payload.sub) : null;
    const permissions = new Set([
      ...stringClaims(payload.scope),
      ...stringClaims(payload.scopes),
      ...stringClaims(payload.permissions),
    ]);
    if (
      !match ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > MAX_TOKEN_LIFETIME_SECONDS + 60 ||
      !permissions.has(REQUIRED_SCOPE)
    )
      return null;
    return match[1] ?? null;
  } catch {
    return null;
  }
}

export function isRs256Jwt(token: string): boolean {
  const encoded = token.split('.', 1)[0];
  if (!encoded) return false;
  try {
    const normalized = encoded.replaceAll('-', '+').replaceAll('_', '/');
    const header = JSON.parse(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
    ) as unknown;
    return Boolean(
      header &&
        typeof header === 'object' &&
        !Array.isArray(header) &&
        (header as Record<string, unknown>).alg === 'RS256'
    );
  } catch {
    return false;
  }
}
