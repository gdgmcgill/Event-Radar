/** P1-02: publishing an Auth-only OTP user enables protected-link prefetch
 * before callback profile sync. Keep that identity private until profile exists. */
import { useAuthStore } from './useAuthStore';
let event: (name: string, session: { user: typeof user } | null) => void;
let resolveProfile: (value: { data: Record<string, unknown> | null; error: unknown }) => void;
let profile: Promise<{ data: Record<string, unknown> | null; error: unknown }>;
const user = { id: 'verified-auth-user', email: 'reader@example.org', created_at: '2026-01-01', user_metadata: { name: 'Reader' } };
const mockClubRead = jest.fn();
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({
  auth: { onAuthStateChange: (callback: typeof event) => { event = callback; }, getUser: jest.fn() },
  from: (table: string) => table === 'users'
    ? { select: () => ({ eq: () => ({ single: () => profile }) }) }
    : { select: () => ({ eq: () => { mockClubRead(); return Promise.resolve({ count: 0, error: null }); } }) },
}) }));
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  profile = new Promise(resolve => { resolveProfile = resolve; });
  useAuthStore.setState({ user: null, loading: true, initialized: false, hasClubs: false });
  useAuthStore.getState().initialize();
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
it('never exposes the verified Auth user while profile synchronization is pending or missing', async () => {
  event('SIGNED_IN', { user }); await jest.advanceTimersByTimeAsync(0);
  expect(useAuthStore.getState().user).toBeNull();
  resolveProfile({ data: null, error: { code: 'PGRST116' } });
  await jest.advanceTimersByTimeAsync(0);
  expect(useAuthStore.getState()).toMatchObject({ user: null, loading: false });
  expect(mockClubRead).not.toHaveBeenCalled();
});
it('publishes the synchronized profile, including authoritative roles and chosen name', async () => {
  event('SIGNED_IN', { user }); await jest.advanceTimersByTimeAsync(0);
  resolveProfile({ data: { id: user.id, name: 'Chosen name', roles: ['user'], onboarding_completed: false }, error: null });
  await jest.advanceTimersByTimeAsync(0);
  expect(useAuthStore.getState()).toMatchObject({ loading: false, user: { id: user.id, name: 'Chosen name', roles: ['user'] } });
});
it('a delayed profile response cannot restore an account after signout', async () => {
  event('SIGNED_IN', { user }); await jest.advanceTimersByTimeAsync(0);
  event('SIGNED_OUT', null);
  resolveProfile({ data: { id: user.id, roles: ['user'] }, error: null });
  await jest.advanceTimersByTimeAsync(0);
  expect(useAuthStore.getState()).toMatchObject({ loading: false, user: null });
});
it('a delayed prior-account profile cannot publish over a newer account', async () => {
  event('SIGNED_IN', { user }); await jest.advanceTimersByTimeAsync(0);
  const oldResolve = resolveProfile;
  profile = new Promise(resolve => { resolveProfile = resolve; });
  const nextUser = { ...user, id: 'next-verified-user', email: 'next@example.org' };
  event('SIGNED_IN', { user: nextUser }); await jest.advanceTimersByTimeAsync(0);
  oldResolve({ data: { id: user.id, roles: ['admin'] }, error: null });
  await jest.advanceTimersByTimeAsync(0);
  expect(useAuthStore.getState().user).toBeNull();
  resolveProfile({ data: { id: nextUser.id, roles: ['user'], name: 'Next reader' }, error: null });
  await jest.advanceTimersByTimeAsync(0);
  expect(useAuthStore.getState().user).toMatchObject({ id: nextUser.id, roles: ['user'], name: 'Next reader' });
});
