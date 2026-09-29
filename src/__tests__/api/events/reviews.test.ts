/** P1-03 intentionally replaces public aggregate/new-rating preservation with
 * author/admin history. SQL role tests prove RLS independently of these mocks.
 */
import { GET, POST } from '@/app/api/events/[id]/reviews/route';
import { createRequestContext } from '@/server/context';

jest.mock('@/server/context', () => ({ createRequestContext: jest.fn() }));
const contextMock = jest.mocked(createRequestContext);
const row = { id: 'review-1', event_id: 'event-1', user_id: 'author-1', rating: 5, comment: 'Private history', created_at: '2026-01-01T00:00:00Z' };
let result: { data: unknown; error: unknown };
const query = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), range: jest.fn() };
const from = jest.fn((_table: string) => query);
function arrange(role: 'author' | 'admin' | 'outsider' | 'banned' | 'anonymous' | 'missing' = 'author') {
  const userId = role === 'author' ? 'author-1' : role;
  contextMock.mockResolvedValue({
    user: role === 'anonymous' ? null : { id: userId },
    profile: ['anonymous', 'missing'].includes(role) ? null : { id: userId, roles: role === 'admin' || role === 'banned' ? ['user', 'admin'] : ['user'], banned_at: role === 'banned' ? '2026-01-01' : null, ban_expires_at: null, onboarding_completed: true },
    supabase: { from }, requestId: 'test',
  } as never);
}
const params = { params: Promise.resolve({ id: 'event-1' }) };
const req = (queryString = '') => new Request(`http://localhost/api/events/event-1/reviews${queryString}`);
beforeEach(() => {
  jest.clearAllMocks(); result = { data: [row], error: null };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
  query.range.mockImplementation(() => Promise.resolve(result)); arrange();
});

it.each([['anonymous', 401], ['missing', 403], ['banned', 403]] as const)('refuses %s before reading any history', async (role, status) => {
  arrange(role); const response = await GET(req(), params);
  expect(response.status).toBe(status); expect(from).not.toHaveBeenCalled();
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it('scopes authors explicitly, preserves original fields, and sends no aggregate or eligibility', async () => {
  const response = await GET(req(), params);
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ reviews: [row] });
  expect(query.eq).toHaveBeenCalledWith('user_id', 'author-1');
  expect(query.eq).toHaveBeenCalledWith('event_id', 'event-1');
  expect(query.range).toHaveBeenCalledWith(0, 24);
  expect(from.mock.calls.map(call => call[0])).toEqual(['reviews']);
});
it('an organizer or unrelated caller has only their own history, even with a forged query subject', async () => {
  arrange('outsider'); result.data = [];
  const response = await GET(req('?user_id=author-1&is_admin=true'), params);
  expect(await response.json()).toEqual({ reviews: [] });
  expect(query.eq).toHaveBeenCalledWith('user_id', 'outsider');
  expect(query.eq).not.toHaveBeenCalledWith('user_id', 'author-1');
});
it('active admins can page retained history without elevating the database client', async () => {
  arrange('admin'); const response = await GET(req('?offset=25&limit=50'), params);
  expect(response.status).toBe(200); expect(query.range).toHaveBeenCalledWith(25, 74);
  expect(query.eq.mock.calls).toEqual([['event_id', 'event-1']]);
});
it('invalid pagination is rejected before a history query', async () => {
  expect((await GET(req('?limit=101'), params)).status).toBe(400); expect(from).not.toHaveBeenCalled();
});
it('database failures are private errors, not empty successful history', async () => {
  result = { data: null, error: new Error('backend unavailable') };
  const response = await GET(req(), params); expect(response.status).toBe(500);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it('all legacy writes stay retired even when the future feedback flag is enabled', async () => {
  const previous = process.env.FEATURE_NEW_FEEDBACK_WRITES;
  try {
    process.env.FEATURE_NEW_FEEDBACK_WRITES = 'true';
    const response = await POST(new Request('http://localhost/api/events/event-1/reviews', { method: 'POST', body: 'not json' }), params);
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: 'Legacy review submissions are closed' });
    expect(from).not.toHaveBeenCalled();
  } finally { if (previous === undefined) delete process.env.FEATURE_NEW_FEEDBACK_WRITES; else process.env.FEATURE_NEW_FEEDBACK_WRITES = previous; }
});

it.each([['GET', GET], ['POST', POST]] as const)('%s context transport exceptions remain generic private failures', async (_verb, handler) => {
  const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    contextMock.mockRejectedValueOnce(new Error('PRIVATE_CONTEXT_SENTINEL'));
    const response = await handler(req(), params);
    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.text()).not.toContain('PRIVATE_CONTEXT_SENTINEL');
  } finally { quiet.mockRestore(); }
});
