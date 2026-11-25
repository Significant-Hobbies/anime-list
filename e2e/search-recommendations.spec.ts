import { expect, test, type Page } from '@playwright/test';

async function serveSearch(page: Page) {
  const searches: { sortBy: string; offset: number; filters: unknown[] }[] = [];
  let added = false;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/watched/add') {
      added = true;
      return route.fulfill({ json: { success: true } });
    }
    if (path === '/api/search') {
      const request = route.request().postDataJSON();
      searches.push(request);
      const id = request.offset + (added && request.sortBy === 'recommended' ? 2 : 1);
      return route.fulfill({
        json: {
          totalFiltered: 3,
          filteredList: [
            {
              id,
              name: `Result ${id} (${request.sortBy})`,
              genres: ['Drama'],
              score: 8,
              year: 2024,
              members: 120000,
            },
          ],
        },
      });
    }
    if (path === '/api/catalog/counts') return route.fulfill({ json: { anime: 100, manga: 100 } });
    if (path === '/api/watchlist/tags') return route.fulfill({ json: { tags: [] } });
    if (path === '/api/watchlist') return route.fulfill({ json: { anime: {} } });
    return route.fulfill({ json: {} });
  });
  return searches;
}

test('signed-in anime search combines recommendation order with filters and pagination', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'mal_profile',
      JSON.stringify({ id: 'reader', name: 'Reader', email: 'reader@example.com' })
    )
  );
  const searches = await serveSearch(page);
  await page.goto('/search?pagesize=1');
  const sort = page.getByRole('combobox', { name: 'Sort', exact: true });
  await expect(sort).toHaveText('Recommended for you');
  await expect(page.getByRole('heading', { name: 'Result 1 (recommended)' })).toBeVisible();
  await page.getByRole('button', { name: 'Drama', exact: true }).click();
  await expect
    .poll(() => searches.at(-1)?.filters)
    .toContainEqual({ field: 'genres', action: 'INCLUDES_ALL', value: ['Drama'] });
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.getByRole('heading', { name: 'Result 2 (recommended)' })).toBeVisible();
  expect(searches.at(-1)).toMatchObject({
    sortBy: 'recommended',
    offset: 1,
    filters: expect.arrayContaining([
      { field: 'genres', action: 'INCLUDES_ALL', value: ['Drama'] },
    ]),
  });
  await sort.click();
  await page.getByRole('option', { name: 'Score', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Result 1 (score)' })).toBeVisible();
  await page.reload();
  await expect(sort).toHaveText('Score');
  await sort.click();
  await page.getByRole('option', { name: 'Recommended for you' }).click();
  await expect(page.getByRole('heading', { name: 'Result 1 (recommended)' })).toBeVisible();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(sort).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    await page.screenshot({ path: test.info().outputPath(`search-${width}.png`) });
  }
  await page.getByRole('button', { name: 'Add to watchlist' }).click();
  await page.getByRole('button', { name: 'Watching', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Result 2 (recommended)' })).toBeVisible();
});

test('a guest opening a personalized search URL gets public score order', async ({ page }) => {
  const searches = await serveSearch(page);
  await page.goto('/search?sort=recommended');
  const sort = page.getByRole('combobox', { name: 'Sort', exact: true });
  await expect(page.getByRole('heading', { name: 'Result 1 (score)' })).toBeVisible();
  await expect(sort).toHaveText('Score');
  await sort.click();
  await expect(page.getByRole('option', { name: 'Recommended for you' })).toHaveCount(0);
  expect(searches.every((request) => request.sortBy === 'score')).toBe(true);
});

test('search activity shows a pending request, its HTTP failure and a successful retry', async ({
  page,
}) => {
  await serveSearch(page);
  const pending = Promise.withResolvers<void>();
  await page.route(
    '**/api/search',
    async (route) => {
      await pending.promise;
      await route.fulfill({ status: 429, json: {} });
    },
    { times: 1 }
  );
  try {
    await page.goto('/search');
    await page.getByText('Search API activity', { exact: false }).click();
    const activity = page.locator('details').filter({ hasText: 'Search API activity' });
    await expect(activity.getByText('POST /api/search')).toBeVisible();
    await expect(activity.getByText('Pending', { exact: true })).toBeVisible();
    pending.resolve();
    await expect(activity.getByText(/HTTP 429 · \d+ ms/)).toBeVisible();
    await page.getByRole('button', { name: /try again|retry/i }).click();
    await expect(activity.getByText(/Completed · \d+ ms/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Result 1 (score)' })).toBeVisible();
  } finally {
    pending.resolve();
  }
});

test('shared rank sort survives filtering and changing numeric sorts', async ({ page }) => {
  const searches = await serveSearch(page);
  await page.goto('/search?sort=rank');
  const sort = page.getByRole('combobox', { name: 'Sort', exact: true });
  await expect(sort).toHaveText('Rank');
  await expect(page.getByRole('heading', { name: 'Result 1 (rank)' })).toBeVisible();
  await page.getByRole('button', { name: 'Drama', exact: true }).click();
  await expect
    .poll(() => searches.at(-1))
    .toMatchObject({
      sortBy: 'rank',
      filters: expect.arrayContaining([
        { field: 'genres', action: 'INCLUDES_ALL', value: ['Drama'] },
      ]),
    });
  await sort.click();
  await page.getByRole('option', { name: 'Episodes', exact: true }).click();
  await expect(page).toHaveURL(/sort=episodes/);
  await expect(page.getByRole('heading', { name: 'Result 1 (episodes)' })).toBeVisible();
});
