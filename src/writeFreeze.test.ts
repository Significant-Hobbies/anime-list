import { describe, expect, it } from 'vitest';
import { isWriteFrozenRequest } from './writeFreeze';

describe('write freeze', () => {
  it('rejects mutating requests only while the cutover freeze is enabled', () => {
    expect(isWriteFrozenRequest('POST', 'true')).toBe(true);
    expect(isWriteFrozenRequest('DELETE', 'true')).toBe(true);
    expect(isWriteFrozenRequest('POST', 'false')).toBe(false);
    expect(isWriteFrozenRequest('POST')).toBe(false);
  });

  it('keeps read and preflight requests available during the freeze', () => {
    expect(isWriteFrozenRequest('GET', 'true')).toBe(false);
    expect(isWriteFrozenRequest('HEAD', 'true')).toBe(false);
    expect(isWriteFrozenRequest('OPTIONS', 'true')).toBe(false);
  });
});
