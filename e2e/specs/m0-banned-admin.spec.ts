/** DI-99: real admitted admin session loses access while its DB ban is active. */
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/types';
import { assertSeedTargetAllowed, isLocalSeedTarget } from '../../scripts/seed/guard';
import { localStackEnv } from '../env';
import { IDS, storageStateFor } from '../fixtures';

test.use({ storageState: storageStateFor('admin') });
test('a banned admin cannot use admin APIs or view the protected API specification', async ({ request, page }) => {
  const env = localStackEnv();
  if (!isLocalSeedTarget(env.url)) throw new Error('Banned-admin certification requires local Supabase');
  assertSeedTargetAllowed(env.url);
  const db = createClient<Database>(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const original = await db.from('users').select('banned_at,ban_expires_at,ban_reason').eq('id', IDS.admin).single();
  expect(original.error).toBeNull();
  expect(original.data?.banned_at).toBeNull();
  try {
    expect((await db.from('users').update({ banned_at: new Date().toISOString(), ban_expires_at: null, ban_reason: 'Local DI-99 probe' }).eq('id', IDS.admin)).error).toBeNull();
    const denied = await request.get('/api/admin/events');
    expect(denied.status()).toBe(403);
    expect(await denied.json()).toEqual({ error: 'Account suspended' });
    expect(denied.headers()['cache-control']).toBe('private, no-store');
    await page.goto('/docs');
    await expect(page).toHaveURL(url => url.pathname === '/banned');
    await expect(page.getByRole('heading', { name: 'Account Suspended' })).toBeVisible();
    await expect(page.getByText('UNI-VERSE API', { exact: true })).toHaveCount(0);
  } finally {
    // Restore authoritative ban fields; the normal updated_at trigger may advance.
    if (original.data) expect((await db.from('users').update(original.data).eq('id', IDS.admin)).error).toBeNull();
  }
  expect((await request.get('/api/admin/events')).status()).toBe(200);
});
