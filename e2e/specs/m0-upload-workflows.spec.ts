/** CERT-01/08: successful multipart routes persist real PNG bytes in local Storage.
 * Profile URL fields and existing avatar/banner bytes are restored in finally.
 * Synthetic bucket creation is local-only; existing bucket settings are untouched.
 */
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/types';
import { FUNCTIONAL_PNG } from '../../scripts/seed/certificationFunctionalData';
import { assertSeedTargetAllowed, isLocalSeedTarget } from '../../scripts/seed/guard';
import { localStackEnv } from '../env';
import { IDS, storageStateFor } from '../fixtures';

const clubId = 'ad070005-0000-4000-8000-000000000001';
const bytes = Buffer.from(FUNCTIONAL_PNG, 'base64');
const cases = [
  { route: '/api/profile/avatar', bucket: 'avatars', field: 'avatar_url', status: 200, fixedPath: `${IDS.club_owner}/avatar.png` },
  { route: '/api/profile/banner', bucket: 'banners', field: 'banner_url', status: 200, fixedPath: `${IDS.club_owner}/banner.png` },
  { route: '/api/events/upload-image', bucket: 'event-images', field: 'url', status: 200 },
  { route: '/api/clubs/logo', bucket: 'club-logos', field: 'url', status: 201 },
  { route: '/api/clubs/banner', bucket: 'club-logos', field: 'url', status: 201 },
] as const;

test.use({ storageState: storageStateFor('club_owner') });
test('five upload routes store the authenticated caller’s valid image and return readable URLs', async ({ request, page }) => {
  const env = localStackEnv();
  if (!isLocalSeedTarget(env.url)) throw new Error('Upload certification requires local Supabase');
  assertSeedTargetAllowed(env.url);
  const db = createClient<Database>(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const profile = await db.from('users').select('avatar_url,banner_url').eq('id', IDS.club_owner).single();
  expect(profile.error).toBeNull();
  const uploads: { bucket: string; path: string; old?: Blob }[] = [];
  const backups = new Map<string, Blob>();
  try {
    const buckets = await db.storage.listBuckets(); expect(buckets.error).toBeNull();
    const existing = new Set(buckets.data!.map(bucket => bucket.id));
    for (const c of cases) {
      if (!existing.has(c.bucket)) {
        expect((await db.storage.createBucket(c.bucket, { public: true, allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'], fileSizeLimit: 8388608 })).error).toBeNull();
        existing.add(c.bucket);
      }
      if ('fixedPath' in c) {
        const old = await db.storage.from(c.bucket).download(c.fixedPath);
        if (old.data) backups.set(c.bucket, old.data);
        else expect(Number((old.error as { statusCode?: string })?.statusCode)).toBe(404);
      }
    }
    expect((await db.from('clubs').delete().eq('id', clubId)).error).toBeNull();
    expect((await db.from('clubs').insert({ id: clubId, name: 'M0 upload club', status: 'approved', created_by: IDS.club_owner })).error).toBeNull();
    expect((await db.from('club_members').insert({ club_id: clubId, user_id: IDS.club_owner, role: 'owner' })).error).toBeNull();
    for (const c of cases) {
      if ('fixedPath' in c) uploads.push({ bucket: c.bucket, path: c.fixedPath, old: backups.get(c.bucket) });
      const response = await request.post(c.route, { multipart: { file: { name: 'fixture.png', mimeType: 'image/png', buffer: bytes }, ...(c.route.startsWith('/api/clubs/') ? { clubId } : {}) } });
      expect(response.status(), c.route).toBe(c.status);
      expect(response.headers()['cache-control']).toBe('private, no-store');
      const body = await response.json();
      const url = new URL(body[c.field]);
      expect(url.origin).toBe(env.url);
      const prefix = `/storage/v1/object/public/${c.bucket}/`;
      expect(url.pathname.startsWith(prefix), `${c.route}: ${url.pathname}`).toBe(true);
      const path = decodeURIComponent(url.pathname.slice(prefix.length));
      if (!('fixedPath' in c)) uploads.push({ bucket: c.bucket, path });
      if ('fixedPath' in c) expect(path).toBe(c.fixedPath);
      if (c.route.startsWith('/api/clubs/')) expect(path.startsWith(`${clubId}/`)).toBe(true);
      const stored = await db.storage.from(c.bucket).download(path);
      expect(stored.error).toBeNull();
      expect(Buffer.from(await stored.data!.arrayBuffer())).toEqual(bytes);
      const publicRead = await request.get(url.href);
      expect(publicRead.status()).toBe(200);
      expect(await publicRead.body()).toEqual(bytes);
      if (c.field !== 'url') {
        const saved = await db.from('users').select('avatar_url,banner_url').eq('id', IDS.club_owner).single();
        expect(saved.data?.[c.field]).toBe(url.href);
      }
    }
    // A browser also decodes the returned PNG, beyond storage metadata checks.
    await page.goto('/profile');
    const avatar = page.locator(`img[src*="${IDS.club_owner}%2Favatar.png"], img[src*="${IDS.club_owner}/avatar.png"]`).first();
    await expect(avatar).toBeVisible();
    await expect.poll(() => avatar.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  } finally {
    // The normal updated_at trigger may advance; profile contents are restored.
    if (profile.data) expect((await db.from('users').update(profile.data).eq('id', IDS.club_owner)).error).toBeNull();
    for (const object of uploads) {
      const result = object.old
        ? await db.storage.from(object.bucket).upload(object.path, object.old, { contentType: 'image/png', upsert: true })
        : await db.storage.from(object.bucket).remove([object.path]);
      expect(result.error, `restore ${object.bucket}`).toBeNull();
    }
    const leftovers = await db.storage.from('club-logos').list(clubId);
    expect(leftovers.error).toBeNull();
    if (leftovers.data?.length) expect((await db.storage.from('club-logos').remove(leftovers.data.map(object => `${clubId}/${object.name}`))).error).toBeNull();
    expect((await db.from('clubs').delete().eq('id', clubId)).error).toBeNull();
  }
});
