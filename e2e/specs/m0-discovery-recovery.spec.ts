/** CERT-18: controlled HTTP failure/recovery in the real discovery UI.
 * Only the selected public event-list request is replaced with a 500. Recovery
 * uses the actual local API and seeded database, with no success-response mock.
 * This is not a full Supabase outage or an offline popularity guarantee.
 */
import { expect, test, type Route } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('failed event search shows an error rather than empty results and retries the real API', async ({ page }) => {
  const unhandled: string[] = [];
  page.on('pageerror', error => unhandled.push(error.message));
  const eventList = (url: URL) => url.pathname === '/api/events';
  let failures = 0;
  const outage = async (route: Route) => {
    failures++;
    await route.fulfill({ status: 500, contentType: 'application/json',
      headers: { 'cache-control': 'private, no-store' }, body: JSON.stringify({ error: 'Controlled CERT-18 event-list outage' }) });
  };
  await page.route(eventList, outage);
  try {
    await page.goto('/');
    await expect(page.getByText('Failed to load upcoming events.', { exact: true })).toBeVisible();
    await page.getByPlaceholder('Search events, clubs, categories...').fill('Seed Approved Event');
    const errorSection = page.locator('section').filter({ has: page.getByText('Failed to load events.', { exact: true }) });
    await expect(errorSection).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No events found', exact: true })).toHaveCount(0);
    expect(failures).toBeGreaterThanOrEqual(2);
    expect(unhandled).toEqual([]);

    await page.unroute(eventList, outage);
    const recovered = page.waitForResponse(response => {
      const url = new URL(response.url());
      return eventList(url) && url.searchParams.get('search') === 'Seed Approved Event' && response.status() === 200;
    });
    await errorSection.getByRole('button', { name: 'Try Again', exact: true }).click();
    const response = await recovered;
    const body = await response.json();
    expect(body.events.some((event: { title: string }) => event.title === 'Seed Approved Event')).toBe(true);
    await expect(page.getByText('Seed Approved Event', { exact: true })).toBeVisible();
    await expect(errorSection).toHaveCount(0);
    expect(unhandled).toEqual([]);
  } finally { await page.unroute(eventList, outage); }
});

test('public discovery shows a recoverable error and retry loads real events', async ({ page }) => {
  const unhandled: string[] = [];
  page.on('pageerror', error => unhandled.push(error.message));
  const popular = (url: URL) => url.pathname === '/api/events/popular';
  let failures = 0;
  const outage = async (route: Route) => {
    failures++;
    await route.fulfill({ status: 500, contentType: 'application/json',
      headers: { 'cache-control': 'private, no-store' }, body: JSON.stringify({ error: 'Controlled CERT-18 outage' }) });
  };

  await page.route(popular, outage);
  try {
    await page.goto('/');
    const errorSection = page.locator('section').filter({ hasText: 'Failed to load popular events.' });
    await expect(errorSection).toBeVisible();
    await expect(errorSection.getByRole('button', { name: 'Try Again', exact: true })).toBeVisible();
    expect(failures).toBeGreaterThan(0);
    expect(unhandled).toEqual([]);

    await page.unroute(popular, outage);
    const recovered = page.waitForResponse(response => popular(new URL(response.url())) && response.status() === 200);
    await errorSection.getByRole('button', { name: 'Try Again', exact: true }).click();
    const response = await recovered;
    const body = await response.json();
    expect(body.events.some((event: { title: string }) => event.title === 'Seed Approved Event')).toBe(true);
    const restoredSection = page.locator('section').filter({ has: page.getByRole('heading', { name: /^Trending Events/ }) });
    await expect(restoredSection.getByText('Seed Approved Event', { exact: true })).toBeVisible();
    await expect(errorSection).toHaveCount(0);
    expect(unhandled).toEqual([]);
  } finally {
    await page.unroute(popular, outage);
  }
});
