/** CERT-08 successful recommendation/analytics workflows, namespace ad070006.
 * Scores are fixture inputs: this proves serving, explanations and attribution,
 * not the separate batch scorer's numerical algorithm. Existing sessions only.
 */
import { createHash } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/types';
import { assertSeedTargetAllowed, isLocalSeedTarget } from '../../scripts/seed/guard';
import { localStackEnv } from '../env';
import { IDS, storageStateFor, type PersonaKey } from '../fixtures';

const id = (n: number) => `ad070006-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const experiment = id(1), variants = [id(2), id(3)], club = id(4);
const scoredEvents = [id(10), id(11)], analyticsEvents = [id(20), id(21)];
const allEvents = [...scoredEvents, ...analyticsEvents];
let db: SupabaseClient<Database>;
let student: APIRequestContext, member: APIRequestContext, owner: APIRequestContext, admin: APIRequestContext;

async function clean() {
  // Exact disposable keys only, including every generated assignment/feedback.
  for (const result of [
    await db.from('recommendation_feedback').delete().in('event_id', allEvents),
    await db.from('experiment_assignments').delete().eq('experiment_id', experiment),
    await db.from('experiment_variants').delete().eq('experiment_id', experiment),
    await db.from('experiments').delete().eq('id', experiment),
    await db.from('user_event_scores').delete().in('event_id', allEvents),
    await db.from('events').delete().in('id', allEvents),
    await db.from('clubs').delete().eq('id', club),
  ]) expect(result.error, 'owned fixture cleanup').toBeNull();
}
async function createEvents(eventIds: string[], tags: string[][], clubId: string | null = null) {
  expect((await db.from('events').insert(eventIds.map((eventId, i) => ({
    id: eventId, title: `M0 recommendation workflow ${eventId}`, description: 'Disposable successful workflow fixture',
    organizer: 'M0 certification', club_id: clubId, created_by: IDS.club_owner, status: 'approved',
    start_date: `2036-07-0${i + 1}T16:00:00Z`, end_date: `2036-07-0${i + 1}T18:00:00Z`,
    location: 'Synthetic campus', tags: tags[i], source: 'manual',
    content_hash: createHash('sha256').update(eventId).digest('hex'),
  })))).error).toBeNull();
}
async function jsonGet(context: APIRequestContext, path: string) {
  const response = await context.get(path);
  expect(response.status(), path).toBe(200);
  expect(response.headers()['cache-control']).toBe('private, no-store');
  return response.json();
}
const percent = (numerator: number, denominator: number) => denominator ? Math.round(numerator / denominator * 10000) / 100 : 0;

test.beforeAll(async ({ playwright, baseURL }) => {
  const env = localStackEnv();
  if (!isLocalSeedTarget(env.url)) throw new Error('Recommendation workflow writes require the local stack');
  assertSeedTargetAllowed(env.url);
  db = createClient<Database>(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await clean();
  [student, member, owner, admin] = await Promise.all(['onboarded_student', 'club_member', 'club_owner', 'admin'].map(persona =>
    playwright.request.newContext({ baseURL, storageState: storageStateFor(persona as PersonaKey) })));
});
test.afterAll(async () => {
  try { if (db) await clean(); } finally { await Promise.all([student, member, owner, admin].filter(Boolean).map(context => context.dispose())); }
});

test('scored recommendations explain real interests; stable server assignments own feedback and two-user admin metrics', async () => {
  try {
    const users = [IDS.onboarded_student, IDS.club_member];
    const preexisting = await db.from('user_event_scores').select('event_id').in('user_id', users);
    expect(preexisting.error).toBeNull();
    expect(preexisting.data, 'isolated scoreless persona precondition; never erase shared scores').toEqual([]);
    const running = await db.from('experiments').select('id').eq('status', 'running');
    expect(running.error).toBeNull();
    expect(running.data, 'do not change another running experiment').toEqual([]);
    const profile = await db.from('users').select('interest_tags').eq('id', IDS.onboarded_student).single();
    expect(profile.error).toBeNull();
    expect(profile.data?.interest_tags).toContain('academic');
    await createEvents(scoredEvents, [['academic'], []]);

    const fallback = await jsonGet(student, '/api/recommendations?top_k=2');
    expect(fallback.source).toBe('popular_fallback');
    expect(fallback.recommendations).toHaveLength(2);
    for (const rec of fallback.recommendations) {
      expect(rec).toMatchObject({ score: 0, explanation: 'Trending on campus', event: { status: 'approved', deleted_at: null } });
      expect(Date.parse(rec.event.start_date)).toBeGreaterThan(Date.now());
    }
    expect((await db.from('experiments').insert({ id: experiment, name: 'M0 disposable recommendation experiment', status: 'running', target_metric: 'ctr' })).error).toBeNull();
    expect((await db.from('experiment_variants').insert(variants.map((variant, i) => ({ id: variant, experiment_id: experiment, name: `M0 variant ${i}`, config: { lambda: 1 }, weight: 1 })))).error).toBeNull();
    const tagBreakdown = { tag: 1, interaction: 0, popularity: 0, recency: 0, social: 0 };
    const popularBreakdown = { tag: 0, interaction: 0, popularity: 1, recency: 0, social: 0 };
    expect((await db.from('user_event_scores').insert(users.flatMap(user_id => [
      { user_id, event_id: scoredEvents[0], score: 1, breakdown: tagBreakdown },
      { user_id, event_id: scoredEvents[1], score: 0.3, breakdown: popularBreakdown },
    ]))).error).toBeNull();

    const assignments = new Map<string, string>();
    for (const [index, context] of [student, member].entries()) {
      const first = await jsonGet(context, '/api/recommendations?top_k=2&diversity=0');
      const repeated = await jsonGet(context, '/api/recommendations?top_k=2&diversity=0');
      expect(first.source).toBe('personalized');
      expect(first.total_events).toBe(2);
      expect(first.diversity_metadata.lambda).toBe(1);
      expect(first.recommendations.map((rec: { event_id: string }) => rec.event_id)).toEqual(scoredEvents);
      expect(first.recommendations.map((rec: { score: number }) => rec.score)).toEqual([1, 0.3]);
      expect(first.recommendations[1].explanation).toBe('Trending on campus');
      if (index === 0) expect(first.recommendations[0].explanation).toBe("Because you're interested in academic");
      expect(variants).toContain(first.experiment_variant_id);
      expect(repeated.experiment_variant_id).toBe(first.experiment_variant_id);
      assignments.set(users[index], first.experiment_variant_id);
    }
    const persisted = await db.from('experiment_assignments').select('user_id,variant_id').eq('experiment_id', experiment);
    expect(persisted.error).toBeNull(); expect(persisted.data).toHaveLength(2);
    for (const row of persisted.data ?? []) expect(row.variant_id).toBe(assignments.get(row.user_id));

    const baseline = await jsonGet(admin, '/api/recommendations/analytics?period=7d');
    for (const [index, context] of [student, member].entries()) {
      for (const action of ['impression', 'click', 'save', 'dismiss']) {
        const response = await context.post('/api/recommendations/feedback', { data: {
          event_id: scoredEvents[index], action, recommendation_rank: index + 1,
          experiment_variant_id: variants.find(variant => variant !== assignments.get(users[index])),
          user_id: IDS.admin, session_id: `m0-ad070006-${index}`,
        } });
        expect(response.status()).toBe(200); expect(await response.json()).toEqual({ ok: true });
      }
    }
    const feedback = await db.from('recommendation_feedback').select('user_id,event_id,action,experiment_variant_id,recommendation_rank').in('event_id', scoredEvents);
    expect(feedback.error).toBeNull(); expect(feedback.data).toHaveLength(8);
    for (const [index, userId] of users.entries()) {
      const rows = feedback.data!.filter(row => row.user_id === userId);
      expect(rows.map(row => row.action).sort()).toEqual(['click', 'dismiss', 'impression', 'save']);
      for (const row of rows) expect(row).toMatchObject({ event_id: scoredEvents[index], recommendation_rank: index + 1, experiment_variant_id: assignments.get(userId) });
    }
    const results = await jsonGet(admin, `/api/admin/experiments/${experiment}/results`);
    expect(results.experiment.id).toBe(experiment); expect(results.variant_metrics).toHaveLength(2);
    for (const metric of results.variant_metrics) {
      const count = [...assignments.values()].filter(variant => variant === metric.variant_id).length;
      expect(metric).toMatchObject({ assignments: count, impressions: count, clicks: count, saves: count, dismisses: count,
        ctr_percent: count ? 100 : 0, save_rate_percent: count ? 100 : 0, dismiss_rate_percent: count ? 100 : 0 });
    }
    expect(results.significance).toEqual({ statistic: 0, pValue: 0.5, significant: false });
    const after = await jsonGet(admin, '/api/recommendations/analytics?period=7d');
    expect(after.period).toBe('7d');
    for (const metric of ['impressions', 'clicks', 'saves', 'dismisses']) expect(after.metrics[metric]).toBe(baseline.metrics[metric] + 2);
    expect(after.metrics.ctr_percent).toBe(percent(after.metrics.clicks, after.metrics.impressions));
    expect(after.metrics.save_rate_percent).toBe(percent(after.metrics.saves, after.metrics.impressions));
    expect(after.metrics.dismiss_rate_percent).toBe(percent(after.metrics.dismisses, after.metrics.impressions));
    expect(after.metrics.avg_rank_of_clicked).toBeCloseTo(((baseline.metrics.avg_rank_of_clicked ?? 0) * baseline.metrics.clicks + 3) / after.metrics.clicks, 8);
    expect(after.diversity.recommended_tag_distribution).toEqual({ ...baseline.diversity.recommended_tag_distribution,
      academic: (baseline.diversity.recommended_tag_distribution.academic ?? 0) + 1 });
    expect(after.diversity.unique_tags_shown).toBe(Object.keys(after.diversity.recommended_tag_distribution).length);
  } finally { await clean(); }
});

test('club owner analytics aggregate two students RSVP/save/click activity and exact daily trends', async () => {
  try {
    expect((await db.from('clubs').insert({ id: club, name: 'M0 analytics fixture', status: 'approved', created_by: IDS.club_owner, category: 'academic' })).error).toBeNull();
    expect((await db.from('club_members').insert({ club_id: club, user_id: IDS.club_owner, role: 'owner' })).error).toBeNull();
    await createEvents(analyticsEvents, [['academic'], ['tech']], club);
    const recordedAt: string[] = [];
    for (const [index, context] of [student, member].entries()) {
      const rsvp = await context.post(`/api/events/${analyticsEvents[0]}/rsvp`, { data: { user_id: index ? IDS.club_member : IDS.onboarded_student, status: index ? 'interested' : 'going' } });
      expect([200, 201]).toContain(rsvp.status());
      const saved = await context.post(`/api/events/${analyticsEvents[0]}/save`);
      expect(saved.status()).toBe(200); expect(await saved.json()).toEqual({ saved: true });
      for (const interaction_type of ['view', 'click']) {
        const response = await context.post('/api/interactions', { data: { event_id: analyticsEvents[0], interaction_type, source: 'recommendation', session_id: `m0-ad070006-analytics-${index}` } });
        expect(response.status()).toBe(201); const body = await response.json();
        expect(body.success).toBe(true); recordedAt.push(body.recorded_at);
      }
    }
    const detail = await jsonGet(owner, `/api/events/${analyticsEvents[0]}/analytics`);
    expect(detail).toMatchObject({ event_id: analyticsEvents[0], views: 2, clicks: 2, saves: 2, unique_viewers: 2, rsvp_going: 1, rsvp_interested: 1 });
    const aggregate = await jsonGet(owner, `/api/clubs/${club}/analytics`);
    expect(aggregate.follower_growth).toEqual([]); expect(aggregate.total_attendees).toBe(1);
    expect(aggregate.popular_tags).toEqual(expect.arrayContaining([{ tag: 'academic', count: 1 }, { tag: 'tech', count: 1 }]));
    expect(aggregate.events).toHaveLength(2);
    expect(aggregate.events.find((row: { event_id: string }) => row.event_id === analyticsEvents[0])).toMatchObject({ ...detail, rsvp_cancelled: 0 });
    expect(aggregate.events.find((row: { event_id: string }) => row.event_id === analyticsEvents[1])).toMatchObject({ views: 0, clicks: 0, saves: 0, unique_viewers: 0, rsvp_going: 0, rsvp_interested: 0, rsvp_cancelled: 0 });
    const hours = Array.from({ length: 24 }, () => 0), days = new Map<string, number>(), dates = new Map<string, number>();
    for (const timestamp of recordedAt) {
      const date = new Date(timestamp);
      hours[Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(date))]++;
      const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(date);
      days.set(day, (days.get(day) ?? 0) + 1);
      // Daily buckets follow the server process timezone; the harness launches
      // that process with the same environment as this test worker.
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      dates.set(dateKey, (dates.get(dateKey) ?? 0) + 1);
    }
    expect(aggregate.peak_hours).toEqual(hours.map((count, hour) => ({ hour, count })));
    expect(aggregate.peak_days).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => ({ day, count: days.get(day) ?? 0 })));
    // No followers => denominator 1; four interactions must contribute 400%.
    expect(aggregate.engagement_trend).toHaveLength(31);
    for (const bucket of aggregate.engagement_trend) expect(bucket.rate).toBe((dates.get(bucket.date) ?? 0) * 100);
    expect(aggregate.engagement_trend.reduce((sum: number, row: { rate: number }) => sum + row.rate, 0)).toBe(400);
    expect(aggregate.best_event_type).toEqual({ tag: 'academic', avg_rsvps: 1, comparison: 2 });
  } finally { await clean(); }
});
