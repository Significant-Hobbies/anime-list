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
  test('adds a discovery recommendation to the watchlist', async ({ page }) => {
    await authenticate(page);
    let added: unknown;

    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;

      if (path === '/api/discover/queue') {
        return json(route, {
          meta: { currentSeason: 'summer', currentYear: 2026 },
          results: [
            {
              mal_id: 5114,
              id: 5114,
              title: 'Fullmetal Alchemist: Brotherhood',
              genres: ['Action', 'Fantasy'],
              themes: [],
              year: 2009,
              score: 9.1,
              reasons: ['Completed favorites'],
              mediaType: 'anime',
            },
          ],
        });
      }
      if (path === '/api/watchlist/tags') {
        return json(route, {
          tags: [{ id: 'watching', tag: 'Watching', count: 0, color: '#2563eb' }],
        });
      }
      if (path === '/api/watched/add' && request.method() === 'POST') {
        added = request.postDataJSON();
        return json(route, { success: true, message: 'Added' });
      }
      if (path === '/api/last-updated') {
        return json(route, { lastUpdated: null, anime: null, manga: null });
      }
      return json(route, { error: `Unexpected E2E request: ${path}` }, 404);
    });

    await page.goto('/discover');

    await expect(page.getByRole('heading', { name: 'Weekly Discovery' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Fullmetal Alchemist: Brotherhood' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Add to List' }).click();

    await expect
      .poll(() => added)
      .toEqual({
        mal_ids: [5114],
        status: 'Watching',
      });
  });

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
      if (path === '/api/watchlist/recommendations') {
        return json(route, {
          profile: {
            favoriteGenres: [],
            favoriteThemes: [],
            preferredTypes: [],
            sampledTitles: 1,
          },
          recommendations: [],
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
