/** CERT-02: real route/browser/DB probes in a disposable namespace.
 * Does not load either certification dataset or alter default event fixtures.
 * Probe-to-test coverage and external limits: e2e/adversarial-coverage.ts.
 */
import { createHash } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/types';
import { generateCertificationData } from '../../scripts/seed/certificationData';
import { assertSeedTargetAllowed, isLocalSeedTarget } from '../../scripts/seed/guard';
import { localStackEnv } from '../env';
import { IDS, PERSONA_CREDENTIALS, storageStateFor } from '../fixtures';
import { ADVERSARIAL_COVERAGE } from '../adversarial-coverage';

const probes = generateCertificationData('adversarial').probes;
const id = (n: number) => `ad070002-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const club = id(1), event = id(10), expired = id(11), hidden = id(12), notice = id(30), expiredToken = id(31);
const title = '<script>alert(1)</script> CERT02 literal title';
let db: SupabaseClient<Database>;
let owner: APIRequestContext;
// More than 50 eligible rows make the oversized recommendation probe prove
// its cap against actual rows, rather than pass with an undersized dataset.
const eventIds = [event, expired, hidden, id(13), id(14), id(15), id(16), ...Array.from({ length: 60 }, (_, i) => id(100 + i))];
async function clean() {
  if (!db) return;
  // Exact owned ids only. Cascades remove memberships, invitations and joins.
  for (const result of [await db.from('notifications').delete().eq('id', notice), await db.from('events').delete().in('id', eventIds), await db.from('clubs').delete().eq('id', club)]) {
    expect(result.error, 'disposable fixture cleanup').toBeNull();
  }
}

test.use({ storageState: storageStateFor('onboarded_student'), timezoneId: 'America/Toronto' });
test.beforeAll(async ({ playwright, baseURL }) => {
  const env = localStackEnv();
  // The no-env-file local-only check precedes the shared allowlist and client.
  if (!isLocalSeedTarget(env.url)) throw new Error('CERT02 browser writes require the local stack');
  assertSeedTargetAllowed(env.url);
  db = createClient<Database>(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await clean();
  owner = await playwright.request.newContext({ baseURL, storageState: storageStateFor('club_owner') });
  expect((await db.from('clubs').insert({ id: club, name: 'CERT02 disposable club', status: 'approved', created_by: IDS.club_owner, description: 'CERT02 fixture', category: 'academic' })).error).toBeNull();
  expect((await db.from('club_members').insert({ club_id: club, user_id: IDS.club_owner, role: 'owner' })).error).toBeNull();
  const times = ['2036-06-01T16:00:00Z', '2016-06-01T16:00:00Z', '2036-06-02T16:00:00Z', '2026-03-08T06:59:59Z', '2026-03-08T07:00:00Z', '2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z', ...Array.from({ length: 60 }, () => '2036-06-03T16:00:00Z')];
  expect((await db.from('events').insert(eventIds.map((eventId, i) => ({ id: eventId, title: i === 0 ? title : `CERT02 event ${i}`, description: 'Disposable adversarial certification fixture', organizer: 'CERT02 disposable club', club_id: club, created_by: IDS.club_owner, status: i === 2 ? 'pending' : 'approved', start_date: times[i], end_date: new Date(Date.parse(times[i]) + 7200000).toISOString(), location: 'Synthetic campus', tags: ['tech'], source: 'manual', content_hash: createHash('sha256').update(eventId).digest('hex') })))).error).toBeNull();
  expect((await db.from('notifications').insert({ id: notice, user_id: IDS.club_owner, title: 'CERT02 private notice', message: 'Private', type: 'event_reminder', read: false })).error).toBeNull();
  expect((await db.from('club_invitations').insert({ id: id(32), token: expiredToken, club_id: club, inviter_id: IDS.club_owner, invitee_email: PERSONA_CREDENTIALS.onboarded_student.email, expires_at: '2016-01-01T00:00:00Z', status: 'pending' })).error).toBeNull();
});
test.afterAll(async () => { try { await clean(); } finally { await owner?.dispose(); } });

test('the 29 probe catalog entries each name executable evidence and its limits', () => {
  expect(Object.keys(ADVERSARIAL_COVERAGE).sort()).toEqual(probes.map(p => p.id).sort());
});

test('injection-0..4: searches preserve visibility and script titles render as text', async ({ request, page }) => {
  for (const probe of probes.filter(p => p.id.startsWith('injection-'))) {
    const response = await request.get('/api/events', { params: { search: String(probe.input), limit: 100 } });
    expect(response.status(), probe.id).toBe(200);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain(hidden);
  }
  let dialogs = 0;
  page.on('dialog', async dialog => { dialogs++; await dialog.dismiss(); });
  await page.goto(`/events/${event}`);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  expect(dialogs).toBe(0);
  const intact = await db.from('events').select('id').in('id', eventIds);
  expect(intact.error).toBeNull();
  expect(intact.data).toHaveLength(eventIds.length);
});

test('unsafe-link-0..2: owner cannot persist executable or relative registration URLs', async () => {
  for (const probe of probes.filter(p => p.id.startsWith('unsafe-link-'))) {
    const response = await owner.patch(`/api/events/${event}`, { data: { rsvp_link: probe.input } });
    expect(response.status(), probe.id).toBe(400);
  }
  expect((await db.from('events').select('rsvp_link').eq('id', event).single()).data?.rsvp_link).toBeNull();
});

test('duplicate-rsvp and duplicate-save: one row per user/event and explicit save toggle', async ({ request }) => {
  for (let i = 0; i < 2; i++) {
    const response = await request.post(`/api/events/${event}/rsvp`, { data: { user_id: IDS.onboarded_student, status: 'going' } });
    expect([200, 201]).toContain(response.status());
  }
  const rsvps = await db.from('rsvps').select('id').eq('event_id', event).eq('user_id', IDS.onboarded_student);
  expect(rsvps.error).toBeNull(); expect(rsvps.data).toHaveLength(1);
  expect((await request.get(`/api/events/${event}/rsvp`).then(r => r.json())).counts.going).toBe(1);
  const saved = await request.post(`/api/events/${event}/save`, { data: { user_id: IDS.onboarded_student } });
  expect(saved.status()).toBe(200); expect((await saved.json()).saved).toBe(true);
  const duplicate = await db.from('saved_events').insert({ event_id: event, user_id: IDS.onboarded_student });
  expect(duplicate.error?.code).toBe('23505');
  expect((await db.from('saved_events').select('id').eq('event_id', event).eq('user_id', IDS.onboarded_student)).data).toHaveLength(1);
  const unsaved = await request.post(`/api/events/${event}/save`, { data: { user_id: IDS.onboarded_student } });
  expect(unsaved.status()).toBe(200); expect((await unsaved.json()).saved).toBe(false);
});

test('expired-invite and duplicate-invitation: expiry blocks writes and acceptance creates one membership', async ({ page }) => {
  await page.goto(`/invites/${expiredToken}`);
  await expect(page.getByRole('heading', { name: 'Invitation Expired' })).toBeVisible();
  expect((await db.from('club_members').select('id').eq('club_id', club).eq('user_id', IDS.onboarded_student)).data).toHaveLength(0);
  // Remove only this expired fixture before testing a new active invitation.
  expect((await db.from('club_invitations').delete().eq('id', id(32))).error).toBeNull();
  const invite = await owner.post(`/api/clubs/${club}/invites`, { data: { email: PERSONA_CREDENTIALS.onboarded_student.email } });
  expect(invite.status()).toBe(201);
  const token = (await invite.json()).invite.token;
  expect((await owner.post(`/api/clubs/${club}/invites`, { data: { email: PERSONA_CREDENTIALS.onboarded_student.email } })).status()).toBe(409);
  await page.goto(`/invites/${token}`);
  await expect(page.getByRole('heading', { name: /^Welcome to / })).toBeVisible();
  await page.reload();
  expect((await db.from('club_members').select('id').eq('club_id', club).eq('user_id', IDS.onboarded_student)).data).toHaveLength(1);
});

test('spring-gap and fall-repeat: event UI formats the real UTC instants in Toronto', async ({ page }) => {
  for (const [eventId, time] of [[id(13), '1:59 AM'], [id(14), '3:00 AM'], [id(15), '1:30 AM'], [id(16), '1:30 AM']]) {
    await page.goto(`/events/${eventId}`);
    await expect(page.getByText(time, { exact: true })).toBeVisible();
  }
  const ordered = await db.from('events').select('id,start_date').in('id', [id(15), id(16)]).order('start_date');
  expect(ordered.data?.map(row => row.id)).toEqual([id(15), id(16)]);
  expect(ordered.data?.[0].start_date).not.toBe(ordered.data?.[1].start_date);
});

test('expired-event: past events are excluded from upcoming discovery', async ({ request }) => {
  const response = await request.get('/api/events', { params: { ids: `${event},${expired}` } });
  expect(response.status()).toBe(200);
  const body = JSON.stringify(await response.json());
  expect(body).toContain(event); expect(body).not.toContain(expired);
});

test('cross-club-write and cross-user-notification: foreign writes cannot change their targets', async ({ playwright, baseURL, request }) => {
  const attacker = await playwright.request.newContext({ baseURL, storageState: storageStateFor('cross_club_attacker') });
  try {
    expect((await attacker.patch(`/api/clubs/${club}`, { data: { description: 'attacker' } })).status()).toBe(403);
    expect((await db.from('clubs').select('description').eq('id', club).single()).data?.description).toBe('CERT02 fixture');
  } finally { await attacker.dispose(); }
  expect((await request.patch(`/api/notifications/${notice}`)).status()).toBe(200);
  expect((await db.from('notifications').select('read').eq('id', notice).single()).data?.read).toBe(false);
  const listing = await request.get('/api/notifications');
  expect(listing.status()).toBe(200); expect(JSON.stringify(await listing.json())).not.toContain(notice);
});

test('forged-cookie: cosmetic roles and forged session cannot access admin routes', async ({ playwright, baseURL }) => {
  const attacker = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: (probes.find(p => p.id === 'forged-cookie')!.input as { cookie: string }).cookie } });
  try { expect((await attacker.get('/api/admin/clubs')).status()).toBe(401); } finally { await attacker.dispose(); }
});

test('metadata-role: auth user_metadata does not grant database admin privileges', async ({ request }) => {
  const before = await db.auth.admin.getUserById(IDS.onboarded_student);
  expect(before.error).toBeNull();
  const metadata = before.data.user!.user_metadata;
  try {
    expect((await db.auth.admin.updateUserById(IDS.onboarded_student, { user_metadata: { ...metadata, roles: ['admin'] } })).error).toBeNull();
    expect((await request.get('/api/admin/clubs')).status()).toBe(403);
    expect((await db.from('users').select('roles').eq('id', IDS.onboarded_student).single()).data?.roles).not.toContain('admin');
  } finally {
    // GoTrue merges metadata: explicitly remove the added field when absent.
    expect((await db.auth.admin.updateUserById(IDS.onboarded_student, { user_metadata: { ...metadata, roles: metadata.roles ?? null } })).error).toBeNull();
  }
});

test('svg-script, mime-mismatch and oversize-upload: owner uploads fail before storage', async () => {
  const before = await db.storage.from('club-logos').list(club);
  for (const [name, mimeType, buffer, message] of [
    ['active.svg', 'image/svg+xml', Buffer.from('<svg onload=alert(1)></svg>'), null],
    ['fake.png', 'image/png', Buffer.from('4d5a9000', 'hex'), 'File content does not match its image type'],
    // 2 MiB + 1 tests the actual route boundary without transporting 100 MiB.
    ['large.jpg', 'image/jpeg', Buffer.alloc(2 * 1024 * 1024 + 1), null],
  ] as const) {
    const response = await owner.post('/api/clubs/logo', { multipart: { clubId: club, file: { name, mimeType, buffer } } });
    expect(response.status(), name).toBe(400);
    if (message) expect((await response.json()).error).toBe(message);
  }
  const after = await db.storage.from('club-logos').list(club);
  expect(after.data).toEqual(before.data); expect(after.error?.message).toEqual(before.error?.message);
});

test('malformed multipart: all five upload endpoints return client errors before storage', async ({ request }) => {
  for (const path of ['/api/events/upload-image', '/api/profile/avatar', '/api/profile/banner', '/api/clubs/logo', '/api/clubs/banner']) {
    const response = await request.post(path, { headers: { 'content-type': 'multipart/form-data; boundary=missing' }, data: 'broken multipart body' });
    expect(response.status(), path).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid multipart form data' });
  }
});

test('rate-burst and unbounded-limit: production budget and query bound are enforced', async ({ request }) => {
  // The catalog's generic limit probe maps to this route's actual top_k
  // parameter. WR-06 preserves parseInt compatibility and clamps to 1..50.
  const bounded = await request.get('/api/recommendations?top_k=1000000');
  expect(bounded.status()).toBe(200);
  const recommendations = (await bounded.json()).recommendations;
  expect(Array.isArray(recommendations)).toBe(true);
  expect(recommendations).toHaveLength(50);
  // Isolated nonexistent path shares the production mutation policy without
  // exhausting any real endpoint's bucket for following tests.
  const path = `/api/cert02-rate-${Date.now()}`;
  let throttled = false;
  for (let i = 0; i < 35; i++) {
    const response = await request.post(path);
    if (response.status() === 429) {
      expect(Number(response.headers()['retry-after'])).toBeGreaterThan(0);
      throttled = true; break;
    }
  }
  expect(throttled).toBe(true);
});
