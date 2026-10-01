/** CERT-08 participation journeys. ad070004 is disposable and disjoint from
 * the default seed and other certification specs. No new sign-ins, global
 * dataset loads, reset, or baseline row updates. Setup is not workflow proof.
 */
import { createHash } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/types';
import { assertSeedTargetAllowed, isLocalSeedTarget } from '../../scripts/seed/guard';
import { localStackEnv } from '../env';
import { IDS, storageStateFor } from '../fixtures';

const id = (n: number) => `ad070004-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const club = id(1), future = id(10), past = id(11), ongoing = id(12);
const hour = id(13), tomorrow = id(14), later = id(15), pending = id(16), deleted = id(17);
const events = [future, past, ongoing, hour, tomorrow, later, pending, deleted];
const reminderEvents = [hour, tomorrow, later, pending, deleted];
let db: SupabaseClient<Database>;
let owner: APIRequestContext, attendee: APIRequestContext, outsider: APIRequestContext;

async function cleanup() {
  if (!db) return;
  // Explicit notification cleanup also covers schemas where event FK is SET NULL.
  for (const result of [await db.from('notifications').delete().in('event_id', events), await db.from('events').delete().in('id', events), await db.from('clubs').delete().eq('id', club)]) {
    expect(result.error, 'participation fixture cleanup').toBeNull();
  }
}
async function rsvp(request: APIRequestContext, eventId: string, userId: string, status: 'going' | 'interested') {
  const response = await request.post(`/api/events/${eventId}/rsvp`, { data: { user_id: userId, status } });
  expect([200, 201]).toContain(response.status());
}
async function state(request: APIRequestContext, eventId: string) {
  const response = await request.get(`/api/events/${eventId}/rsvp`);
  expect(response.status()).toBe(200);
  return response.json();
}
async function reviews(request: APIRequestContext, eventId: string) {
  const response = await request.get(`/api/events/${eventId}/reviews`);
  expect(response.status()).toBe(200);
  return response.json();
}

test.use({ storageState: storageStateFor('onboarded_student') });
test.beforeAll(async ({ playwright, baseURL }) => {
  const env = localStackEnv();
  if (!isLocalSeedTarget(env.url)) throw new Error('Participation certification requires a local stack');
  assertSeedTargetAllowed(env.url);
  db = createClient<Database>(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await cleanup();
  owner = await playwright.request.newContext({ baseURL, storageState: storageStateFor('club_owner') });
  attendee = await playwright.request.newContext({ baseURL, storageState: storageStateFor('club_member') });
  outsider = await playwright.request.newContext({ baseURL, storageState: storageStateFor('cross_club_attacker') });
  expect((await db.from('clubs').insert({ id: club, name: 'M0 Participation Club', description: 'Disposable workflow club', category: 'academic', status: 'approved', created_by: IDS.club_owner })).error).toBeNull();
  expect((await db.from('club_members').insert({ club_id: club, user_id: IDS.club_owner, role: 'owner' })).error).toBeNull();
  const now = Date.now();
  const times = [now + 7 * 86400000, now - 2 * 86400000, now - 3600000, now + 3600000, now + 86400000, now + 3 * 3600000, now + 3600000, now + 3600000];
  expect((await db.from('events').insert(events.map((eventId, i) => ({
    id: eventId, title: `M0 Participation ${i}`, description: 'Disposable participation workflow', organizer: 'M0 Participation Club', club_id: club, created_by: IDS.club_owner,
    status: eventId === pending ? 'pending' : 'approved', deleted_at: eventId === deleted ? new Date(now).toISOString() : null,
    start_date: new Date(times[i]).toISOString(), end_date: new Date(times[i] + 2 * 3600000).toISOString(), location: 'Synthetic campus', tags: ['tech'], source: 'manual', content_hash: createHash('sha256').update(eventId).digest('hex'),
  })))).error).toBeNull();
  // A second attendee makes aggregate transitions observable rather than zero-only.
  expect((await db.from('rsvps').insert({ event_id: future, user_id: IDS.club_owner, status: 'going' })).error).toBeNull();
});
test.afterAll(async () => {
  try { await cleanup(); } finally { await Promise.all([owner?.dispose(), attendee?.dispose(), outsider?.dispose()]); }
});

test('RSVP interested → going → cancelled persists after reload and changes public aggregates', async ({ page, request }) => {
  await page.goto(`/events/${future}`);
  const [interested] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith(`/api/events/${future}/rsvp`) && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Interested', exact: true }).click(),
  ]);
  expect(interested.status()).toBe(201);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  let current = await state(request, future);
  expect(current.user_rsvp.status).toBe('interested');
  expect(current.counts).toEqual({ going: 1, interested: 1, total: 2 });
  await expect(page.locator('span', { hasText: /^\s*\d+\s+interested\s*$/ }).locator('strong')).toHaveText('1');
  const [going] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith(`/api/events/${future}/rsvp`) && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Going', exact: true }).click(),
  ]);
  expect(going.status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  current = await state(request, future);
  expect(current.user_rsvp.status).toBe('going');
  expect(current.counts).toEqual({ going: 2, interested: 0, total: 2 });
  const [cancelled] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith(`/api/events/${future}/rsvp`) && r.request().method() === 'DELETE'),
    page.getByRole('button', { name: 'Cancel', exact: true }).click(),
  ]);
  expect(cancelled.status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Going', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Interested', exact: true })).toBeVisible();
  expect(await state(request, future)).toMatchObject({ user_rsvp: null, counts: { going: 1, interested: 0, total: 1 } });
  const rows = await db.from('rsvps').select('status').eq('event_id', future).eq('user_id', IDS.onboarded_student);
  expect(rows.error).toBeNull(); expect(rows.data).toEqual([{ status: 'cancelled' }]);
  // F-084 / DEC-31: events.rsvp_count is a known unmaintained legacy
  // export field, not the authoritative attendance source. Verify the actual
  // aggregate RPC and persisted active rows independently of the route/UI.
  const aggregate = await db.rpc('get_public_event_rsvp_counts', { target_event_id: future });
  expect(aggregate.error).toBeNull();
  expect(aggregate.data).toEqual([{ going: 1, interested: 0 }]);
  const active = await db.from('rsvps').select('id', { count: 'exact', head: true }).eq('event_id', future).in('status', ['going', 'interested']);
  expect(active.error).toBeNull(); expect(active.count).toBe(1);
});

// P1-03 intentionally supersedes M0's public stars/organizer aggregates.
// Service setup represents retained old data; no legacy write is a workflow.
test('legacy review history stays private to author and admin; organizers and strangers get none', async ({ page, request, playwright, baseURL }) => {
  expect((await db.from('reviews').insert([
    { event_id: past, user_id: IDS.onboarded_student, rating: 5, comment: 'Private author history' },
    { event_id: past, user_id: IDS.club_member, rating: 3, comment: 'Other private history' },
  ])).error).toBeNull();
  const administrator = await playwright.request.newContext({ baseURL, storageState: storageStateFor('admin') });
  const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    expect((await anonymous.get(`/api/events/${past}/reviews`)).status()).toBe(401);
    const own = await reviews(request, past);
    expect(Object.keys(own)).toEqual(['reviews']);
    expect(own.reviews).toHaveLength(1);
    expect(own.reviews[0]).toMatchObject({ user_id: IDS.onboarded_student, rating: 5, comment: 'Private author history' });
    expect(await reviews(owner, past)).toEqual({ reviews: [] });
    expect(await reviews(outsider, past)).toEqual({ reviews: [] });
    expect((await reviews(administrator, past)).reviews).toHaveLength(2);
    await page.goto(`/events/${past}`);
    const history = page.getByRole('region', { name: 'Private legacy review history' });
    await expect(history).toContainText('Private author history');
    await expect(page.getByText('Other private history', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Submit Review', exact: true })).toHaveCount(0);
    expect((await request.post(`/api/events/${past}/reviews`, { data: { rating: 1, comment: 'new legacy write' } })).status()).toBe(404);
    await page.reload();
    await expect(history).toContainText('Legacy rating: 5/5');
  } finally { await administrator.dispose(); await anonymous.dispose(); }
});

test('legacy writes remain retired for future and ongoing events even for a going attendee', async ({ request, page }) => {
  for (const eventId of [future, ongoing]) {
    await rsvp(request, eventId, IDS.onboarded_student, 'going');
    expect(await reviews(request, eventId)).toEqual({ reviews: [] });
    const response = await request.post(`/api/events/${eventId}/reviews`, { data: { rating: 5 } });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'Legacy review submissions are closed' });
  }
  await page.goto(`/events/${ongoing}`);
  await expect(page.getByRole('heading', { name: 'M0 Participation 2', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '5 stars', exact: true })).toHaveCount(0);
  expect((await db.from('reviews').select('id').in('event_id', [future, ongoing])).data).toHaveLength(0);
});

test('actual reminder function sends only due approved saved events once; recipient reads it and unread count drops', async ({ request, page }) => {
  for (const eventId of [hour, tomorrow, later]) {
    const response = await request.post(`/api/events/${eventId}/save`);
    expect(response.status()).toBe(200); expect((await response.json()).saved).toBe(true);
  }
  // Hidden saved rows are setup solely to assert the function's exclusion rule.
  expect((await db.from('saved_events').insert([pending, deleted].map(event_id => ({ event_id, user_id: IDS.onboarded_student })))).error).toBeNull();
  // This existing global function has no event argument. Fail closed before
  // invoking it if any unrelated saved event could fall in either due window.
  // Conservative margins cover elapsed time between preflight and invocation.
  const now = Date.now(), at = (minutes: number) => new Date(now + minutes * 60000).toISOString();
  const potentiallyDue = await db.from('events').select('id').eq('status', 'approved').is('deleted_at', null)
    .or(`and(start_date.gte.${at(54)},start_date.lte.${at(66)}),and(start_date.gte.${at(1379)},start_date.lte.${at(1501)})`);
  expect(potentiallyDue.error).toBeNull();
  const foreign = (potentiallyDue.data ?? []).map(row => row.id).filter(eventId => !events.includes(eventId));
  if (foreign.length) {
    const saves = await db.from('saved_events').select('id').in('event_id', foreign).limit(1);
    expect(saves.error).toBeNull();
    expect(saves.data, 'refusing global reminder invocation with unrelated due saved events').toHaveLength(0);
  }
  const first = await db.rpc('send_event_reminders');
  expect(first.error).toBeNull(); expect(first.data).toMatchObject({ '1h': 1, '24h': 1 });
  const second = await db.rpc('send_event_reminders');
  expect(second.error).toBeNull(); expect(second.data).toMatchObject({ '1h': 0, '24h': 0 });
  const delivered = await db.from('notifications').select('id,event_id,type,read,user_id,message').in('event_id', reminderEvents).order('event_id');
  expect(delivered.error).toBeNull();
  expect(delivered.data).toHaveLength(2);
  expect(delivered.data?.map(row => ({ event_id: row.event_id, type: row.type, user_id: row.user_id, read: row.read }))).toEqual([
    { event_id: hour, type: 'reminder_1h', user_id: IDS.onboarded_student, read: false },
    { event_id: tomorrow, type: 'reminder_24h', user_id: IDS.onboarded_student, read: false },
  ]);
  const unread = await request.get('/api/notifications/count');
  expect(unread.status()).toBe(200);
  const before = (await unread.json()).unread_count;
  const listing = await request.get('/api/notifications');
  expect(listing.status()).toBe(200);
  const list = await listing.json();
  expect(list.notifications.map((row: { id: string }) => row.id)).toEqual(expect.arrayContaining(delivered.data!.map(row => row.id)));
  const notification = delivered.data![0];
  await page.goto('/notifications');
  const item = page.getByRole('link').filter({ hasText: notification.message! });
  await expect(item).toBeVisible();
  const [marked] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith(`/api/notifications/${notification.id}`) && r.request().method() === 'PATCH'),
    item.click(),
  ]);
  expect(marked.status()).toBe(200);
  expect((await request.get('/api/notifications/count').then(r => r.json())).unread_count).toBe(before - 1);
  expect((await db.from('notifications').select('read').eq('id', notification.id).single()).data?.read).toBe(true);
  await page.goto('/notifications');
  await expect(page.getByRole('link').filter({ hasText: notification.message! })).toBeVisible();
  expect((await request.get('/api/notifications').then(r => r.json())).notifications.find((row: { id: string }) => row.id === notification.id).read).toBe(true);
});
