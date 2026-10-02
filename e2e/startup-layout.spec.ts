import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Exercise the real critical HTML/CSS before application or provider scripts
// arrive. All requests are intercepted; no API, login, or telemetry is used.
const shell = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  ''
);

for (const pathname of ['/', '/search']) {
  test(`startup shell reserves app space on ${pathname}`, async ({ page }) => {
    await page.route('**/*', (route) =>
      route.request().isNavigationRequest()
        ? route.fulfill({ contentType: 'text/html', body: shell })
        : route.abort()
    );
    await page.goto(`https://startup-layout.invalid${pathname}`);

    const before = await page.evaluate(() => {
      document.documentElement.toggleAttribute('data-home', location.pathname === '/');
      return {
        viewportHeight: innerHeight,
        bodyTop: document.body.getBoundingClientRect().top,
        rootHeight: document.getElementById('root')!.getBoundingClientRect().height,
        aboutTop: document.getElementById('about-anime-list')!.getBoundingClientRect().top,
      };
    });
    expect(before.bodyTop).toBe(0);
    expect(before.rootHeight).toBeGreaterThanOrEqual(before.viewportHeight);
    expect(before.aboutTop).toBeGreaterThanOrEqual(before.viewportHeight);

    // Simulate RootLayout's existing min-h-dvh boundary resolving later.
    const after = await page.evaluate(() => {
      const app = document.createElement('div');
      app.style.minHeight = '100dvh';
      document.getElementById('root')!.append(app);
      return {
        bodyTop: document.body.getBoundingClientRect().top,
        rootHeight: document.getElementById('root')!.getBoundingClientRect().height,
        aboutTop: document.getElementById('about-anime-list')!.getBoundingClientRect().top,
      };
    });
    expect(after.bodyTop).toBe(before.bodyTop);
    expect(after.rootHeight).toBe(before.rootHeight);
    expect(after.aboutTop).toBe(before.aboutTop);
  });
}
