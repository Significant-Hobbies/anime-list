// @vitest-environment node

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { isRs256Jwt, verifyAnimeAuth0Subject } from './auth0Mcp';

const issuer = 'https://fleet-test.us.auth0.com/';
const audience = 'https://mcp.significanthobbies.com/anime-list/mcp';

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.alg = 'RS256';
  publicJwk.kid = 'anime-test';
  return {
    getKey: createLocalJWKSet({ keys: [publicJwk] }),
    async token(overrides: Record<string, unknown> = {}) {
      const now = Math.floor(Date.now() / 1000);
      return new SignJWT({ permissions: ['anime-list.read'], ...overrides })
        .setProtectedHeader({ alg: 'RS256', kid: 'anime-test', typ: 'JWT' })
        .setIssuer(String(overrides.iss ?? issuer))
        .setAudience(String(overrides.aud ?? audience))
        .setSubject(String(overrides.sub ?? 'google-oauth2|google-user-1'))
        .setIssuedAt(Number(overrides.iat ?? now))
        .setExpirationTime(Number(overrides.exp ?? now + 300))
        .sign(privateKey);
    },
  };
}

describe('Anime List Auth0 MCP verification', () => {
  it('accepts only the exact Google subject, audience, scope, and bounded lifetime', async () => {
    const signed = await fixture();
    const env = { AUTH0_ISSUER: issuer, AUTH0_MCP_AUDIENCE: audience };
    const valid = await signed.token();
    expect(isRs256Jwt(valid)).toBe(true);
    await expect(verifyAnimeAuth0Subject(valid, env, signed.getKey)).resolves.toBe('google-user-1');
    for (const overrides of [
      { aud: 'https://mcp.significanthobbies.com/reader/mcp' },
      { permissions: ['reader.read'] },
      { sub: 'auth0|not-google' },
      { exp: Math.floor(Date.now() / 1000) + 7_200 },
    ]) {
      await expect(
        verifyAnimeAuth0Subject(await signed.token(overrides), env, signed.getKey)
      ).resolves.toBeNull();
    }
  });
});
