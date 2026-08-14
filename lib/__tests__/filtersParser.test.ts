import { describe, it, expect } from 'vitest';
import { filtersParser } from '../filterMetadata';
import { serializeFilters } from '../filterSerialization';
import type { SearchFilter } from '../types';

const sample: SearchFilter[] = [
  { field: 'score', action: 'GREATER_THAN_OR_EQUALS', value: 7 },
  { field: 'genres', action: 'INCLUDES_ANY', value: ['Action', 'Comedy'] },
];

describe('filtersParser', () => {
  it('serializes to an object-wrapped payload, not a bare JSON array', () => {
    // A bare array (af=[...]) is what the TanStack Router adapter corrupts, since
    // TanStack auto-parses it into a real array. Wrapping it keeps the adapter on
    // its object branch so the round-trip survives.
    const serialized = filtersParser.serialize(sample);
    expect(serialized).toBe(serializeFilters(sample));
    expect(serialized.startsWith('[')).toBe(false);
    expect(JSON.parse(serialized)).toEqual({ f: sample });
  });

  it('round-trips through serialize -> parse', () => {
    expect(filtersParser.parse(filtersParser.serialize(sample))).toEqual(sample);
  });

  it('still parses the wrapped object form coming back from the URL', () => {
    expect(filtersParser.parse(JSON.stringify({ f: sample }))).toEqual(sample);
  });

  it('tolerates the legacy bare-array form', () => {
    expect(filtersParser.parse(JSON.stringify(sample))).toEqual(sample);
  });

  it('returns null on malformed input so withDefault applies', () => {
    expect(filtersParser.parse('[object Object]')).toBeNull();
    expect(filtersParser.parse('not json')).toBeNull();
  });
});
