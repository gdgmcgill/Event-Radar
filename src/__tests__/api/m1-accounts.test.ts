/** P1-02 intentional product changes: short onboarding and untrusted affiliation. */
import { NextRequest } from 'next/server';
import { createFakeSupabase, type FakeSupabase } from '../helpers/fakeSupabase';
const USER = '10000000-0000-4000-8000-000000000101';
const UNIVERSITY = '10000000-0000-4000-8000-000000000001';
let mockCookie: FakeSupabase, mockElevated: FakeSupabase;
const mockElevatedCall = jest.fn();
const mockSetCookie = jest.fn();
const mockContext = jest.fn();
jest.mock('@/server/context', () => ({ createRequestContext: () => mockContext() }));
jest.mock('@/lib/supabase/server', () => ({ createClient: async () => mockCookie.client }));
jest.mock('@/server/db/elevated', () => ({ getElevatedClient: () => { mockElevatedCall(); return mockElevated.client; } }));
jest.mock('next/headers', () => ({ cookies: async () => ({ set: mockSetCookie }) }));
const params = { params: Promise.resolve({ id: USER }) };
function req(body: unknown) { return new NextRequest(`http://localhost/api/users/${USER}`, { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }); }
beforeEach(() => {
  jest.clearAllMocks();
  const rows = { users: [{ id: USER, email: 'person@example.com', name: 'Existing Name', roles: ['user'], onboarding_completed: false, banned_at: null, ban_expires_at: null }], universities: [{ id: UNIVERSITY, active: true, name: 'McGill', slug: 'mcgill', city: 'Montréal' }] };
  mockCookie = createFakeSupabase({ tables: rows });
  mockElevated = createFakeSupabase({ tables: structuredClone(rows) });
  mockContext.mockResolvedValue({ user: { id: USER, email: 'person@example.com', email_confirmed_at: '2026-01-01' }, profile: rows.users[0], supabase: mockCookie.client, requestId: 'test' });
});
it('new completion requires name and an explicit university choice', async () => {
  const { PATCH } = await import('@/app/api/users/[id]/route');
  const response = await PATCH(req({ name: 'Student', onboarding_completed: true }), params);
  expect(response.status).toBe(400); expect(mockElevatedCall).not.toHaveBeenCalled();
});
it.each([{ university_id: UNIVERSITY, other_university: null }, { university_id: null, other_university: 'Prefer not to specify' }])('completes with required basics and optional interests omitted: %j', async choice => {
  const { PATCH } = await import('@/app/api/users/[id]/route');
  const response = await PATCH(req({ name: 'Student', ...choice, onboarding_completed: true, affiliation_source: 'verified_email', roles: ['admin'] }), params);
  expect(response.status).toBe(200);
  const row = (await response.json()).data;
  expect(row).toMatchObject({ name: 'Student', ...choice, onboarding_completed: true, affiliation_source: 'self_declared', roles: ['user'] });
});
it('a forged/nonexistent university is refused before elevation', async () => {
  const { PATCH } = await import('@/app/api/users/[id]/route');
  expect((await PATCH(req({ university_id: '10000000-0000-4000-8000-000000000999' }), params)).status).toBe(400);
  expect(mockElevatedCall).not.toHaveBeenCalled();
});
it('legacy completed profiles are not forced through new required fields', async () => {
  const ctx = await mockContext(); ctx.profile.onboarding_completed = true;
  const { PATCH } = await import('@/app/api/users/[id]/route');
  expect((await PATCH(req({ name: 'Legacy Student', onboarding_completed: true }), params)).status).toBe(200);
});
it('bans and exact self identity still precede affiliation writes', async () => {
  const { PATCH } = await import('@/app/api/users/[id]/route');
  expect((await PATCH(req({ other_university: 'Other' }), { params: Promise.resolve({ id: UNIVERSITY }) })).status).toBe(403);
  const ctx = await mockContext(); ctx.profile.banned_at = '2026-01-01';
  expect((await PATCH(req({ other_university: 'Other' }), params)).status).toBe(403);
  expect(mockElevatedCall).not.toHaveBeenCalled();
});
it('clearing the advisory cookie cannot complete an incomplete profile', async () => {
  const { POST } = await import('@/app/api/onboarding/complete/route');
  const response = await POST();
  expect(response.status).toBe(400); expect(mockSetCookie).not.toHaveBeenCalled();
});
it('completed profile may clear its advisory cookie', async () => {
  const ctx = await mockContext(); ctx.profile.onboarding_completed = true;
  const { POST } = await import('@/app/api/onboarding/complete/route');
  expect((await POST()).status).toBe(200);
  expect(mockSetCookie).toHaveBeenCalledWith('needs_onboarding', '', expect.objectContaining({ maxAge: 0 }));
});
