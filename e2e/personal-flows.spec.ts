import { expect, test, type Page, type Route } from '@playwright/test';

const profile = {
  id: 'e2e-user',
  email: 'e2e@example.com',
  name: 'E2E User',
};

async function authenticate(page: Page) {
  await page.addInitScript((user) => {
    localStorage.setItem('mal_profile', JSON.stringify(user));
  }, profile);
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

const watchlistItem = {
  mal_id: '5114',
  watchStatus: 'Completed',
  title: 'Fullmetal Alchemist: Brotherhood',
  genres: ['Action', 'Fantasy'],
};

test.describe('signed-in personal flows', () => {
  test('previews a watchlist import without applying it', async ({ page }) => {
    await authenticate(page);
    let previewPayload: unknown;

    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;

      if (path === '/api/watchlist/enriched') {
        return json(route, { items: [watchlistItem] });
      }
      if (path === '/api/watchlist/tags') {
        return json(route, {
          tags: [{ id: 'completed', tag: 'Completed', count: 1, color: '#16a34a' }],
        });
      }
      if (path === '/api/watchlist/import/preview' && request.method() === 'POST') {
        previewPayload = request.postDataJSON();
        return json(route, {
          source: 'mal',
          entries: [
            {
              malId: '5114',
              title: 'Fullmetal Alchemist: Brotherhood',
              status: 'Watching',
            },
          ],
          statusCounts: { Watching: 1 },
          skipped: 0,
          conflicts: [
            {
              malId: '5114',
              title: 'Fullmetal Alchemist: Brotherhood',
              incomingStatus: 'Watching',
              existingStatus: 'Completed',
            },
          ],
          newCount: 0,
        });
      }
      if (path === '/api/last-updated') {
        return json(route, { lastUpdated: null, anime: null, manga: null });
      }
      return json(route, { error: `Unexpected E2E request: ${path}` }, 404);
    });

    await page.goto('/watchlist');
    await page.getByRole('button', { name: 'Import / Export' }).click();
    await page
      .getByPlaceholder('<myanimelist>...</myanimelist> or mal_id,title,status CSV')
      .fill('mal_id,title,status\n5114,Fullmetal Alchemist: Brotherhood,Watching');
    await page.getByRole('button', { name: 'Preview Import' }).click();

    await expect(page.getByText('1 conflict(s) detected.')).toBeVisible();
    await expect
      .poll(() => previewPayload)
      .toMatchObject({
        source: 'mal',
      });
  });
});

test('watchlist records failed reads, retries, and leaves recommendations to search', async ({
  page,
}) => {
  await authenticate(page);
  const calls: string[] = [];
  let attempts = 0;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    calls.push(path);
    if (path.endsWith('/enriched')) {
      if (++attempts === 1) return json(route, {}, 429);
      return json(route, { items: [watchlistItem] });
    }
    if (path.endsWith('/tags')) return json(route, { tags: [] });
    return json(route, {});
  });
  await page.goto('/watchlist');
  await expect(page.getByText('Could not load your watchlist')).toBeVisible();
  await page.getByText('Watchlist API activity').click();
  await expect(page.getByText('HTTP 429')).toBeVisible();
  await page.getByRole('button', { name: /try again|retry/i }).click();
  await expect(page.getByText(watchlistItem.title)).toBeVisible();
  await expect(page.getByText('GET /api/watchlist/enriched', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Taste Profile' })).toHaveCount(0);
  await page.goto('/discover');
  await expect(page.getByRole('heading', { name: 'Find your anime archetype' })).toBeVisible();
  expect(calls).not.toContain('/api/watchlist/recommendations');
  expect(calls).not.toContain('/api/discover/queue');
});
