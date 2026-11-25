import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { API_CONFIG } from '../config';

export type Media = 'anime' | 'manga';
const title = z.object({
  mal_id: z.number().int().positive(),
  titles: z.array(z.object({ title: z.string() })),
  title_synonyms: z.array(z.string()).nullish(),
  title_japanese: z.string().nullish(),
  studios: z.array(z.object({ name: z.string() })).optional(),
});
export type ProviderTitle = z.infer<typeof title>;
const pageSchema = z.object({
  data: z.array(title),
  pagination: z.object({
    current_page: z.number().int().positive(),
    last_visible_page: z.number().int().nonnegative(),
    has_next_page: z.boolean(),
  }),
});

export function createMetadataReader(
  request = fetch,
  wait: (ms: number) => Promise<unknown> = delay
) {
  async function read(url: string, allowMissing = false) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const [response] = await Promise.allSettled([
        request(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(25_000),
        }).then(async (res) => {
          const payload = res.ok ? await res.json() : null;
          if (!res.ok) await res.body?.cancel();
          return { res, payload };
        }),
        wait(API_CONFIG.rateLimit),
      ]);
      if (response.status === 'fulfilled') {
        const { res, payload } = response.value;
        if (res.ok) return payload;
        if (allowMissing && res.status === 404) return null;
        if (res.status !== 429 && res.status < 500)
          throw new Error(`Tenrai returned HTTP ${res.status} for ${url}`);
        const retry = Number(res.headers.get('retry-after')) * 1000;
        if (retry > 120_000)
          throw new Error(
            `Tenrai requires a pause of ${retry / 1000}s; resume this job afterward.`
          );
        if (attempt < 4) await wait(Math.max(retry, 1000 * 2 ** attempt));
      } else if (attempt < 4) await wait(1000 * 2 ** attempt);
    }
    throw new Error('Tenrai request failed after five attempts: ' + url);
  }
  return {
    full(media: Media, id: number) {
      return read(`${API_CONFIG.baseUrl}/${media}/${id}/full`, true);
    },
    async page(media: Media, page: number) {
      const result = pageSchema.parse(
        await read(`${API_CONFIG.baseUrl}/${media}?order_by=mal_id&sort=asc&limit=100&page=${page}`)
      );
      if (
        result.pagination.current_page !== page ||
        result.data.some((r, i, a) => i > 0 && a[i - 1].mal_id >= r.mal_id) ||
        (!result.data.length && result.pagination.has_next_page)
      )
        throw new Error('Invalid Tenrai sorted page: ' + page);
      return result;
    },
    async detail(media: Media, id: number) {
      const raw = await read(`${API_CONFIG.baseUrl}/${media}/${id}`, true);
      if (raw === null) return null;
      const row = z.object({ data: title }).parse(raw).data;
      if (row.mal_id !== id) throw new Error(`Tenrai returned a mismatched ${media} ID for ${id}.`);
      return row;
    },
  };
}
