/** P1-02/03/04 enabled product workflow. Only playwright.m1-m2.config.ts runs
 * this spec. Local disposable account/event/listing; no baseline user writes. */
import { createHash } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '../../src/lib/supabase/types';
import { isLocalSeedTarget, assertSeedTargetAllowed } from '../../scripts/seed/guard';
import { localStackEnv } from '../env';
import { IDS, storageStateFor } from '../fixtures';

const eventId = 'ad070100-0000-4000-8000-000000000001';
const duplicateEventId = 'ad070100-0000-4000-8000-000000000002';
const eventTitle = 'M1 M2 acceptance campus workshop';
const opportunityTitle = 'M1 M2 acceptance research placement';
let db: SupabaseClient<Database>, admin: APIRequestContext;
let opportunityId: string | undefined, uiOpportunityId: string | undefined, accountId: string | undefined;
const accountEmail = `m1-m2-${Date.now()}@example.org`;
const password = 'm1-m2-local-only-password';

test.beforeAll(async ({ playwright, baseURL }) => {
  const stack = localStackEnv();
  assertSeedTargetAllowed(stack.url);
  if (!isLocalSeedTarget(stack.url)) throw new Error('M1/M2 acceptance requires the disposable local stack');
  db = createClient<Database>(stack.url, stack.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  admin = await playwright.request.newContext({ baseURL, storageState: storageStateFor('admin') });
  // A private deterministic namespace makes retries safe without global resets.
  expect((await db.from('events').delete().in('id', [eventId, duplicateEventId])).error).toBeNull();
  const start = new Date(Date.now() + 7 * 86400000).toISOString();
  expect((await db.from('events').insert({ id: eventId, title: eventTitle, description: 'Disposable cross-campus workshop', organizer: 'M1 M2 local fixtures', status: 'approved', source: 'manual', start_date: start, end_date: new Date(Date.parse(start) + 3600000).toISOString(), location: 'Synthetic campus', tags: ['tech'], created_by: IDS.admin, content_hash: createHash('sha256').update(eventId).digest('hex') })).error).toBeNull();
});
test.afterAll(async () => {
  if (db) {
    for (const target of [opportunityId, uiOpportunityId, eventId, duplicateEventId].filter((value): value is string => !!value)) expect((await db.from('admin_audit_log').delete().eq('target_id', target)).error).toBeNull();
    for (const target of [opportunityId, uiOpportunityId].filter((value): value is string => !!value)) expect((await db.from('opportunities').delete().eq('id', target)).error).toBeNull();
    expect((await db.from('events').delete().in('id', [eventId, duplicateEventId])).error).toBeNull();
    if (accountId) { expect((await db.from('users').delete().eq('id', accountId)).error).toBeNull(); expect((await db.auth.admin.deleteUser(accountId)).error).toBeNull(); }
  }
  await admin?.dispose();
});

test('anonymous and mid-onboarding users can browse; future feature families remain closed', async ({ page, browser, request }) => {
  await page.goto('/discover');
  await expect(page.getByRole('heading', { name: /Your next opportunity/ })).toBeVisible();
  expect((await request.get('/api/discovery')).status()).toBe(200);
  for (const path of ['/api/talent/profile', '/api/recruiting/roles', '/recruiting']) expect((await request.get(path)).status()).toBe(404);
  const context = await browser.newContext({ storageState: storageStateFor('mid_onboarding_student') });
  try {
    const mid = await context.newPage(); await mid.goto('/discover');
    await expect(mid.getByRole('heading', { name: /Your next opportunity/ })).toBeVisible();
    expect(new URL(mid.url()).pathname).toBe('/discover');
    await mid.goto('/my-events'); expect(new URL(mid.url()).pathname).toBe('/onboarding');
  } finally { await context.close(); }
});

test('verified non-campus account completes short setup, saves both kinds, and signout clears the shortlist', async ({ browser, baseURL }) => {
  const stack = localStackEnv();
  const created = await db.auth.admin.createUser({ email: accountEmail, password, email_confirm: true, user_metadata: { full_name: 'Non-campus Reader' } });
  expect(created.error).toBeNull(); accountId = created.data.user!.id;
  const emitted: { name: string; value: string; options: CookieOptions }[] = [];
  const client = createServerClient(stack.url, stack.anonKey, { cookies: { getAll: () => [], setAll: values => { emitted.push(...values); } } });
  expect((await client.auth.signInWithPassword({ email: accountEmail, password })).error).toBeNull();
  const context = await browser.newContext({ baseURL });
  await context.addCookies(emitted.map(cookie => ({ name: cookie.name, value: cookie.value, url: baseURL!, httpOnly: false, sameSite: 'Lax' as const })));
  const page = await context.newPage();
  try {
    // Real server-side verified-session admission, with no provider network call.
    await page.goto('/auth/callback?verified=1');
    await expect(page.getByRole('heading', { name: 'Make UNI-VERSE yours' })).toBeVisible();
    expect((await db.auth.admin.getUserById(accountId)).data.user?.email).toBe(accountEmail);
    await page.getByLabel('Display name').fill('Chosen Reader');
    await page.getByLabel('University', { exact: true }).selectOption('unspecified');
    await page.getByRole('button', { name: 'Finish setup' }).click();
    await expect(page).toHaveURL(baseURL + '/');
    const profile = await db.from('users').select('name,roles,onboarding_completed,other_university,affiliation_source').eq('id', accountId).single();
    expect(profile.error).toBeNull(); expect(profile.data).toMatchObject({ name: 'Chosen Reader', roles: ['user'], onboarding_completed: true, other_university: 'Prefer not to specify', affiliation_source: 'self_declared' });
    // Return admission must preserve the user's chosen profile and saved state.
    await page.goto('/auth/callback?verified=1&next=%2Fdiscover');
    await expect(page.getByRole('heading', { name: /Your next opportunity/ })).toBeVisible();
    expect((await db.from('users').select('name').eq('id', accountId).single()).data?.name).toBe('Chosen Reader');

    const draft = await admin.post('/api/admin/opportunities', { data: {
      slug: `m1-m2-acceptance-${Date.now()}`, listing_type: 'job', title: opportunityTitle, description: 'A disposable acceptance listing, not a real offer.', organization: 'M1 M2 local fixtures', work_mode: 'remote', source_url: 'https://example.org/m1-m2-source', action_url: 'https://example.org/m1-m2-apply', relevance_scope: 'cross_campus', fields: ['technology'], checked_at: new Date().toISOString(), review_at: new Date(Date.now() + 14 * 86400000).toISOString(), is_pick: true, pick_reason: 'A fixture to verify transparent curation.',
    } });
    expect(draft.status(), await draft.text()).toBe(201);
    const draftBody = await draft.json(); opportunityId = draftBody.item.id;
    expect((await context.request.get(`/api/opportunities/${opportunityId}`)).status()).toBe(404);
    const published = await admin.patch(`/api/admin/opportunities/${opportunityId}`, { data: { action: 'publish', expected_updated_at: draftBody.item.updated_at } });
    expect(published.status(), await published.text()).toBe(200);
    const metadata = await admin.put(`/api/admin/events/${eventId}/discovery`, { data: { expected_updated_at: null, data: { relevance_scope: 'cross_campus', fields: ['technology'] } } });
    expect(metadata.status(), await metadata.text()).toBe(200);
    // A pending legacy event sharing the published opportunity source must be
    // reviewed before approval. A blocked SQL trigger remains an actionable400.
    expect((await db.from('events').insert({ id: duplicateEventId, title: 'Reviewed duplicate fixture', description: 'Disposable duplicate probe', organizer: 'Other organizer', source_url: 'https://example.org/m1-m2-source', status: 'pending', source: 'manual', start_date: new Date(Date.now() + 9 * 86400000).toISOString(), end_date: new Date(Date.now() + 9 * 86400000 + 3600000).toISOString(), location: 'Synthetic campus', tags: ['tech'], created_by: IDS.admin, content_hash: createHash('sha256').update(duplicateEventId).digest('hex') })).error).toBeNull();
    const blocked = await admin.patch(`/api/admin/events/${duplicateEventId}/status`, { data: { status: 'approved' } });
    expect(blocked.status(), await blocked.text()).toBe(400);
    expect(await blocked.json()).toEqual({ error: 'Review possible duplicates in discovery metadata before approving this event' });
    expect((await db.from('events').select('status').eq('id', duplicateEventId).single()).data?.status).toBe('pending');
    const reviewed = await admin.put(`/api/admin/events/${duplicateEventId}/discovery`, { data: { expected_updated_at: null, data: { relevance_scope: 'cross_campus', duplicate_review_note: 'Reviewed: a separate fixture event from the research opportunity.' } } });
    expect(reviewed.status(), await reviewed.text()).toBe(200);
    expect((await admin.patch(`/api/admin/events/${duplicateEventId}/status`, { data: { status: 'approved' } })).status()).toBe(200);
    // Discovery save clicks exercise the shipped desired-state endpoints.
    await page.goto('/discover?q=M1%20M2%20acceptance');
    for (const title of [opportunityTitle, eventTitle]) {
      const save = page.getByRole('button', { name: `Save ${title}`, exact: true });
      await expect(save).toBeVisible(); await save.click();
      await expect(page.getByRole('button', { name: `Unsave ${title}`, exact: true })).toBeVisible();
    }
    const saved = await context.request.get('/api/saved'); expect(saved.status()).toBe(200);
    const rows = (await saved.json()).items;
    expect(rows.map((row: { kind: string; id: string }) => `${row.kind}:${row.id}`).sort()).toEqual([`event:${eventId}`, `opportunity:${opportunityId}`].sort());
    await page.goto('/saved');
    await expect(page.getByRole('link', { name: opportunityTitle, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: eventTitle, exact: true })).toBeVisible();
    // POST signout runs through the same browser cookie jar. Reload proves the
    // server and hydrated client both discard private saved results.
    expect((await context.request.post('/auth/signout', { maxRedirects: 0 })).status()).toBe(302);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Keep a shortlist of what matters.' })).toBeVisible();
    await expect(page.getByRole('link', { name: opportunityTitle, exact: true })).toHaveCount(0);
    expect((await context.request.get('/api/saved')).status()).toBe(401);
  } finally { await context.close(); }
});


test('360px discovery and 200% equivalent desktop reflow retain navigation, filters, and theme parity', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await page.goto('/discover');
  await expect(page.getByRole('heading', { name: /Your next opportunity/ })).toBeVisible();
  const noOverflow = async () => {
    const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
    expect(width.scroll).toBeLessThanOrEqual(width.viewport + 1);
  };
  await noOverflow();
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await menu.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
  const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(navigation).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(navigation.getByRole('link').first()).toBeFocused();
  await page.getByRole('button', { name: 'Close navigation' }).click();
  await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption('job');
  await expect(page).toHaveURL(/type=job/);
  await expect(page.getByRole('combobox', { name: 'Type', exact: true })).toHaveValue('job');
  await noOverflow();
  await page.screenshot({ path: testInfo.outputPath('discovery-mobile-light.png'), fullPage: true });
  await page.getByRole('button', { name: 'Toggle color scheme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await noOverflow();
  await page.screenshot({ path: testInfo.outputPath('discovery-mobile-dark.png'), fullPage: true });
  // A 1440x900 desktop at200% browser zoom exposes720x450 CSS pixels. Test
  // that equivalent layout viewport explicitly; this is not a claim that
  // pinch/pageScaleFactor exercises browser text zoom or OS magnification.
  await page.setViewportSize({ width: 720, height: 450 });
  await noOverflow();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  await page.getByLabel('Search opportunities').fill('cross campus');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/q=cross\+campus/);
  await expect(page.getByLabel('Search opportunities')).toHaveValue('cross campus');
  await noOverflow();
  await page.screenshot({ path: testInfo.outputPath('discovery-desktop-200percent-reflow.png'), fullPage: true });
});

test('admin quick-add prepares, previews, and publishes a listing through the UI within two minutes', async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({ baseURL, storageState: storageStateFor('admin') });
  try {
    const page = await context.newPage();
    await page.goto('/moderation/opportunities');
    await expect(page.getByRole('heading', { name: 'Quick add', exact: false })).toBeVisible();
    const editor = page.locator('form').filter({ has: page.getByRole('heading', { name: 'The opportunity', exact: true }) });
    const title = `M1 M2 UI quick add ${Date.now()}`;
    const started = Date.now();
    await editor.getByLabel('Start from a source URL').fill(`https://example.org/quick-add-${Date.now()}`);
    await editor.getByRole('button', { name: 'Fill from URL' }).click();
    await expect(editor.getByLabel('Source URL', { exact: true })).toHaveValue(/https:\/\/example.org\/quick-add-/);
    await editor.getByLabel('Title', { exact: true }).fill(title);
    await editor.getByRole('combobox', { name: 'Type', exact: true }).selectOption('job');
    await editor.getByLabel('Organizer / organization', { exact: true }).fill('Acceptance editorial desk');
    await editor.getByLabel('Description', { exact: true }).fill('A prepared synthetic placement for local acceptance verification, not an actual offer.');
    await editor.getByRole('combobox', { name: 'Work mode', exact: true }).selectOption('remote');
    await editor.getByLabel(/^Next review/).fill(new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 16));
    await editor.getByRole('button', { name: 'Mark source checked now' }).click();
    await editor.getByLabel('Fields (comma separated)').fill('technology, business');
    await editor.getByRole('button', { name: 'Preview draft' }).click();
    await expect(editor.getByRole('region', { name: 'Draft preview' }).getByRole('heading', { name: title })).toBeVisible();
    const [draft] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/api/admin/opportunities') && response.request().method() === 'POST'),
      editor.getByRole('button', { name: 'Save draft', exact: true }).click(),
    ]);
    expect(draft.status(), await draft.text()).toBe(201);
    const body = await draft.json(); uiOpportunityId = body.item.id;
    expect(body.item.fields).toEqual(['technology', 'business']);
    await expect(editor.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
    const [published] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith(`/api/admin/opportunities/${uiOpportunityId}`) && response.request().method() === 'PATCH'),
      editor.getByRole('button', { name: 'Publish', exact: true }).click(),
    ]);
    expect(published.status(), await published.text()).toBe(200);
    await expect(editor.getByRole('status')).toHaveText('Published. The listing is available in discovery.');
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(120_000);
    await testInfo.attach('quick-add-timing.json', { body: JSON.stringify({ elapsed_ms: elapsed, method: 'automated prepared-data entry through shipped UI; excludes initial navigation', listing_id: uiOpportunityId }), contentType: 'application/json' });
    await page.goto(`/discover?q=${encodeURIComponent(title)}`);
    await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
  } finally { await context.close(); }
});

test('real local email OTP rejects a wrong code and retains new and returning verified sessions', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const email = `m1-m2-otp-${Date.now()}@example.org`;
  let otpUserId: string | undefined;
  const context = await browser.newContext({ baseURL });
  try {
    const page = await context.newPage();
    const consumedMessages = new Set<string>();
    async function requestCode() {
      await page.goto('/discover');
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
      await page.getByLabel('Email address').fill(email);
      await page.getByRole('button', { name: 'Send sign-in code', exact: true }).click();
      await expect(page.getByLabel('Email code', { exact: true })).toBeVisible();
      // Only the guarded local Mailpit is read. No provider or external inbox.
      let token = '';
      await expect.poll(async () => {
        const listing = await fetch('http://127.0.0.1:54324/api/v1/messages').then(response => response.json()) as { messages: { ID: string; To: { Address: string }[] }[] };
        const message = listing.messages.find(entry => !consumedMessages.has(entry.ID) && entry.To.some(to => to.Address === email));
        if (!message) return false;
        const body = await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`).then(response => response.json()) as { Text?: string; HTML?: string };
        token = (body.Text || body.HTML || '').match(/\b\d{6}\b/)?.[0] ?? '';
        if (token.length === 6) consumedMessages.add(message.ID);
        return token.length === 6;
      }, { message: 'A code must arrive in the local synthetic inbox', timeout: 10_000 }).toBe(true);
      return token;
    }
    // Hold the admission callback to expose the original first-login race:
    // publishing Auth-only client state prefetches/profile and/saved, whose
    // missing-profile redirects revoke the session before synchronization.
    let callbackPending = false;
    const prematureProtectedPages: string[] = [];
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (callbackPending && ['/profile', '/saved'].includes(path)) prematureProtectedPages.push(path);
    });
    await page.route('**/auth/callback?**', async route => {
      callbackPending = true;
      await new Promise(resolve => setTimeout(resolve, 4000));
      await route.continue();
      callbackPending = false;
    });
    const code = await requestCode();
    const wrong = ((Number(code) + 1) % 1_000_000).toString().padStart(6, '0');
    await page.getByLabel('Email code', { exact: true }).fill(wrong);
    await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('invalid or expired');
    await page.getByLabel('Email code', { exact: true }).fill(code);
    await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toHaveCount(0);
    await page.goto('/profile'); await expect(page).toHaveURL(baseURL + '/profile');
    expect(prematureProtectedPages, 'OTP identity must not enable protected-link prefetch before profile sync').toEqual([]);
    const user = await db.from('users').select('id,email,onboarding_completed').eq('email', email).single();
    expect(user.error).toBeNull(); otpUserId = user.data!.id;
    expect(user.data).toMatchObject({ email, onboarding_completed: false });
    expect((await db.auth.admin.getUserById(otpUserId)).data.user?.email_confirmed_at).toBeTruthy();
    expect((await context.request.post('/auth/signout', { maxRedirects: 0 })).status()).toBe(302);
    await page.goto('/profile'); await expect(page).toHaveURL(/signin=required/);
    // Returning accounts use the magic-link/code template instead of signup
    // confirmation. Prove both actual delivery paths retain the same profile.
    const secondCode = await requestCode();
    await page.getByLabel('Email code', { exact: true }).fill(secondCode);
    await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toHaveCount(0);
    await page.goto('/profile'); await expect(page).toHaveURL(baseURL + '/profile');
    const retained = await db.from('users').select('id').eq('email', email).single();
    expect(retained.data?.id).toBe(otpUserId);
  } finally {
    await context.close();
    if (!otpUserId) {
      const users = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      otpUserId = users.data.users.find(user => user.email === email)?.id;
    }
    if (otpUserId) {
      expect((await db.from('users').delete().eq('id', otpUserId)).error).toBeNull();
      expect((await db.auth.admin.deleteUser(otpUserId)).error).toBeNull();
    }
  }
});
