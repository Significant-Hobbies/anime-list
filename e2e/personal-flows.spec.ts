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
    await expect(page.getByRole('button', { name: 'Import / Export' })).toBeHidden();
    await page.getByRole('button', { name: 'Manage watchlist' }).click();
    await expect(page.getByPlaceholder('New list name')).toBeVisible();
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

test('quiz keeps answers editable and carries the chosen episode length into Search', async ({
  page,
}) => {
  await page.goto('/discover');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await expect(page.getByText('Your anime archetype', { exact: true })).toHaveCount(0);
  for (const answer of [
    'Open a door to a bigger world',
    'Rules, factions, and lore',
    'Up to 13 episodes',
  ]) {
    await page.getByRole('button', { name: answer }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Up to 13 episodes' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'I want theories and wiki tabs' }).click();
  await page.getByRole('button', { name: 'See my result' }).click();
  await expect(page.getByRole('heading', { name: 'World Builder' })).toBeVisible();
  await page.getByRole('link', { name: 'Explore in Search' }).click();
  await expect(page).toHaveURL(/\/search\?af=/);
  const filters = JSON.parse(new URL(page.url()).searchParams.get('af')!).f;
  expect(new URL(page.url()).searchParams.get('min')).toBe('0');
  expect(filters).toContainEqual({
    field: 'genres',
    action: 'INCLUDES_ANY',
    value: ['Fantasy', 'Adventure', 'Sci-Fi'],
  });
  expect(filters).toContainEqual({ field: 'episodes', action: 'LESS_THAN_OR_EQUALS', value: 13 });
  expect(filters.filter((filter: { field: string }) => filter.field === 'episodes')).toHaveLength(
    1
  );
});

test('shows Watching immediately and expands the plan a week at a time', async ({ page }) => {
  await authenticate(page);
  let watched = 4;
  const scheduleReads: string[] = [];
  const item = {
    mal_id: '5114',
    title: 'Fullmetal Alchemist: Brotherhood',
    episodes: 64,
    episodes_per_day: 3,
    sort_order: 0,
    type: 'TV',
    watchStatus: 'Watching',
  };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/schedule/timeline') {
      scheduleReads.push(url.search);
      return json(route, { items: [{ ...item, episodes_watched: watched }] });
    }
    if (url.pathname === '/api/schedule/5114/update') {
      watched = route.request().postDataJSON().episodes_watched;
      return json(route, { success: true });
    }
    return json(route, {});
  });
  await page.goto('/schedule');
  const progress = page.getByRole('spinbutton', {
    name: 'Episodes watched for Fullmetal Alchemist: Brotherhood',
  });
  await expect(progress).toHaveValue('4');
  await expect(page.getByText('Ep 5-7', { exact: true })).toBeVisible();
  const fitsViewport = await page.evaluate(() => {
    const layout = document.documentElement;
    return layout.scrollWidth <= layout.clientWidth;
  });
  expect(fitsViewport).toBe(true);
  await expect(page.getByText(/^Day 8 ·/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Show 7 more days' }).click();
  await expect(page.getByText(/^Day 8 ·/)).toBeVisible();
  await progress.fill('7');
  await progress.press('Enter');
  await expect(page.getByText('Ep 8-10', { exact: true })).toBeVisible();
  await expect.poll(() => watched).toBe(7);
  await expect(page.getByText('Ep 5-7', { exact: true })).toHaveCount(0);
  expect(scheduleReads).toEqual(['?view=items']);
});
