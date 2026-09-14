#!/usr/bin/env node
/**
 * classify-inventory.mjs — plan 01-11
 *
 * Applies the human classification verdicts to inventory/endpoints.json and
 * inventory/pages.json MECHANICALLY, so that the persona matrix is *derived*
 * rather than asserted, and so that a second interruption loses nothing.
 *
 * WHY A SCRIPT AND NOT HAND EDITS
 *   A first attempt at this plan hand-edited 33 of the 94 rows before it was
 *   terminated. The partial edit was discarded (`git checkout --`) precisely
 *   because a hand edit is not reproducible: nobody downstream can re-derive it,
 *   and nobody can prove which cells came from a rule and which from fatigue.
 *   Everything below re-runs from the committed inputs and is idempotent.
 *
 * WHAT IS A HUMAN VERDICT AND WHAT IS DERIVED
 *   VERDICTS (below) is the human classification: one record per endpoint id,
 *   carrying auth / role / rls / personalized / scope. Those five are read out
 *   of the handler source by a human and recorded here once.
 *   Everything else — the 13 persona expectations, input_validation,
 *   cache_policy_today/target, test_present, dead_or_duplicate — is COMPUTED
 *   from those verdicts plus the machine signals plus the captured baselines.
 *   The derivation rules are written out in prose in
 *   `.planning/audit/inventory/classification-rules.md`; this file is that
 *   document made executable. If the two ever disagree, the .md is the contract.
 *
 * READ-ONLY CONTRACT
 *   Writes only under .planning/audit/inventory/. Reads src/ but never writes it.
 *   The generators merge by `id`; this script does the same, so re-running
 *   gen-endpoint-inventory.mjs afterwards does not discard classification.
 *
 * USAGE
 *   node .planning/audit/tools/classify-inventory.mjs --phase 1   # authz cohort fields
 *   node .planning/audit/tools/classify-inventory.mjs --phase 2   # + remaining row fields
 *   node .planning/audit/tools/classify-inventory.mjs --phase 3   # + persona matrix + pages
 *   node .planning/audit/tools/classify-inventory.mjs             # same as --phase 3
 *   ... --dry-run                                                 # report, write nothing
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INV = path.join(ROOT, '.planning/audit/inventory');
const ENDPOINTS = path.join(INV, 'endpoints.json');
const PAGES = path.join(INV, 'pages.json');
const SERVICE_REGISTER = path.join(ROOT, '.planning/audit/authz/service-role-register.json');
const JEST_LIST = path.join(ROOT, '.planning/audit/baseline/jest-listtests.txt');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const phaseIdx = args.indexOf('--phase');
const PHASE = phaseIdx >= 0 ? Number(args[phaseIdx + 1]) : 3;

/* ------------------------------------------------------------------ inputs */

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

/**
 * The blanket platform header. vercel.json applies this to EVERY path matching
 * /api/(.*) with no exception for authenticated or personalized routes. It is
 * quoted verbatim; do not paraphrase it — REFAC-19 inverts exactly this string.
 */
const BLANKET_API_HEADER = 's-maxage=60, stale-while-revalidate=300';
/** next.config.ts headers() sets only security headers for /(.*) — no Cache-Control. */
const NO_PLATFORM_HEADER = '(none — vercel.json /api/(.*) rule does not match this path; next.config.ts sets no Cache-Control)';

/**
 * Jest suites that live under src/__tests__/ rather than beside the handler.
 * Colocated `route.test.ts` files are detected by fs.existsSync and need no entry.
 * `date-validation.test.ts` is deliberately absent: it exercises src/lib/dateValidation
 * pure functions, not a handler, so mapping it to a route would overstate coverage.
 */
const CENTRAL_TESTS = {
  'src/__tests__/api/events/get-events.test.ts': ['api.events'],
  'src/__tests__/api/events/rsvp.test.ts': ['api.events.id.rsvp'],
  'src/__tests__/api/events/reviews.test.ts': ['api.events.id.reviews'],
  'src/__tests__/api/events/analytics.test.ts': ['api.events.id.analytics'],
  'src/__tests__/api/clubs/analytics.test.ts': ['api.clubs.id.analytics'],
};

/**
 * dead_or_duplicate for handlers. quality/dead-code.md (plan 01-05) lists five
 * unused *component* files and no route handlers — knip treats every route.ts as
 * an entry point, so it structurally cannot flag one. The only dead handlers in
 * the tree were found by plan 01-10 against the live pg_cron catalog:
 * async/cron-webhook-inventory.md § 8 consolidated verdict table.
 */
const DEAD_HANDLERS = {
  'api.cron.send-reminders':
    'dead duplicate — async/cron-webhook-inventory.md §8: nothing invokes it (pg_net not installed, no Vercel cron, no GH Actions); public.send_event_reminders() runs the same behaviour in-database every 15 min',
  'api.cron.send-feedback-requests':
    'dead duplicate — async/cron-webhook-inventory.md §8: nothing invokes it and FO-04 returns HTTP 500 before the comparison on every request, so it cannot execute at all; public.send_feedback_requests() runs in-database every 30 min',
};

/* ----------------------------------------------------- the human verdicts -- */

/**
 * auth: the WEAKEST gate any exported method enforces (rule A5 in the .md).
 *       A route whose GET is ungated is `anonymous` even when its PATCH 401s,
 *       because the route's exposure is set by its weakest method.
 * role: the concrete role plus the MECHANISM that enforces it, or null.
 * rls:  primary | partial | none | bypassed.
 * pers: does the success body differ between two callers who are BOTH authorized
 *       for the route? (rule P1 — error bodies are excluded from the comparison.)
 * scope: global | self | club | club-owner | admin | machine — drives the
 *       club_member / club_owner / cross_club_attacker persona columns.
 */
const VIA_ADMIN = 'admin (src/lib/admin.ts verifyAdmin() → users.roles includes "admin")';
const VIA_CLUB = 'club membership (club_members lookup on the cookie client)';
const VIA_CLUB_OWNER = 'club owner (club_members.role === "owner")';

const A = (auth, role, rls, pers, scope, note) => ({ auth, role, rls, pers, scope, note });

const VERDICTS = {
  /* ---- admin surface: verifyAdmin() is the only gate, 22 rows ------------ */
  'api.admin.analytics.events': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.admin.analytics.users': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.admin.audit-log': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.admin.clubs.id': A('admin', VIA_ADMIN, 'bypassed', false, 'admin'),
  'api.admin.clubs': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.admin.events.id.edits': A('admin', VIA_ADMIN, 'bypassed', false, 'admin'),
  'api.admin.events.id': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.admin.events.id.status': A('admin', VIA_ADMIN, 'bypassed', false, 'admin'),
  'api.admin.events': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.admin.experiments.id.results': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.admin.experiments.id': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.admin.experiments': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.admin.featured.id': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.admin.featured': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.admin.organizer-requests.id': A('admin', VIA_ADMIN, 'bypassed', false, 'admin'),
  'api.admin.organizer-requests': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.admin.organizers': A('admin', VIA_ADMIN, 'bypassed', false, 'admin'),
  'api.admin.reports.id': A('admin', VIA_ADMIN, 'bypassed', false, 'admin'),
  'api.admin.reports': A('admin', VIA_ADMIN, 'bypassed', false, 'admin'),
  'api.admin.stats': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.admin.users.id.ban': A('admin', VIA_ADMIN, 'bypassed', false, 'admin'),
  'api.admin.users.id': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.admin.users': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.recommendations.analytics': A('admin', VIA_ADMIN, 'partial', false, 'admin'),
  'api.recommendations.batch': A('admin', VIA_ADMIN, 'bypassed', false, 'admin'),

  /* ---- machine surface: a shared secret compared to an env var ----------- */
  'api.admin.calculate-popularity': A(
    'machine',
    'machine secret ADMIN_API_KEY (Authorization: Bearer <secret>); NOT verifyAdmin() despite the /api/admin/ path',
    'bypassed',
    false,
    'machine',
    'FO-01 Critical: the gate is `if (expectedKey && ...)`, so it vanishes entirely when ADMIN_API_KEY is unset — which raw/vercel/env-names.json confirms it is in production. Anonymous service-role write.'
  ),
  'api.cron.send-reminders': A(
    'machine',
    'machine secret CRON_SECRET (Authorization: Bearer ${CRON_SECRET})',
    'bypassed',
    false,
    'machine',
    'FO-02 High: CRON_SECRET unset in production, so the comparison is against the fixed literal "Bearer undefined" — guessable, not absent.'
  ),
  'api.cron.send-feedback-requests': A(
    'machine',
    'machine secret CRON_SECRET, guarded by a presence check that 500s first',
    'bypassed',
    false,
    'machine',
    'FO-04 positive control: fails CLOSED. Returns 500 "Server misconfiguration" to every caller in production.'
  ),

  /* ---- authenticated, caller-scoped (self) ------------------------------- */
  'api.calendar.events': A('authenticated', null, 'partial', true, 'self'),
  'api.clubs.friends': A('authenticated', null, 'partial', true, 'self'),
  'api.events.my-events': A('authenticated', null, 'partial', true, 'self'),
  'api.my-clubs': A('authenticated', VIA_CLUB, 'partial', true, 'self'),
  'api.notifications': A('authenticated', null, 'partial', true, 'self'),
  'api.notifications.id': A('authenticated', null, 'partial', false, 'self'),
  'api.organizer-requests': A('authenticated', null, 'partial', true, 'self'),
  'api.profile.avatar': A('authenticated', null, 'bypassed', false, 'self'),
  'api.profile.banner': A('authenticated', null, 'bypassed', false, 'self'),
  'api.profile.inferred-tags': A('authenticated', null, 'partial', false, 'self'),
  'api.profile.interests': A('authenticated', null, 'partial', false, 'self'),
  'api.recommendations.feedback': A('authenticated', null, 'partial', true, 'self'),
  'api.user.engagement': A('authenticated', null, 'partial', true, 'self'),
  'api.user.following': A('authenticated', null, 'partial', true, 'self'),
  'api.users.id.follow': A('authenticated', null, 'partial', false, 'self'),
  'api.users.id': A('authenticated', 'self only — the handler asserts the path id equals the session user id', 'bypassed', false, 'self'),
  'api.users.me.friends': A('authenticated', null, 'partial', true, 'self'),
  'api.users.me.requests': A('authenticated', null, 'partial', true, 'self'),
  'api.users.me.suggestions': A('authenticated', null, 'bypassed', true, 'self'),
  'api.users.saved-events': A('authenticated', null, 'partial', true, 'self'),
  'api.users.search': A('authenticated', null, 'partial', true, 'self'),
  'api.events.upload-image': A('authenticated', null, 'none', false, 'self',
    'Storage write only; the object name is `${Date.now()}-${random}` with no user scoping, so the returned URL is not caller-derived. See storage/storage-review.md.'),
  'api.onboarding.complete': A('authenticated', null, 'none', false, 'self'),
  'api.events.create': A('authenticated', VIA_CLUB, 'partial', false, 'club'),
  'api.events.id.invite': A('authenticated', null, 'partial', false, 'self'),
  'api.events.id.report': A('authenticated', null, 'partial', false, 'self'),
  'api.events.id.save': A('authenticated', null, 'partial', true, 'self'),
  'api.moderation.reviews.targetType.targetId': A('authenticated',
    'inline roles check on the service client (users.roles includes "admin"), not verifyAdmin()', 'bypassed', false, 'admin'),

  /* ---- authenticated, club-scoped --------------------------------------- */
  'api.clubs.id.analytics': A('authenticated', VIA_CLUB, 'partial', false, 'club'),
  'api.clubs.id.appeal': A('authenticated', VIA_CLUB_OWNER, 'bypassed', false, 'club-owner'),
  'api.clubs.id.follow': A('authenticated', null, 'partial', true, 'self'),
  'api.clubs.id.invites': A('authenticated', VIA_CLUB, 'partial', false, 'club'),
  'api.clubs.id.members.role': A('authenticated', VIA_CLUB_OWNER, 'partial', false, 'club-owner'),
  'api.clubs.id.members': A('authenticated', VIA_CLUB, 'partial', false, 'club'),
  'api.clubs.id.transfer': A('authenticated', VIA_CLUB_OWNER, 'bypassed', false, 'club-owner'),
  'api.clubs.banner': A('authenticated', VIA_CLUB, 'partial', false, 'club'),
  'api.clubs.logo': A('authenticated', VIA_CLUB, 'partial', false, 'club'),
  'api.events.id.analytics': A('authenticated', VIA_CLUB, 'partial', false, 'club'),
  'api.events.id.appeal': A('authenticated', VIA_CLUB, 'bypassed', false, 'club'),
  'api.events.id.reviews': A('authenticated', null, 'partial', true, 'self',
    'GET returns `user_review` — the caller\'s own review — alongside the shared review list (route.ts:193,218).'),

  /* ---- anonymous-reachable: weakest method has no gate ------------------- */
  'api.clubs': A('anonymous', null, 'partial', false, 'global',
    'GET lists clubs with no getUser() at all; POST 401s. Rule A5 records the weakest method.'),
  'api.clubs.id': A('anonymous', null, 'partial', false, 'global',
    'GET returns the club with no caller scoping; PATCH/DELETE 401 then check club role.'),
  'api.clubs.featured': A('anonymous', null, 'primary', false, 'global'),
  'api.clubs.new': A('anonymous', null, 'primary', false, 'global'),
  'api.clubs.trending': A('anonymous', null, 'primary', false, 'global'),
  'api.events': A('anonymous', null, 'primary', false, 'global'),
  'api.events.featured': A('anonymous', null, 'primary', false, 'global'),
  'api.events.happening-now': A('anonymous', null, 'primary', false, 'global'),
  'api.events.new': A('anonymous', null, 'primary', false, 'global'),
  'api.events.popular': A('anonymous', null, 'primary', false, 'global'),
  'api.events.export': A('anonymous', null, 'primary', false, 'global',
    'No getUser() anywhere; exports approved events only. CSV/iCal, not JSON.'),
  'api.events.id': A('anonymous', null, 'partial', false, 'global',
    'GET is ungated and strips pending events for everyone; PATCH/DELETE 401 then role-check.'),
  'api.feedback': A('anonymous', null, 'partial', false, 'global',
    'getUser() is called but never enforced — the insert writes user_id null for anonymous callers.'),
  'api.interactions': A('anonymous', null, 'partial', false, 'global',
    'Comment on route.ts:83 says "optional - anonymous tracking supported"; no 401 path exists.'),
  'api.health': A('anonymous', null, 'none', false, 'global',
    'Calls getSession() as a probe, not as a gate. Returns a full infrastructure health report to anyone.'),
  'api.auth-debug': A('anonymous', null, 'none', true, 'self',
    'FINDING CANDIDATE: no gate at all, and the body echoes the CALLER\'S OWN id and email (route.ts:35-44). Anonymous + personalized + under the blanket s-maxage=60 rule is a cross-user identity-disclosure channel.'),

  /* ---- anonymous-tolerant AND personalized: the cache-disclosure cohort -- */
  'api.clubs.id.events': A('anonymous', null, 'partial', true, 'global',
    'No 401 anywhere. Returns `isOrganizer: true` plus the organizer event set to members and a reduced set to everyone else (route.ts:97,100).'),
  'api.events.id.friends': A('anonymous', null, 'partial', true, 'global',
    'Anonymous callers get {friends:[],count:0}; signed-in callers get their own social graph.'),
  'api.events.following': A('anonymous', null, 'partial', true, 'global',
    'Anonymous callers get {events:[]}; signed-in callers get the clubs they follow.'),
  'api.events.friends-activity': A('anonymous', null, 'partial', true, 'global'),
  'api.events.friends-organizing': A('anonymous', null, 'partial', true, 'global'),
  'api.notifications.count': A('anonymous', null, 'partial', true, 'global',
    'Anonymous callers get {unread_count:0}; signed-in callers get their own count.'),
  'api.events.id.rsvp': A('anonymous', null, 'partial', true, 'global',
    'GET has no 401; POST/DELETE do. Rule A5 records the weakest method.'),
  'api.recommendations': A('anonymous', null, 'partial', true, 'global',
    'No 401; anonymous callers fall through to the popularity feed. The ONLY route in the tree that sets private,no-store itself — and raw/prod/exact-counts.json shows user_event_scores at 0 rows, so every caller is on the fallback path today.'),

  /* ---- auth flow --------------------------------------------------------- */
  'auth.callback': A('anonymous',
    'none for the route itself; ADMIN_EMAILS drives a service-role role GRANT inside it (FO-05)', 'bypassed', true, 'self',
    'OAuth code exchange. The response is a redirect carrying the caller\'s own session cookies, so it is caller-specific by construction and must never be shared.'),
  'auth.signout': A('anonymous', null, 'none', false, 'self',
    'Clears cookies and 302s. Ban-exempt in src/middleware.ts BAN_EXEMPT_PATHS.'),
};

/* ---------------------------------------- persona derivation (rules R1-R13) */

const PERSONAS = [
  'anonymous', 'onboarded_student', 'mid_onboarding_student', 'club_member',
  'club_owner', 'multi_club_organizer', 'cross_club_attacker', 'admin',
  'banned_permanent', 'suspended_active', 'suspension_expired',
  'non_mcgill_signin', 'machine_no_credential',
];

/** Paths the middleware ban ring exempts (src/middleware.ts BAN_EXEMPT_PATHS). */
const BAN_EXEMPT = new Set(['auth.signout', 'auth.callback']);

/**
 * Hand overrides. Every entry MUST also appear in classification-rules.md § 5
 * with its reason. The key is `${id}.${persona}`.
 */
const EXPECTED_OVERRIDES = {
  // /auth/callback is the one route a mid-onboarding user MUST be able to reach:
  // it is what sets the needs_onboarding cookie in the first place.
  'auth.callback.banned_permanent': 302,
  'auth.callback.suspended_active': 302,
  // Signing out must always succeed, including while banned — otherwise a banned
  // user cannot clear their own session. This is the reason the exemption exists.
  'auth.signout.banned_permanent': 302,
  'auth.signout.suspended_active': 302,
  // A machine caller is a bearer token, not a McGill identity: the non-McGill
  // persona is an authentication-flow case and does not apply to endpoint rows.
};

/**
 * Page-level hand overrides. Recorded in classification-rules.md § 5.
 *
 * users.id — pages.json carried effective_protection "auth" on the strength of
 * page_guard "getUser". Plan 01-07 proved that guard does not gate: the
 * getUser() at src/app/users/[id]/page.tsx:56 only redirects a SELF-view to
 * /profile (lines 58-60) and has no unauthenticated branch, so an anonymous
 * request reaches the service-role read at line 63, which selects `email`,
 * `visibility` and `interest_tags` for an attacker-supplied path id. Worse,
 * generateMetadata at lines 33-48 constructs the same RLS-bypassing client with
 * no session read of any kind. A page that renders another tenant's data while
 * neither ring covers it is, by the plan's own definition,
 * unprotected_but_should_be.
 */
const PAGE_OVERRIDES = {
  'users.id': 'unprotected_but_should_be',
};

function successCode(row) {
  if (row.id.startsWith('auth.')) return 302;
  if (row.methods.includes('GET')) return 200;
  const src = fs.readFileSync(path.join(ROOT, row.file), 'utf8');
  return /status:\s*201/.test(src) ? 201 : 200;
}

function derivePersonas(row, v) {
  const S = successCode(row);
  const { auth, scope } = v;
  const out = {};

  // R1 — the baseline signed-in student.
  const student =
    auth === 'machine' ? 401
      : auth === 'admin' ? 403
        : scope === 'club' || scope === 'club-owner' ? 403
          : S;

  // R2 — anonymous.
  out.anonymous = auth === 'anonymous' ? S : 401;

  // R3 — onboarded student.
  out.onboarded_student = student;

  // R4 — mid-onboarding. The middleware onboarding guard explicitly skips
  // /api/ and /auth/ (src/middleware.ts), so every row in this inventory is
  // unaffected and inherits R3. For PAGES the guard is a 307 redirect.
  out.mid_onboarding_student = student;

  // R5/R6/R7 — club personas.
  out.club_member = scope === 'club' ? S : scope === 'club-owner' ? 403 : student;
  out.club_owner = scope === 'club' || scope === 'club-owner' ? S : student;
  out.multi_club_organizer = out.club_owner;

  // R8 — cross-club attacker: authorized elsewhere, never here.
  out.cross_club_attacker = scope === 'club' || scope === 'club-owner' ? 403 : student;

  // R9 — admin. Admin is not a club-role bypass anywhere in this tree.
  out.admin =
    auth === 'machine' ? 401
      : auth === 'admin' ? S
        : scope === 'club' || scope === 'club-owner' ? 403
          : S;

  // R10/R11 — ban ring. src/middleware.ts gates every path except BAN_EXEMPT_PATHS.
  const banned = BAN_EXEMPT.has(row.id) ? S : 403;
  out.banned_permanent = banned;
  out.suspended_active = banned;

  // R12 — an expired suspension is not a ban; isBanned() returns false.
  out.suspension_expired = student;

  // R13 — non-McGill sign-in never reaches an endpoint: it is an
  // authentication-flow case, resolved at /auth/callback before any API call.
  out.non_mcgill_signin = row.id === 'auth.callback' ? 302 : 'n/a';

  // R14 — a machine caller presenting no credential. On a machine route this is
  // the whole point of the row; everywhere else it is indistinguishable from
  // an anonymous caller.
  out.machine_no_credential = auth === 'machine' ? 401 : out.anonymous;

  for (const p of PERSONAS) {
    const k = `${row.id}.${p}`;
    if (k in EXPECTED_OVERRIDES) out[p] = EXPECTED_OVERRIDES[k];
  }
  return out;
}

/* ---------------------------------------------------------------- run ----- */

function main() {
  const rows = readJson(ENDPOINTS);
  const register = readJson(SERVICE_REGISTER);
  const regByFile = new Map(register.map((r) => [r.file, r]));
  const jest = fs.existsSync(JEST_LIST)
    ? fs.readFileSync(JEST_LIST, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
    : [];
  const centralCovered = new Set();
  for (const line of jest) {
    const rel = line.startsWith(ROOT) ? line.slice(ROOT.length + 1) : line;
    for (const id of CENTRAL_TESTS[rel] || []) centralCovered.add(id);
  }

  const missing = [];
  let changed = 0;

  for (const row of rows) {
    const v = VERDICTS[row.id];
    if (!v) { missing.push(row.id); continue; }
    const before = JSON.stringify(row);
    const src = fs.readFileSync(path.join(ROOT, row.file), 'utf8');

    /* ---- phase 1: the four authorization fields ------------------------- */
    row.auth_requirement = v.auth;
    row.role_required = v.role;
    // A handler on the service-role client bypasses RLS by construction. The
    // verdict table above never contradicts this; assert rather than trust.
    row.rls_reliance = row.signals.uses_service_client ? 'bypassed' : v.rls;
    if (row.signals.uses_service_client) {
      const reg = regByFile.get(row.file);
      row.service_role_justified = reg
        ? reg.verdict
        : 'not-in-register — inline createAdminClient() rather than createServiceClient(); see authz/fail-open-register.md FO-01';
    } else {
      row.service_role_justified = null;
    }

    /* ---- phase 2: everything else on the row ---------------------------- */
    if (PHASE >= 2) {
      row.personalized = v.pers;

      // cache_policy_today: the handler's own header when it sets one, else the
      // blanket platform header. Quoted verbatim from vercel.json.
      row.cache_policy_today = row.signals.sets_cache_control
        ? [...new Set(row.signals.cache_control_values)].join(' ; ')
        : (row.route.startsWith('/api/') ? BLANKET_API_HEADER : NO_PLATFORM_HEADER);

      // cache_policy_target: REFAC-19's input.
      const mutatingOnly = !row.methods.includes('GET');
      row.cache_policy_target = v.pers
        ? 'private, no-store'
        : mutatingOnly
          ? 'no-store'
          : row.auth_requirement === 'anonymous'
            ? 'public, s-maxage=60, stale-while-revalidate=300'
            : 'private, no-store';

      // input_validation: no schema validator is imported anywhere in src/
      // (signals.has_zod is false on all 94 rows), so the only two reachable
      // values are manual and none. A handler that parses a body and has no
      // 400 path validates nothing — that is the REFAC-15 candidate set.
      row.input_validation = row.signals.has_zod
        ? 'zod'
        : row.signals.parses_body
          ? (/status:\s*400/.test(src) ? 'manual' : 'none')
          : 'none';

      const colocated = row.file.replace(/route\.ts$/, 'route.test.ts');
      row.test_present = fs.existsSync(path.join(ROOT, colocated)) || centralCovered.has(row.id);

      row.dead_or_duplicate = row.id in DEAD_HANDLERS;
    }

    /* ---- phase 3: the persona matrix ------------------------------------ */
    if (PHASE >= 3) {
      row.expected_status = derivePersonas(row, v);
    }

    if (JSON.stringify(row) !== before) changed++;
  }

  if (missing.length) {
    console.error(`FATAL: ${missing.length} endpoint ids have no verdict: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!DRY) writeJson(ENDPOINTS, rows);
  console.log(`endpoints: ${rows.length} rows, ${changed} changed (phase ${PHASE}${DRY ? ', dry-run' : ''})`);

  /* ---- phase 3: pages -------------------------------------------------- */
  if (PHASE >= 3) {
    const pages = readJson(PAGES);
    let pchanged = 0;
    for (const p of pages) {
      const b = JSON.stringify(p);
      // Ring reconciliation (rule G1): protected when EITHER ring covers it.
      // Plan 01-03 already resolved these from source; this pass re-asserts the
      // rule so a regeneration cannot silently weaken a verdict, and applies the
      // one override plan 01-07 raised.
      if (p.id in PAGE_OVERRIDES) p.effective_protection = PAGE_OVERRIDES[p.id];
      else if (p.layout_guard) p.effective_protection = 'admin';
      else if (!p.middleware_protected && !p.page_guard && p.effective_protection === 'auth') {
        p.effective_protection = 'unprotected_but_should_be';
      }
      // dead_or_duplicate: quality/dead-code.md lists no page.tsx among its five
      // unused files, and every page route appears in inventory/build-routes.txt.
      if (typeof p.dead_or_duplicate !== 'boolean') p.dead_or_duplicate = false;
      if (JSON.stringify(p) !== b) pchanged++;
    }
    if (!DRY) writeJson(PAGES, pages);
    console.log(`pages: ${pages.length} rows, ${pchanged} changed`);
  }
}

main();
