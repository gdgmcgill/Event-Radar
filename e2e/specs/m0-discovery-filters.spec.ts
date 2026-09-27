/** CERT-08 positive discovery filters, disposable ad070008 namespace.
 * DEC-80/F-085 explicitly preserved Eastern WALL CLOCK values encoded with Z.
 * These fixture dates follow that existing convention; they are not claims of
 * true UTC-instant conversion. See docs/discovery-time-semantics.md.
 */
import { createHash } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/types';
import { assertSeedTargetAllowed, isLocalSeedTarget } from '../../scripts/seed/guard';
import { localStackEnv } from '../env';
import { IDS } from '../fixtures';

const id = (n: number) => `ad070008-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const club = id(1);
const fixtures = [
  { id: id(10), start: '2036-06-02T09:00:00Z', tags: ['academic'], label: 'Monday morning academic' },
  { id: id(11), start: '2036-06-02T09:00:00Z', tags: ['music'], label: 'Monday morning music' },
  { id: id(12), start: '2036-06-02T14:00:00Z', tags: ['academic'], label: 'Monday afternoon academic' },
  { id: id(13), start: '2036-06-07T09:00:00Z', tags: ['academic'], label: 'Saturday morning academic' },
  { id: id(14), start: '2036-06-03T10:00:00Z', tags: ['academic'], label: 'Tuesday morning academic' },
  { id: id(15), start: '2036-06-09T09:00:00Z', tags: ['academic'], label: 'Next Monday outside date range' },
  { id: id(16), start: '2036-06-02T09:00:00Z', tags: ['academic'], label: 'Pending matching event' },
  { id: id(17), start: '2036-06-02T09:00:00Z', tags: ['academic'], label: 'Deleted matching event' },
  { id: id(18), start: '2036-06-02T00:30:00Z', tags: ['academic'], label: 'Encoded Monday night' },
  { id: id(19), start: '2036-06-02T18:00:00Z', tags: ['academic'], label: 'Monday evening academic' },
];
const eventIds = fixtures.map(row => row.id);
let db: SupabaseClient<Database>;

async function cleanup() {
  if (!db) return;
  for (const result of [await db.from('events').delete().in('id', eventIds), await db.from('clubs').delete().eq('id', club)]) {
    expect(result.error, 'discovery fixture cleanup').toBeNull();
  }
}
async function filtered(request: APIRequestContext, params: Record<string, string>, expected: string[]) {
  const response = await request.get('/api/events', { params: { ids: eventIds.join(','), limit: '100', ...params } });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.events.map((row: { id: string }) => row.id).sort()).toEqual([...expected].sort());
  expect(body.total).toBe(expected.length);
  expect(body.totalPages).toBe(expected.length ? 1 : 0);
  return body;
}

test.use({ storageState: { cookies: [], origins: [] } });
test.beforeAll(async () => {
  const env = localStackEnv();
  if (!isLocalSeedTarget(env.url)) throw new Error('Discovery certification requires a local stack');
  assertSeedTargetAllowed(env.url);
  db = createClient<Database>(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await cleanup();
  expect((await db.from('clubs').insert({ id: club, name: 'M0 Filter Club', description: 'Disposable filter fixture', status: 'approved', category: 'academic', created_by: IDS.club_owner })).error).toBeNull();
  expect((await db.from('events').insert(fixtures.map(row => ({
    id: row.id, title: `M0 Filter ${row.label}`, description: 'Disposable discovery fixture', organizer: 'M0 Filter Club', club_id: club, created_by: IDS.club_owner,
    status: row.id === id(16) ? 'pending' : 'approved', deleted_at: row.id === id(17) ? '2030-01-01T00:00:00Z' : null,
    start_date: row.start, end_date: new Date(Date.parse(row.start) + 3600000).toISOString(), location: 'Synthetic campus', tags: row.tags, source: 'manual', content_hash: createHash('sha256').update(row.id).digest('hex'),
  })))).error).toBeNull();
});
test.afterAll(cleanup);

test('anonymous tag and inclusive date filters return exact matching rows and preserve public visibility', async ({ request }) => {
  await filtered(request, { tags: 'music' }, [id(11)]);
  await filtered(request, { tags: 'academic', dateFrom: '2036-06-02T09:00:00Z', dateTo: '2036-06-02T09:00:00Z' }, [id(10)]);
  await filtered(request, { tags: 'academic,music', dateFrom: '2036-06-02T09:00:00Z', dateTo: '2036-06-02T09:00:00Z' }, [id(10), id(11)]);
  await filtered(request, { dateFrom: '2036-06-03T00:00:00Z', dateTo: '2036-06-07T23:59:59Z' }, [id(13), id(14)]);
});

test('time-of-day and weekday/weekend filters follow the documented encoded wall-clock convention', async ({ request }) => {
  await filtered(request, { timeOfDay: 'morning', dayType: 'weekday' }, [id(10), id(11), id(14), id(15)]);
  await filtered(request, { timeOfDay: 'morning', dayType: 'weekend' }, [id(13)]);
  await filtered(request, { timeOfDay: 'afternoon', dayType: 'weekday' }, [id(12)]);
  await filtered(request, { timeOfDay: 'evening', dayType: 'weekday' }, [id(19)]);
  await filtered(request, { timeOfDay: 'night', dayType: 'weekday' }, [id(18)]);
});

test('composed tag/date/time/day filtering excludes each independently nonmatching case', async ({ request }) => {
  const composed = { tags: 'academic', dateFrom: '2036-06-02T06:00:00Z', dateTo: '2036-06-07T23:59:59Z', timeOfDay: 'morning', dayType: 'weekday' };
  await filtered(request, composed, [id(10), id(14)]);
  await filtered(request, { ...composed, tags: 'music' }, [id(11)]);
  await filtered(request, { ...composed, dayType: 'weekend' }, [id(13)]);
  await filtered(request, { ...composed, tags: 'sports' }, []);
});
