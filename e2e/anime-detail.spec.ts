import { expect, test } from '@playwright/test';

const malId = process.env.E2E_ANIME_MAL_ID || '16498';
const animeTitle = process.env.E2E_ANIME_TITLE || 'Attack on Titan';

// Known SEO-dataset entry (FMA: Brotherhood, mal_id 5114, members > 3M)
const SEO_ANIME_ID = '5114';
const SEO_ANIME_TITLE = 'Fullmetal Alchemist: Brotherhood';

test('anime detail page loads from the deployed API', async ({ page }) => {
  const detailApiPath = `/api/anime/${malId}`;
  const saasmakerRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('api.sassmaker.com')) {
      saasmakerRequests.push(request.url());
    }
  });

  const detailResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'GET' && response.url().includes(detailApiPath)
  );

  await page.goto(`/anime/${malId}`);

  const detailResponse = await detailResponsePromise;
  expect(detailResponse.status()).toBe(200);

  await expect(page.getByRole('heading', { name: new RegExp(animeTitle, 'i') })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Synopsis' })).toBeVisible();
  await expect(page.getByText('Recommendations', { exact: true })).toBeVisible();
  await expect(page.getByText('Unable to load anime details')).toHaveCount(0);
  await expect(page.getByText('API error: 404')).toHaveCount(0);
  expect(saasmakerRequests).toEqual([]);
});

test('detail page serves unique title in HTML and app still mounts', async ({ page }) => {
  await page.goto(`/anime/${SEO_ANIME_ID}`);

  // The HTML <title> should contain the anime name (server-rewritten)
  const title = await page.title();
  expect(title).toContain(SEO_ANIME_TITLE);

  // The React app should still mount and show the detail heading
  await expect(page.getByRole('heading', { name: new RegExp(SEO_ANIME_TITLE, 'i') })).toBeVisible({
    timeout: 15_000,
  });
});

test('unknown anime id gets noindex and app still mounts', async ({ page }) => {
  await page.goto('/anime/999999999');

  // The page should have a noindex meta tag
  const robotsMeta = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robotsMeta).toContain('noindex');

  // The SPA should still mount (show the app, not a blank page)
  // The app will show an error or empty state, but #root should have content
  const rootContent = await page.locator('#root').innerHTML();
  expect(rootContent.length).toBeGreaterThan(100);
});
