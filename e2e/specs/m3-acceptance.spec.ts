/** M3 enabled-product acceptance (Task 17). Only playwright.m3.config.ts runs
 * this spec. Every row it writes lives in the `ad070300-…` namespace or carries
 * the run stamp, and afterAll removes it; no baseline seed row is modified
 * beyond one legacy save the student persona makes and afterAll undoes. */
import { createHash } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/types';
import { assertSeedTargetAllowed, isLocalSeedTarget } from '../../scripts/seed/guard';
import { localStackEnv } from '../env';
import { IDS, storageStateFor } from '../fixtures';

const NS = (n: number) => `ad070300-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const hackathonId = NS(1);
const closedId = NS(2);
const savedEventId = NS(0x11);
const brokenImageEventId = NS(0x12);
const deliveryId = NS(0x21);
const stamp = Date.now().toString(36);
const hackathonTitle = 'M3 acceptance cross-campus hackathon';
const closedTitle = 'M3 acceptance closed fellowship';
const savedEventTitle = 'M3 acceptance legacy saved workshop';
const brokenImageTitle = 'M3 acceptance event with an expired image';
const privateNote = `m3-private-duplicate-note-${stamp}`;
const companyEmail = `m3-company-${stamp}@example.org`;
const guestContactEmail = `m3-guest-${stamp}@example.org`;
const reportSentinel = `m3-report-details-${stamp}`;
const resourceSlug = `m3-acceptance-guide-${stamp}`;
const draftResourceSlug = `m3-acceptance-draft-${stamp}`;
const submissionTitle = `M3 acceptance submitted hackathon ${stamp}`;
const honeypotTitle = `M3 acceptance honeypot ${stamp}`;
const companyRoleTitle = `M3 acceptance junior analyst ${stamp}`;
const producer = 'm3-acceptance@local';
const day = 86_400_000;
const isoDate = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
const deadlineDate = isoDate(30);

let db: SupabaseClient<Database>, admin: APIRequestContext, student: APIRequestContext;
const createdOpportunities = new Set<string>();

async function noHorizontalScroll(page: Page, width: number) {
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scroll).toBeLessThanOrEqual(width);
}

test.beforeAll(async ({ playwright, baseURL }) => {
  const stack = localStackEnv();
  assertSeedTargetAllowed(stack.url);
  if (!isLocalSeedTarget(stack.url)) throw new Error('M3 acceptance requires the disposable local stack');
  db = createClient<Database>(stack.url, stack.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  admin = await playwright.request.newContext({ baseURL, storageState: storageStateFor('admin') });
  student = await playwright.request.newContext({ baseURL, storageState: storageStateFor('onboarded_student') });
  await cleanup();
  const now = Date.now();
  const opportunity = {
    listing_type: 'hackathon', organization: 'M3 local fixtures', location: 'Synthetic campus', work_mode: 'in_person',
    source_type: 'manual', application_mode: 'external', relevance_scope: 'cross_campus', fields: ['technology'],
    source_timezone: 'America/Toronto', timezone_assumed: true, status: 'published', created_by: IDS.admin, updated_by: IDS.admin,
  };
  expect((await db.from('opportunities').insert([
    { ...opportunity, id: hackathonId, slug: 'm3-acceptance-hackathon', title: hackathonTitle,
      description: 'A disposable acceptance hackathon, not a real event.', source_url: 'https://example.org/m3-hackathon-source',
      action_url: 'https://example.org/m3-hackathon-apply', deadline_precision: 'date', deadline_date: deadlineDate,
      checked_at: new Date(now - day).toISOString(), published_at: new Date(now - day).toISOString(), duplicate_review_note: privateNote },
    { ...opportunity, id: closedId, slug: 'm3-acceptance-closed', title: closedTitle, listing_type: 'program',
      description: 'A disposable listing whose deadline has passed.', source_url: 'https://example.org/m3-closed-source',
      action_url: 'https://example.org/m3-closed-apply', deadline_precision: 'date', deadline_date: isoDate(-10),
      checked_at: new Date(now - 20 * day).toISOString(), published_at: new Date(now - 20 * day).toISOString() },
  ])).error).toBeNull();
  const start = new Date(now + 10 * day).toISOString();
  const end = new Date(now + 10 * day + 3_600_000).toISOString();
  const event = { description: 'Disposable M3 acceptance event', organizer: 'M3 local fixtures', status: 'approved', start_date: start,
    end_date: end, location: 'Synthetic campus', tags: ['tech'], created_by: IDS.admin };
  expect((await db.from('events').insert([
    { ...event, id: savedEventId, title: savedEventTitle, source: 'manual', content_hash: createHash('sha256').update(savedEventId).digest('hex') },
    { ...event, id: brokenImageEventId, title: brokenImageTitle, source: 'instagram', source_url: 'https://www.instagram.com/p/m3acceptance/',
      image_url: 'https://m3-unreachable.cdninstagram.com/v/expired-m3.jpg', content_hash: createHash('sha256').update(brokenImageEventId).digest('hex') },
  ])).error).toBeNull();
  expect((await db.from('ingestion_deliveries').insert({ id: deliveryId, producer, outcome: 'succeeded', event_count: 2, inserted: 2, items_seen: 3 })).error).toBeNull();
});

async function cleanup() {
  const submissions = await db.from('submissions').select('id,target_opportunity_id,target_resource_id')
    .or(`title.like.M3 acceptance %,contact_email.eq.${companyEmail}`);
  expect(submissions.error).toBeNull();
  for (const row of submissions.data ?? []) if (row.target_opportunity_id) createdOpportunities.add(row.target_opportunity_id);
  const opportunityIds = [hackathonId, closedId, ...createdOpportunities];
  const resources = await db.from('resources').select('id').like('slug', 'm3-acceptance-%');
  expect(resources.error).toBeNull();
  const resourceIds = (resources.data ?? []).map(row => row.id);
  const reports = await db.from('listing_reports').select('id').or(`opportunity_id.in.(${opportunityIds.join(',')}),event_id.in.(${savedEventId},${brokenImageEventId})`);
  expect(reports.error).toBeNull();
  const auditTargets = [...opportunityIds, ...resourceIds, ...(submissions.data ?? []).map(row => row.id), ...(reports.data ?? []).map(row => row.id), savedEventId, brokenImageEventId];
  expect((await db.from('admin_audit_log').delete().in('target_id', auditTargets)).error).toBeNull();
  expect((await db.from('listing_reports').delete().in('id', (reports.data ?? []).map(row => row.id))).error).toBeNull();
  expect((await db.from('submissions').delete().in('id', (submissions.data ?? []).map(row => row.id))).error).toBeNull();
  expect((await db.from('resource_actions').delete().in('resource_id', resourceIds)).error).toBeNull();
  expect((await db.from('resources').delete().in('id', resourceIds)).error).toBeNull();
  expect((await db.from('saved_events').delete().in('event_id', [savedEventId, brokenImageEventId])).error).toBeNull();
  expect((await db.from('opportunities').delete().in('id', opportunityIds)).error).toBeNull();
  expect((await db.from('events').delete().in('id', [savedEventId, brokenImageEventId])).error).toBeNull();
  expect((await db.from('ingestion_deliveries').delete().eq('id', deliveryId)).error).toBeNull();
}

test.afterAll(async () => {
  if (db) await cleanup();
  await admin?.dispose();
  await student?.dispose();
});

test('guest home: editorial hero reaches discovery without sign-in and carries no future-milestone copy', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Opportunities for Montréal students' })).toBeVisible();
  const text = await page.locator('body').innerText();
  for (const phrase of ['Talent', 'Apply with', 'Weekly Drop']) expect(text).not.toContain(phrase);
  await page.getByRole('link', { name: 'Browse opportunities', exact: true }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByRole('heading', { name: /Your next opportunity/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In', exact: true }).first()).toBeVisible();
});

test('discover filters survive reload and browser back after opening a listing', async ({ page }) => {
  await page.goto('/discover');
  await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption('hackathon');
  await expect(page).toHaveURL(/type=hackathon/);
  const relevance = page.getByRole('combobox', { name: 'University relevance', exact: true });
  await expect(relevance.locator('option')).not.toHaveCount(1);
  await relevance.selectOption({ index: 1 });
  await expect(page).toHaveURL(/university=[0-9a-f-]{36}/);
  const filtered = page.url();
  const university = new URL(filtered).searchParams.get('university');
  const listing = page.getByRole('heading', { level: 2 }).getByRole('link', { name: hackathonTitle, exact: true });
  await expect(listing).toBeVisible();
  await page.reload();
  expect(page.url()).toBe(filtered);
  await expect(page.getByRole('combobox', { name: 'Type', exact: true })).toHaveValue('hackathon');
  await expect(relevance).toHaveValue(university!);
  await expect(listing).toBeVisible();
  await listing.click();
  await expect(page).toHaveURL(new RegExp(`/opportunities/${hackathonId}$`));
  await expect(page.getByRole('heading', { level: 1, name: hackathonTitle })).toBeVisible();
  await page.goBack();
  expect(page.url()).toBe(filtered);
  await expect(page.getByRole('combobox', { name: 'Type', exact: true })).toHaveValue('hackathon');
  await expect(listing).toBeVisible();
});

test('detail facts: a date-only deadline, eligibility and provenance; a closed listing has no action', async ({ page }) => {
  await page.goto(`/opportunities/${hackathonId}`);
  const facts = page.locator('dl').filter({ hasText: 'Deadline' });
  const expectedDeadline = new Date(`${deadlineDate}T12:00:00Z`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  await expect(facts).toContainText(`${expectedDeadline} (end of day, America/Toronto)`);
  await expect(facts).toContainText('Check eligibility with organizer');
  await expect(facts).toContainText('Added by the Uni-Verse team');
  await expect(page.getByRole('link', { name: /Apply with organizer/ })).toBeVisible();
  expect(await facts.innerText()).not.toMatch(/verified/i);

  await page.goto(`/opportunities/${closedId}`);
  await expect(page.getByRole('heading', { level: 1, name: closedTitle })).toBeVisible();
  await expect(page.getByText('This opportunity has closed.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Apply with organizer|Register with organizer/ })).toHaveCount(0);
  await expect(page.locator('a[href="https://example.org/m3-closed-apply"]')).toHaveCount(0);
});

test('student saves the listing after sign-in; /saved shows it with the legacy saved event', async ({ browser, baseURL }) => {
  // A legacy save made before M2 lives in saved_events; it must appear beside the new save.
  expect((await db.from('saved_events').insert({ user_id: IDS.onboarded_student, event_id: savedEventId })).error).toBeNull();
  const context = await browser.newContext({ baseURL, storageState: storageStateFor('onboarded_student') });
  try {
    const page = await context.newPage();
    await page.goto(`/opportunities/${hackathonId}`);
    await page.getByRole('button', { name: 'Save for later', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Saved to your shortlist', exact: true })).toBeVisible();
    await page.goto('/saved');
    await expect(page.getByRole('link', { name: hackathonTitle, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: savedEventTitle, exact: true })).toBeVisible();
  } finally { await context.close(); }
});

test('resources: published guide reflows at 360px; drafts stay private; unsafe Markdown is refused', async ({ browser, baseURL, request }) => {
  const guide = { resource_type: 'guide', title: 'M3 acceptance guide to hackathon teams', summary: 'How to find a team for a student hackathon.',
    body_markdown: '## Find a team\n\nPost in the event channel and [read the rules](https://example.org/m3-rules).\n\n- Bring a laptop\n- Sleep a little',
    category: 'hackathons', audience: 'Students new to hackathons', author_name: 'Uni-Verse team' };
  const created = await admin.post('/api/admin/resources', { data: { ...guide, slug: resourceSlug } });
  expect(created.status(), await created.text()).toBe(201);
  const item = (await created.json()).item as { id: string; updated_at: string };
  const published = await admin.patch(`/api/admin/resources/${item.id}`, { data: { action: 'publish', expected_updated_at: item.updated_at } });
  expect(published.status(), await published.text()).toBe(200);
  const draft = await admin.post('/api/admin/resources', { data: { ...guide, slug: draftResourceSlug, title: 'M3 acceptance draft guide' } });
  expect(draft.status(), await draft.text()).toBe(201);
  const unsafe = await admin.post('/api/admin/resources', { data: { ...guide, slug: `m3-acceptance-unsafe-${stamp}`, body_markdown: 'Click [x](javascript:alert(1))' } });
  expect(unsafe.status()).toBe(400);
  expect((await db.from('resources').select('id').eq('slug', `m3-acceptance-unsafe-${stamp}`)).data).toEqual([]);

  const context = await browser.newContext({ baseURL, viewport: { width: 360, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(`/resources/${resourceSlug}`);
    await expect(page.getByRole('heading', { level: 1, name: guide.title })).toBeVisible();
    await expect(page.getByRole('link', { name: 'read the rules' })).toHaveAttribute('href', 'https://example.org/m3-rules');
    await noHorizontalScroll(page, 360);
  } finally { await context.close(); }

  const list = await request.get('/api/resources');
  expect(list.status()).toBe(200);
  const listText = await list.text();
  expect(listText).toContain(resourceSlug);
  expect(listText).not.toContain(draftResourceSlug);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain(`/resources/${resourceSlug}`);
  expect(sitemap).not.toContain(draftResourceSlug);
  // Next answers a streamed notFound() with 200 once the layout shell has
  // flushed (see page-smoke-matrix); the draft's content must still be absent.
  const draftPage = await request.get(`/resources/${draftResourceSlug}`);
  expect([200, 404]).toContain(draftPage.status());
  const draftHtml = await draftPage.text();
  expect(draftHtml).toContain('Page Not Found');
  expect(draftHtml).not.toContain('M3 acceptance draft guide');
});

test('public submission becomes a published listing only through moderation; retries and bots add nothing', async ({ page, browser, baseURL, request }) => {
  test.setTimeout(120_000);
  await page.goto('/submit');
  await page.getByLabel('What are you submitting?').selectOption('hackathon');
  await page.getByLabel('Title', { exact: true }).fill(submissionTitle);
  await page.getByLabel('Organization', { exact: true }).fill('M3 student hack club');
  await page.getByLabel('Link', { exact: true }).fill(`https://example.org/m3-submitted-${stamp}`);
  await page.getByLabel('Description', { exact: true }).fill('A weekend student hackathon open to every Montreal campus.');
  await page.getByLabel('Location', { exact: true }).fill('Synthetic hall');
  await page.getByLabel('Your email (optional)').fill(guestContactEmail);
  const [intake] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/api/submissions') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Send for review' }).click(),
  ]);
  expect(intake.status()).toBe(202);
  await expect(page.getByRole('status').filter({ hasText: 'Nothing is posted automatically' })).toBeFocused();
  const row = await db.from('submissions').select('id,status').eq('title', submissionTitle).single();
  expect(row.error).toBeNull();
  expect(row.data!.status).toBe('pending');
  const receipt = await page.locator('body').innerText();
  expect(receipt).not.toContain(row.data!.id);
  expect(receipt).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

  const queue = await admin.get('/api/admin/submissions?status=pending&limit=100');
  expect(queue.status()).toBe(200);
  const pending = ((await queue.json()).items as { id: string; title: string; updated_at: string }[]).find(item => item.title === submissionTitle);
  expect(pending?.id).toBe(row.data!.id);

  const context = await browser.newContext({ baseURL, storageState: storageStateFor('admin') });
  let draftId: string;
  try {
    const moderator = await context.newPage();
    await moderator.goto('/moderation/submissions');
    await moderator.getByRole('button', { name: new RegExp(submissionTitle) }).click();
    await expect(moderator.getByRole('heading', { level: 2, name: submissionTitle })).toBeVisible();
    await expect(moderator.getByText(guestContactEmail)).toBeVisible();
    const [converted] = await Promise.all([
      moderator.waitForResponse(response => response.url().endsWith(`/api/admin/submissions/${pending!.id}`) && response.request().method() === 'PATCH'),
      moderator.getByRole('button', { name: 'Convert to draft' }).click(),
    ]);
    expect(converted.status(), await converted.text()).toBe(200);
    draftId = (await converted.json()).target.id;
    createdOpportunities.add(draftId);
    await moderator.getByRole('link', { name: 'Open draft' }).click();
    await expect(moderator).toHaveURL(new RegExp(`/moderation/opportunities\\?id=${draftId}`));
    const editor = moderator.locator('form').filter({ has: moderator.getByRole('heading', { name: 'The opportunity', exact: true }) });
    await expect(editor.getByLabel('Title', { exact: true })).toHaveValue(submissionTitle);
    await expect(editor.getByRole('combobox', { name: 'Type', exact: true })).toHaveValue('hackathon');
    await editor.getByRole('combobox', { name: 'University relevance', exact: true }).selectOption('cross_campus');
    await editor.getByLabel(/^Next review/).fill(new Date(Date.now() + 21 * day).toISOString().slice(0, 16));
    await editor.getByRole('button', { name: 'Mark source checked now' }).click();
    const [saved] = await Promise.all([
      moderator.waitForResponse(response => response.url().endsWith(`/api/admin/opportunities/${draftId}`) && response.request().method() === 'PATCH'),
      editor.getByRole('button', { name: 'Save changes', exact: true }).click(),
    ]);
    expect(saved.status(), await saved.text()).toBe(200);
    const [published] = await Promise.all([
      moderator.waitForResponse(response => response.url().endsWith(`/api/admin/opportunities/${draftId}`) && response.request().method() === 'PATCH'),
      editor.getByRole('button', { name: 'Publish', exact: true }).click(),
    ]);
    expect(published.status(), await published.text()).toBe(200);
    await expect(editor.getByRole('status')).toHaveText('Published. The listing is available in discovery.');
  } finally { await context.close(); }

  await page.goto(`/discover?q=${encodeURIComponent(submissionTitle)}`);
  await expect(page.getByRole('link', { name: submissionTitle, exact: true })).toBeVisible();
  expect(await page.locator('body').innerText()).not.toContain(guestContactEmail);
  expect(await (await request.get(`/api/discovery?q=${encodeURIComponent(submissionTitle)}`)).text()).not.toContain(guestContactEmail);

  // A retried convert with the stale version answers the same target and writes nothing.
  const before = await db.from('opportunities').select('id', { count: 'exact', head: true }).eq('title', submissionTitle);
  expect(before.count).toBe(1);
  const retry = await admin.patch(`/api/admin/submissions/${pending!.id}`, { data: { action: 'convert', expected_updated_at: pending!.updated_at } });
  expect(retry.status(), await retry.text()).toBe(200);
  expect((await retry.json()).target).toEqual({ kind: 'opportunity', id: draftId! });
  const after = await db.from('opportunities').select('id', { count: 'exact', head: true }).eq('title', submissionTitle);
  expect(after.count).toBe(1);

  // A filled honeypot is acknowledged like a real submission and stores nothing.
  const bot = await request.post('/api/submissions', { data: { kind: 'hackathon', title: honeypotTitle, organization: 'Bot org', source_url: 'https://example.org/bot',
    description: 'Automated spam body.', website: 'https://spam.example' } });
  expect(bot.status()).toBe(202);
  expect(await bot.json()).toEqual({ received: true });
  const stored = await db.from('submissions').select('id', { count: 'exact', head: true }).eq('title', honeypotTitle);
  expect(stored.count).toBe(0);
});

test('guest report reaches the moderation queue and never appears publicly', async ({ page, browser, baseURL, request }) => {
  await page.goto(`/opportunities/${hackathonId}`);
  await page.getByRole('button', { name: 'Report a problem' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Broken link').check();
  await dialog.getByLabel('Details (optional)').fill(reportSentinel);
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog.getByRole('status')).toHaveText("Thanks — we'll take a look.");
  const report = await db.from('listing_reports').select('id,reason,reporter_user_id').eq('opportunity_id', hackathonId).eq('details', reportSentinel).single();
  expect(report.error).toBeNull();
  expect(report.data).toMatchObject({ reason: 'dead_link', reporter_user_id: null });

  const context = await browser.newContext({ baseURL, storageState: storageStateFor('admin') });
  try {
    const moderator = await context.newPage();
    await moderator.goto('/moderation/submissions');
    await moderator.getByRole('tab', { name: 'Listing reports' }).click();
    const entry = moderator.getByRole('listitem').filter({ hasText: reportSentinel });
    await expect(entry).toBeVisible();
    await expect(entry).toContainText('Broken link');
    await expect(entry.getByRole('link', { name: hackathonTitle })).toBeVisible();
  } finally { await context.close(); }

  for (const path of [`/opportunities/${hackathonId}`, `/api/opportunities/${hackathonId}`, '/api/discovery?type=hackathon']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text(), path).not.toContain(reportSentinel);
  }
  await page.reload();
  expect(await page.content()).not.toContain(reportSentinel);
});

test('company request converts to a partner job draft without leaking the contact or changing roles', async ({ browser, baseURL, request }) => {
  test.setTimeout(90_000);
  const rolesBefore = (await db.from('users').select('roles').eq('id', IDS.onboarded_student).single()).data?.roles;
  const sent = await student.post('/api/company-requests', { data: {
    company_name: 'M3 Synthetic Analytics', company_context: 'A small synthetic analytics studio used only for local tests.',
    role_title: companyRoleTitle, duties: 'Clean data and build weekly dashboards.', must_have_skills: 'Spreadsheets and curiosity.',
    hours: '10 hours a week', compensation: '$20 per hour', location: 'Montreal', work_mode: 'hybrid', start_date: 'January 2027',
    employment_type: 'internship', why_worth_it: 'Real mentorship on a small team.', source_url: `https://example.org/m3-company-${stamp}`,
    contact_name: 'Synthetic Recruiter', contact_email: companyEmail,
  } });
  expect(sent.status(), await sent.text()).toBe(202);
  expect(await sent.json()).toEqual({ received: true });
  const row = await db.from('submissions').select('id,kind,updated_at,submitter_user_id').eq('contact_email', companyEmail).single();
  expect(row.error).toBeNull();
  expect(row.data).toMatchObject({ kind: 'company_request', submitter_user_id: IDS.onboarded_student });

  const context = await browser.newContext({ baseURL, storageState: storageStateFor('admin') });
  try {
    const moderator = await context.newPage();
    await moderator.goto('/moderation/submissions');
    await moderator.getByRole('button', { name: new RegExp(companyRoleTitle) }).click();
    await expect(moderator.getByText('Hiring request · pending')).toBeVisible();
    await expect(moderator.getByText(companyEmail)).toBeVisible();
  } finally { await context.close(); }

  const converted = await admin.patch(`/api/admin/submissions/${row.data!.id}`, { data: { action: 'convert', expected_updated_at: row.data!.updated_at } });
  expect(converted.status(), await converted.text()).toBe(200);
  const convertedText = JSON.stringify(await converted.json());
  expect(convertedText).not.toContain(companyEmail);
  const target = JSON.parse(convertedText).target as { kind: string; id: string };
  expect(target.kind).toBe('opportunity');
  createdOpportunities.add(target.id);
  const draft = await admin.get(`/api/admin/opportunities/${target.id}`);
  expect(draft.status()).toBe(200);
  const draftBody = await draft.json();
  expect(draftBody.item).toMatchObject({ listing_type: 'job', source_type: 'partner', status: 'draft', title: companyRoleTitle });
  expect(JSON.stringify(draftBody)).not.toContain(companyEmail);

  // The editor's required checks (checked source, review date) are recorded
  // directly, then publication goes through the audited admin API.
  const prepared = await db.from('opportunities').update({ checked_at: new Date().toISOString(), review_at: new Date(Date.now() + 30 * day).toISOString(), relevance_scope: 'cross_campus' })
    .eq('id', target.id).select('updated_at').single();
  expect(prepared.error).toBeNull();
  const published = await admin.patch(`/api/admin/opportunities/${target.id}`, { data: { action: 'publish', expected_updated_at: prepared.data!.updated_at } });
  expect(published.status(), await published.text()).toBe(200);

  for (const path of ['/', '/discover', `/opportunities/${target.id}`, `/api/opportunities/${target.id}`, '/api/discovery', `/api/discovery?q=${encodeURIComponent(companyRoleTitle)}`]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text(), path).not.toContain(companyEmail);
  }
  expect(await (await request.get(`/api/discovery?q=${encodeURIComponent(companyRoleTitle)}`)).text()).toContain(target.id);
  expect((await db.from('users').select('roles').eq('id', IDS.onboarded_student).single()).data?.roles).toEqual(rolesBefore);
});

test('private fields never reach public HTML or RSC payloads', async ({ request }) => {
  const published = createdOpportunities.size ? [...createdOpportunities].map(id => `/opportunities/${id}`) : [];
  for (const path of ['/', '/discover', `/opportunities/${hackathonId}`, ...published]) {
    for (const headers of [{}, { RSC: '1' }] as Record<string, string>[]) {
      const response = await request.get(path, { headers });
      expect(response.status(), `${path} ${JSON.stringify(headers)}`).toBe(200);
      const body = await response.text();
      expect(body.length).toBeGreaterThan(0);
      for (const secret of [privateNote, companyEmail, guestContactEmail]) expect(body, `${path} ${JSON.stringify(headers)}`).not.toContain(secret);
    }
  }
  const rsc = await request.get(`/opportunities/${hackathonId}`, { headers: { RSC: '1' } });
  expect(rsc.headers()['content-type']).toContain('text/x-component');
  expect(await rsc.text()).toContain(hackathonTitle);
  for (const path of [`/api/opportunities/${hackathonId}`, '/api/discovery?type=hackathon']) {
    const body = await (await request.get(path)).text();
    expect(body).toContain(hackathonId);
    expect(body).not.toContain(privateNote);
    expect(body).not.toContain('duplicate_review_note');
  }
});

test('ingestion page shows deliveries to an admin and is closed to a student', async ({ browser, baseURL }) => {
  const adminContext = await browser.newContext({ baseURL, storageState: storageStateFor('admin') });
  try {
    const page = await adminContext.newPage();
    await page.goto('/moderation/ingestion');
    await expect(page.getByRole('heading', { name: 'Ingestion', exact: true })).toBeVisible();
    const row = page.getByRole('row').filter({ hasText: producer });
    await expect(row).toBeVisible();
    await expect(row).toContainText('succeeded');
  } finally { await adminContext.close(); }
  const studentContext = await browser.newContext({ baseURL, storageState: storageStateFor('onboarded_student') });
  try {
    const page = await studentContext.newPage();
    await page.goto('/moderation/ingestion');
    // The moderation layout redirects a non-admin to "/" (streamed redirect).
    await expect(page).toHaveURL(url => url.pathname === '/');
    await expect(page.getByText(producer)).toHaveCount(0);
  } finally { await studentContext.close(); }
});

test('an unreachable event image on an allowed host falls back to the placeholder', async ({ page }) => {
  await page.goto(`/events/${brokenImageEventId}`);
  const image = page.getByRole('img', { name: brokenImageTitle, exact: true }).first();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', /placeholder-event\.png/);
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
});
