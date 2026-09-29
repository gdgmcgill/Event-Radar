/** M2 duplicate review trigger: known rule -> actionable400, arbitrary DB
 * failures -> existing generic500. Exercise each publishing mutation. */
import { NextRequest } from 'next/server';
import { createFakeSupabase, type FakeSupabase } from '../../helpers/fakeSupabase';
import { EVENT_DUPLICATE_REVIEW_MESSAGE } from '@/server/discovery/eventDuplicate';
let mockDb: FakeSupabase;
const mockContext = jest.fn();
jest.mock('@/server/context', () => ({ createRequestContext: () => mockContext() }));
jest.mock('@/server/db/elevated', () => ({ getElevatedClient: () => mockDb.client }));
jest.mock('@/lib/audit', () => ({ logAdminAction: jest.fn() }));
const id = '10000000-0000-4000-8000-000000000111';
const user = '10000000-0000-4000-8000-000000000112';
const params = { params: Promise.resolve({ id }) };
const create = { title: 'New test event', description: 'A sufficiently descriptive fixture event', organizer: 'Fixture', location: 'Room', start_date: '2090-01-02T12:00:00Z', end_date: '2090-01-02T13:00:00Z', tags: ['tech'] };
const mutations = [
  { route: 'events/create', method: 'POST', body: create, run: async (r: NextRequest) => (await import('@/app/api/events/create/route')).POST(r) },
  { route: 'admin/events', method: 'POST', body: create, run: async (r: NextRequest) => (await import('@/app/api/admin/events/route')).POST(r) },
  { route: `events/${id}`, method: 'PATCH', body: { title: 'Updated fixture' }, run: async (r: NextRequest) => (await import('@/app/api/events/[id]/route')).PATCH(r, params) },
  { route: `admin/events/${id}`, method: 'PUT', body: { title: 'Updated fixture' }, run: async (r: NextRequest) => (await import('@/app/api/admin/events/[id]/route')).PUT(r, params) },
  { route: `admin/events/${id}/status`, method: 'PATCH', body: { status: 'approved' }, run: async (r: NextRequest) => (await import('@/app/api/admin/events/[id]/status/route')).PATCH(r, params) },
  { route: `admin/events/${id}/edits`, method: 'PATCH', body: { action: 'approve', expected_pending_edits: { title: 'Updated fixture' } }, run: async (r: NextRequest) => (await import('@/app/api/admin/events/[id]/edits/route')).PATCH(r, params) },
];
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());
describe.each(mutations)('$method $route', mutation => {
  it.each([
    { code: '22023', message: EVENT_DUPLICATE_REVIEW_MESSAGE, status: 400 },
    { code: '22023', message: 'private SQL details', status: 500 },
    { code: '42501', message: EVENT_DUPLICATE_REVIEW_MESSAGE, status: 500 },
  ])('maps only the named rule: $code / $message', async ({ code, message, status }) => {
    const error = { code, message };
    const profile = { id: user, name: 'Admin', roles: ['admin'], onboarding_completed: true, banned_at: null, ban_expires_at: null };
    mockDb = createFakeSupabase({ tables: { users: [profile], events: [{ id, title: 'Existing', status: 'pending', created_by: user, deleted_at: null, club_id: null, start_date: '2089-01-01T12:00:00Z', content_hash: 'other', pending_edits: { title: 'Updated fixture' } }] }, errors: { 'events.insert': error, 'events.update': error }, rpc: { review_event_edits_atomic: { data: null, error } } });
    mockContext.mockResolvedValue({ user: { id: user, email: 'admin@example.org' }, profile, supabase: mockDb.client, requestId: 'duplicate-test' });
    const response = await mutation.run(new NextRequest(`http://localhost/api/${mutation.route}`, { method: mutation.method, body: JSON.stringify(mutation.body), headers: { 'Content-Type': 'application/json' } }));
    expect(response.status).toBe(status);
    const body = await response.json();
    if (status === 400) expect(body).toEqual({ error: EVENT_DUPLICATE_REVIEW_MESSAGE });
    else expect(body.error).not.toMatch(/private SQL|Review possible duplicates/);
  });
});
