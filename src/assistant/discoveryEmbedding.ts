import index from './discoveryIndex.json';
import tropes from './discoveryTropes.json';
import type { Media } from './discoverySchemas';

export const retrievalModel = {
  model: `synopsis-lsa-${index.dimensions}-${index.source_sha256.slice(0, 12)}`,
  indexed_anime: index.groups.anime.indexed,
  indexed_manga: index.groups.manga.indexed,
};
const bytes = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
const dimensions = index.dimensions;
function loadIndex() {
  const titles = { anime: new Map<number, number>(), manga: new Map<number, number>() };
  let offset = 0;
  for (const media of ['anime', 'manga'] as const) {
    const ids = new Uint32Array(bytes(index.groups[media].ids).buffer);
    for (const id of ids) titles[media].set(id, offset++);
  }
  const packed = bytes(index.vectors);
  const vectors = new Int8Array(packed.length * 2);
  for (let i = 0; i < packed.length; i++) {
    vectors[2 * i] = (packed[i] >> 4) - 7;
    vectors[2 * i + 1] = (packed[i] & 15) - 7;
  }
  return {
    titles,
    fingerprints: bytes(index.fingerprints),
    words: new Map(index.vocabulary.map((word, i) => [word, i])),
    projection: new Int8Array(bytes(index.projection).buffer),
    vectors,
    keywords: new Uint16Array(bytes(index.keywords).buffer),
    tropeMasks: new Uint16Array(bytes(index.tropes).buffer),
  };
}
let loaded: ReturnType<typeof loadIndex> | undefined;
const model = () => (loaded ??= loadIndex());
const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export const indexedRow = (media: Media, id: number) => model().titles[media].get(id);
export function vectorFor(row: number) {
  return model().vectors.subarray(row * dimensions, (row + 1) * dimensions);
}
type Vector = ArrayLike<number>;
function unit(vector: Float32Array) {
  let norm = 0;
  for (const x of vector) norm += x * x;
  if (norm === 0) return null;
  const inverse = 1 / Math.sqrt(norm);
  return vector.map((x) => x * inverse);
}
export function encode(text: string) {
  const counts = new Map<number, number>();
  for (const word of text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []) {
    const id = model().words.get(word);
    if (id !== undefined) counts.set(id, 1 + (counts.get(id) ?? 0));
  }
  const vector = new Float32Array(dimensions);
  for (const [id, count] of counts) {
    const weight = 1 + Math.log(count);
    for (let i = 0; i < dimensions; i++)
      vector[i] += weight * model().projection[id * dimensions + i] * index.scales[i];
  }
  return { vector: unit(vector), words: new Set(counts.keys()) };
}
export function centroid(vectors: { vector: Vector; weight: number }[]) {
  const sum = new Float32Array(dimensions);
  for (const { vector, weight } of vectors) {
    let norm = 0;
    for (let i = 0; i < dimensions; i++) norm += vector[i] ** 2;
    if (!norm) continue;
    const scale = weight / Math.sqrt(norm);
    for (let i = 0; i < dimensions; i++) sum[i] += vector[i] * scale;
  }
  return unit(sum);
}
// Query vectors are unit length. Per-document quantization preserves cosine direction.
export function relevance(unitQuery: Float32Array | null, document: Vector | null) {
  if (!unitQuery || !document) return null;
  let dot = 0,
    norm = 0;
  for (let i = 0; i < dimensions; i++) {
    dot += unitQuery[i] * document[i];
    norm += document[i] ** 2;
  }
  return norm ? Math.min(1, Math.max(-1, dot / Math.sqrt(norm))) : null;
}
export function keywordHits(words: Set<number>, row: number) {
  let hits = 0;
  const start = row * index.terms_per_doc;
  for (let i = start; i < start + index.terms_per_doc; i++)
    if (words.has(model().keywords[i] - 1)) hits++;
  return hits;
}
const phrases = (text: string) => ` ${normalizeText(text)} `;
function matches(text: string, values: string[]) {
  return values.some((v) => text.includes(` ${v} `));
}
export function queryTropes(text: string) {
  const query = phrases(text);
  return tropes
    .filter((t) => matches(query, [normalizeText(t.name), ...t.queries]))
    .map((t) => t.name);
}
export function titleTropes(row: number | undefined, fallback: string, tags: string[]) {
  if (row !== undefined)
    return tropes.filter((_, i) => model().tropeMasks[row] & (1 << i)).map((t) => t.name);
  const text = phrases(fallback + ' ' + tags.join(' '));
  return tropes
    .filter(
      (t) =>
        matches(text, t.evidence) ||
        (t.name === 'Fantasy comedy' && tags.includes('Fantasy') && tags.includes('Comedy'))
    )
    .map((t) => t.name);
}

export function matchesFingerprint(row: number, digest: Uint8Array) {
  return digest.subarray(0, 8).every((value, i) => value === model().fingerprints[row * 8 + i]);
}
