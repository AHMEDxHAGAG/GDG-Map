import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { tracks, mapSize } from '../../src/tracks.js';

test.beforeEach(async ({ page }) => {
  page.runtimeErrors = [];
  page.on('pageerror', error => page.runtimeErrors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(page.runtimeErrors).toEqual([]);
});

async function openIsland(page, name) {
  await page.locator('summary').click();
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.locator('#map-viewport')).toHaveAttribute('data-travelling', 'false');
}

async function swipe(page, from, to) {
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let step = 1; step <= 12; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 12, y: from.y + (to.y - from.y) * step / 12 }] });
    await page.waitForTimeout(24);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

test('map loads with real artwork and no runtime errors', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#skip-reveal')).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#web img')).toHaveJSProperty('complete', true);
  expect(await page.locator('#web img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'Pirate Expedition' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(testInfo.project.use.viewport.width);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-initial.png` });
  expect(errors).toEqual([]);
});

test('every island is reachable with visible copy and correct crew link', async ({ page }) => {
  await page.goto('/');
  for (const track of tracks) {
    await openIsland(page, track.name);
    const island = page.locator(`#${track.id}`);
    await expect(island).toHaveClass(/is-selected/);
    await expect(island.locator('h2')).toBeFocused();
    await expect(island.locator('.crew-link')).toHaveAttribute('href', track.whatsapp);
    const bounds = await island.boundingBox();
    const viewport = page.viewportSize();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(75);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThan(viewport.height);
  }
});

test('controls have at least 44px targets and keyboard navigation works', async ({ page }) => {
  await page.goto('/');
  const summary = page.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#island-menu')).toHaveAttribute('open', '');
  for (const element of await page.locator('summary, .island-menu a, .crew-link, #dismiss-hint, #wave-toggle').all()) {
    const box = await element.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Web', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#web h2')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#web .crew-link')).toBeFocused();
});

test('wheel input immediately cancels both travel axes', async ({ page }) => {
  await page.goto('/');
  await page.locator('summary').click();
  await page.getByRole('link', { name: 'Cybersecurity', exact: true }).click();
  await expect(page.locator('#map-viewport')).toHaveAttribute('data-travelling', 'true');
  await page.mouse.move(90, 450);
  await page.mouse.wheel(65, 120);
  await expect(page.locator('#map-viewport')).toHaveAttribute('data-travelling', 'false');
  expect(await page.evaluate(() => window.gsap.getTweensOf(document.querySelector('#map-viewport')).length)).toBe(0);
});

test('reduced motion uses instant navigation and no decorative tweens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#skip-reveal')).toBeHidden();
  await expect(page.locator('#map-viewport')).toHaveAttribute('data-reduced-motion', 'true');
  await openIsland(page, 'Data Science');
  expect(await page.evaluate(() => window.gsap.getTweensOf([...document.querySelectorAll('.island-art'), document.querySelector('#map')]).length)).toBe(0);
  await expect(page.locator('#route-reveal')).toHaveCount(0);
  await expect(page.locator('#wave-toggle')).toBeHidden();
  expect(await page.evaluate(() => window.gsap.getTweensOf('.wave-mark').length)).toBe(0);
});

test('wave marks roll gently, can be paused, and stop for reduced motion', async ({ page }) => {
  await page.goto('/');
  const wave = page.locator('.wave-mark').first();
  const initial = await wave.getAttribute('d');
  await expect.poll(() => wave.getAttribute('d')).not.toBe(initial);
  await page.locator('summary').click();
  await page.getByRole('button', { name: 'Pause waves', exact: true }).click();
  const paused = await wave.getAttribute('d');
  await page.waitForTimeout(150);
  expect(await wave.getAttribute('d')).toBe(paused);
  await page.getByRole('button', { name: 'Resume waves', exact: true }).click();
  await expect.poll(() => wave.getAttribute('d')).not.toBe(paused);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#wave-toggle')).toBeHidden();
  expect(await page.evaluate(() => window.gsap.getTweensOf('.wave-mark').length)).toBe(0);
  const still = await wave.getAttribute('d');
  await page.waitForTimeout(150);
  expect(await wave.getAttribute('d')).toBe(still);
});

test('crew links use the supplied banner without obscuring text or destinations', async ({ page }) => {
  await page.goto('/');
  await openIsland(page, 'Web');
  const link = page.locator('#web .crew-link');
  await expect(link).toHaveText('Join the crew');
  expect(await link.evaluate(element => getComputedStyle(element).backgroundImage)).toContain('crew-banner-');
  await expect(link).toHaveAttribute('href', tracks[0].whatsapp);
});

test('full map retains the star formation on a large screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One overview capture is enough');
  await page.setViewportSize(mapSize);
  await page.goto('/');
  await expect(page.locator('#skip-reveal')).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
  for (const track of tracks) {
    const bounds = await page.locator(`#${track.id}`).boundingBox();
    expect(bounds.x + bounds.width / 2).toBe(track.x);
    expect(bounds.y).toBe(track.y);
  }
  await page.screenshot({ path: 'test-results/star-map-overview.png' });
});

test('reveal can be skipped without hiding or blocking the map', async ({ page }) => {
  await page.goto('/');
  await page.locator('#skip-reveal').click();
  await expect(page.locator('#skip-reveal')).toBeHidden();
  await expect(page.locator('#map')).toHaveCSS('opacity', '1');
});

test('native diagonal swipes explore both axes without opening crew links', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'Touchscreen emulation only');
  await page.goto('/');
  const before = await page.locator('#map-viewport').evaluate(element => ({ x: element.scrollLeft, y: element.scrollTop }));
  await swipe(page, { x: page.viewportSize().width - 40, y: 620 }, { x: 50, y: 370 });
  await expect.poll(() => page.locator('#map-viewport').evaluate(element => element.scrollLeft)).toBeGreaterThan(before.x + 50);
  await expect.poll(() => page.locator('#map-viewport').evaluate(element => element.scrollTop)).toBeGreaterThan(before.y + 50);
  expect(page.context().pages()).toHaveLength(1);
  await expect(page.locator('#explore-hint')).toBeHidden();
});

test('dragging from a crew link does not trigger an accidental tap', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'Touchscreen emulation only');
  await page.goto('/');
  await openIsland(page, 'Web');
  const box = await page.locator('#web .crew-link').boundingBox();
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await swipe(page, from, { x: from.x - 95, y: from.y - 180 });
  expect(page.context().pages()).toHaveLength(1);
});

test('direct links and history navigation restore the island', async ({ page }) => {
  await page.goto('/#cybersecurity');
  await expect(page.locator('#cybersecurity')).toHaveClass(/is-selected/);
  await openIsland(page, 'AI');
  await page.goBack();
  await expect(page.locator('#cybersecurity')).toHaveClass(/is-selected/);
  const box = await page.locator('#cybersecurity .crew-link').boundingBox();
  expect(box.y).toBeGreaterThan(0);
  expect(box.y + box.height).toBeLessThan(page.viewportSize().height);
});

test('a real crew tap opens the matching WhatsApp destination', async ({ page, context }) => {
  // Do not visit or join an external group during automated testing.
  await context.route('https://chat.whatsapp.com/**', route => route.fulfill({ body: '<title>WhatsApp test destination</title>', contentType: 'text/html' }));
  await page.goto('/');
  await openIsland(page, 'Cybersecurity');
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#cybersecurity .crew-link').click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(tracks[4].whatsapp);
  await popup.close();
});

test('hint is first-visit only, even after a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#explore-hint')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss exploration hint' }).click();
  await page.reload();
  await expect(page.locator('#explore-hint')).toBeHidden();
});

test('changing reduced-motion preference cancels ongoing travel', async ({ page }) => {
  await page.goto('/');
  await page.locator('summary').click();
  await page.getByRole('link', { name: 'Cybersecurity', exact: true }).click();
  await expect(page.locator('#map-viewport')).toHaveAttribute('data-travelling', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#map-viewport')).toHaveAttribute('data-travelling', 'false');
  await expect(page.locator('#map-viewport')).toHaveAttribute('data-reduced-motion', 'true');
  await openIsland(page, 'AI');
  await expect(page.locator('#ai h2')).toBeFocused();
});

test('touch input cancels animated travel without hijacking the gesture', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'Touchscreen emulation only');
  await page.goto('/');
  await page.locator('summary').click();
  await page.getByRole('link', { name: 'Cybersecurity', exact: true }).click();
  await expect(page.locator('#map-viewport')).toHaveAttribute('data-travelling', 'true');
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 80, y: 450 }] });
  await expect(page.locator('#map-viewport')).toHaveAttribute('data-travelling', 'false');
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
});

test('map and crew links remain usable without JavaScript', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('summary').click();
  await page.getByRole('link', { name: 'Cybersecurity', exact: true }).click();
  await expect(page).toHaveURL(/#cybersecurity$/);
  const box = await page.locator('#cybersecurity .crew-link').boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThan(page.viewportSize().height);
  await context.close();
});

test('cold mobile load stays under the static payload and timing budgets', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'Mobile loading budget');
  const session = await page.context().newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  await session.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 400000, uploadThroughput: 200000 });
  await page.addInitScript(() => {
    window.loadingMetrics = { layoutShift: 0, largestPaint: 0 };
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.loadingMetrics.layoutShift += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) window.loadingMetrics.largestPaint = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const metrics = await page.evaluate(() => ({
    bytes: performance.getEntriesByType('resource').reduce((sum, entry) => sum + entry.transferSize, 0),
    domReady: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
    ...window.loadingMetrics,
  }));
  expect(metrics.bytes).toBeLessThan(1100000);
  expect(metrics.domReady).toBeLessThan(5000);
  expect(metrics.largestPaint).toBeGreaterThan(0);
  expect(metrics.largestPaint).toBeLessThan(5000);
  expect(metrics.layoutShift).toBeLessThan(.1);
  await testInfo.attach('loading-metrics', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
  await writeFile(`test-results/${testInfo.project.name}-loading.json`, JSON.stringify(metrics, null, 2));
  await session.detach();
});
