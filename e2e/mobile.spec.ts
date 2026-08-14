import { expect, test } from '@playwright/test';

/**
 * Mobile-viewport regression checks for the primary discovery flow.
 * Meaningful under `--project=mobile` (iPhone 13, 390px wide — the Wave 1
 * mobile target). Runs against E2E_BASE_URL or the deployed app.
 */

test.describe('anime_list mobile primary flow', () => {
  test('homepage hero reaches a stable local performance boundary', async ({ page }) => {
    await page.route('**/api/last-updated', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lastUpdated: null, anime: null, manga: null }),
      })
    );

    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Find your next anime in 30 seconds.' })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Filter the catalog' })).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });
  });

  test('home page has no horizontal scroll', async ({ page }) => {
    await page.goto('/');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('title search input is reachable on mobile', async ({ page }) => {
    await page.goto('/search');

    const search = page.getByPlaceholder(/title search/i);
    await expect(search).toBeVisible();

    // Touch target: the search box should be a comfortable height.
    const box = await search.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
