import {
  encode,
  indexedRow,
  matchesFingerprint,
  titleTropes,
  vectorFor,
} from './discoveryEmbedding';
import type { Media } from './discoverySchemas';

export interface DocumentEmbedding {
  row: number | null;
  vector: string | null;
  tropes: string[] | null;
  keywords: number[];
  source: 'indexed-synopsis' | 'live-synopsis' | 'metadata';
}
const encoder = new TextEncoder();
export async function documentEmbedding(
  media: Media,
  id: number,
  synopsis: string,
  title: string,
  english: string,
  tags: string[]
): Promise<DocumentEmbedding> {
  const row = indexedRow(media, id);
  if (row !== undefined) {
    const signature = JSON.stringify([synopsis, title, english, [...tags].sort()]);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(signature)));
    const matches = matchesFingerprint(row, digest);
    if (matches)
      return { row, vector: null, tropes: null, keywords: [], source: 'indexed-synopsis' };
  }
  const text = [synopsis, title, english, ...tags].join(' ');
  const { vector, words } = encode(text);
  const packed = vector
    ? btoa(String.fromCharCode(...Uint8Array.from(vector, (x) => 127 + Math.round(x * 127))))
    : null;
  return {
    row: null,
    vector: packed,
    tropes: titleTropes(undefined, text, tags),
    keywords: [...words].slice(0, 32),
    source: synopsis ? 'live-synopsis' : 'metadata',
  };
}
export function documentVector(doc: DocumentEmbedding) {
  if (doc.row !== null) return vectorFor(doc.row);
  return doc.vector ? Int8Array.from(atob(doc.vector), (c) => c.charCodeAt(0) - 127) : null;
}

export function documentTropes(doc: DocumentEmbedding) {
  return doc.tropes ?? titleTropes(doc.row ?? undefined, '', []);
}
