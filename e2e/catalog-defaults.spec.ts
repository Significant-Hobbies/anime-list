import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Local D1 must retain the checked-in catalog; never run against production.
const origin = process.env.E2E_BASE_URL;
const localRun = !!origin && /^http:\/\/(localhost|127\.0\.0\.1):/.test(origin);
const anime = JSON.parse(
  readFileSync(new URL('../cleaned_anime_data.json', import.meta.url), 'utf8')
);
const manga = JSON.parse(
  readFileSync(new URL('../cleaned_manga_data.json', import.meta.url), 'utf8')
);
const animeRows = Object.values(anime) as { members: number }[];
const animeTotal = animeRows.length;
const mangaTotal = Object.values(manga).length;
const popularTotal = animeRows.filter((row) => row.members >= 100_000).length;

if (!localRun)
  throw new Error('Requires an explicitly selected local app and retained local D1 catalog');

for (const width of [390, 768, 1440]) {
  test(`catalog defaults, counts and empty navigation at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    // No provider/auth/telemetry requests. This SDK stub checks button rendering
    // configuration only; it cannot authenticate and is not live acceptance.
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (['localhost', '127.0.0.1'].includes(url.hostname)) {
        // Forward to real local D1; permit the explicitly selected local UI origin.
        if (url.port === '8787') {
          if (route.request().method() === 'OPTIONS') {
            return route.fulfill({
              status: 204,
              headers: {
                'access-control-allow-origin': origin!,
                'access-control-allow-credentials': 'true',
                'access-control-allow-methods': 'GET, POST, OPTIONS',
                'access-control-allow-headers': 'content-type',
              },
            });
          }
          const response = await route.fetch();
          return route.fulfill({
            response,
            headers: {
              ...response.headers(),
              'access-control-allow-origin': origin!,
              'access-control-allow-credentials': 'true',
            },
          });
        }
        return route.continue();
      }
      if (url.href === 'https://accounts.google.com/gsi/client') {
        return route.fulfill({
          contentType: 'application/javascript',
          body: `window.google={accounts:{id:{initialize(){},renderButton(parent,options){const button=document.createElement('button');button.textContent=options.type==='standard'?'Continue with Google':'G';parent.append(button);}}}};`,
        });
      }
      return route.abort();
    });
    const countsResponse = await request.get('http://localhost:8787/api/catalog/counts');
    expect(await countsResponse.json()).toEqual({ anime: animeTotal, manga: mangaTotal });
    await page.goto('/search');
    const chip = page.getByRole('button', { name: 'Remove 100k+ members', exact: true });
    await expect(chip).toBeVisible();
    await expect(
      page
        .getByText(`${popularTotal.toLocaleString()} matching anime titles`, { exact: true })
        .first()
    ).toBeVisible();
    await expect(
      page.getByText(
        `${popularTotal.toLocaleString()} matching anime titles · ${animeTotal.toLocaleString()} anime in the unfiltered catalog`,
        { exact: true }
      )
    ).toBeVisible();
    await page.screenshot({ path: `test-results/catalog-default-${width}.png` });
    await chip.click();
    await expect(page).toHaveURL(/min=0/);
    await expect(chip).toHaveCount(0);
    await expect(
      page
        .getByText(`${animeTotal.toLocaleString()} matching anime titles`, { exact: true })
        .first()
    ).toBeVisible();
    await page.reload();
    await expect(chip).toHaveCount(0);
    await expect(
      page
        .getByText(`${animeTotal.toLocaleString()} matching anime titles`, { exact: true })
        .first()
    ).toBeVisible();
    await page.goto('/search?min=50000&page=2');
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    await expect(page).toHaveURL(/min=0/);
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page.getByRole('button', { name: /^Remove .*members$/ })).toHaveCount(0);
    await page.goto('/search?min=123456');
    await expect(page.getByRole('button', { name: 'Remove 123,456+ members' })).toBeVisible();
    await page.screenshot({ path: `test-results/catalog-search-${width}.png`, fullPage: false });
    for (const path of ['/watchlist', '/discover']) {
      await page.goto(path);
      await expect(
        page.locator('main').getByRole('button', { name: 'Continue with Google', exact: true })
      ).toBeVisible();
      await expect(page.locator('studio-footer footer')).toHaveAttribute(
        'data-footer-mode',
        'compact'
      );
      await expect(page.locator('studio-footer form[data-subscribe]')).toHaveCount(0);
      await expect(page.locator('#about-anime-list')).toBeHidden();
      await page.screenshot({
        path: `test-results/catalog-${path.slice(1)}-${width}.png`,
        fullPage: false,
      });
      await page.getByRole('link', { name: 'Anime List', exact: true }).click();
      await expect(page.locator('studio-footer form[data-subscribe]')).toBeVisible();
      await expect(page.locator('#about-anime-list')).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator('studio-footer footer')).toHaveAttribute(
        'data-footer-mode',
        'compact'
      );
      await page
        .getByRole('link', { name: 'Browse anime without signing in', exact: true })
        .click();
      await expect(page).toHaveURL(/\/search$/);
    }
    await page.goto('/');
    await expect(
      page.getByText(
        `${(animeTotal + mangaTotal).toLocaleString()} titles in the unfiltered catalog: ${animeTotal.toLocaleString()} anime and ${mangaTotal.toLocaleString()} manga.`,
        { exact: true }
      )
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Catalog stats/ })).toContainText(
      `${animeTotal.toLocaleString()} anime in the unfiltered catalog`
    );
    await page.screenshot({ path: `test-results/catalog-home-${width}.png`, fullPage: false });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  });
}
