# M3 — Make Discovery Useful: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the editorial homepage, richer event/opportunity details, an authored resource library, public submissions/reports/company intake feeding moderation, and a real, observable McGill ingestion path — all behind the existing `discovery_ui` switch.

**Architecture:** Additive Supabase tables with explicit grants and RLS, mutated only through service-role RPCs called from guarded route handlers (the M2 pattern). Public reads use the cookie client against invoker views/tables with column grants. Pages are server components that gate on `requireDiscoveryPage()` and hydrate small client islands. The ingestion producer is a repo script that signs payloads for the existing `events-webhook`; the webhook gains a delivery log that feeds health and a moderation ingestion page.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (Postgres 17, pgTAP, Storage, Edge Functions/Deno), zod 4, Jest 30 (node + jsdom projects), Playwright, Tailwind/shadcn.

**Spec:** `docs/plans/2026-09-27-universe-phase-1-implementation-plan.md` (§5.1–5.2, §6–8, packages P1-06–P1-09, §11) and `docs/plans/2026-09-27-universe-phase-1-milestones.md` (M3). Decisions: `.planning/milestones/m3/DECISIONS.md`. Read both before starting a task.

## Global Constraints

- Node 24 / npm 11; Supabase CLI **2.115.0** for type generation (`supabase gen types typescript --local --schema public > src/lib/supabase/types.ts`); the committed types must equal a fresh generation byte-for-byte.
- Never read, print or modify `.env.local`. `.env` may be read only by the producer script via `dotenv.parse`, and values are never printed or logged.
- No deployment, push, production migration, external email, or production data write. Local Supabase stack only; seed/test targets must pass `assertSeedTargetAllowed`.
- Never fabricate listings, resources, founder copy, endorsements, employer relationships or metrics. Empty editorial sections are omitted or show an honest empty state.
- No provenance label says "Verified". Use `provenanceLabel()` (Task 6).
- Every route export is `export const VERB = withRoute({ cache, action }, handler)`; input only via `parseBody`/`parseQuery`/`parseForm`/`parseWith` with a schema in `src/contracts/`; logging only via `log` from `@/server/log`; never put a caught error's `.message` in a response. Every new API uses `cache: "private"` (the M2 decision; shared caching is M4 work).
- New public pages call `requireDiscoveryPage()`; new public APIs return `notFound("Not found")` when `!getDiscoveryAccess(ctx).enabled`. Admin APIs use `adminContext()` from `src/server/opportunities/admin.ts`.
- Elevated access only through `getElevatedClient()` from `@/server/db/elevated`, with a row added under a new `### M3` section in `src/server/db/elevated/REGISTRY.md` (`| Caller | Operations | Guard / reason |`).
- **New table checklist:** `REVOKE ALL ON public.T FROM PUBLIC, anon, authenticated;` then explicit grants (column-level `GRANT SELECT(...)` for public projections), `GRANT ALL ON public.T TO service_role;`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`, policies per operation, FK indexes. Regenerate types. Add exactly four read lines (anon, subject, outsider, admin) for the table inside the CERT-07 region of `supabase/tests/database/100-public-table-rls-matrix.test.sql` (plus a write-deny line if all four allow), bump its `SELECT plan(N);`, and bump the table count string in `src/__tests__/scripts/check-rls-coverage.test.ts`. Any new pgTAP file using `service_role` must be added to the `privilegedFunctional` set in `scripts/check-rls-coverage.mjs`.
- **New RPC checklist:** `SET search_path = ''`, fully qualified names, `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;`, first statement `PERFORM public.discovery_require_editor(p_actor);` for editor RPCs, `pg_advisory_xact_lock` where concurrent writers race, stale check `IF v.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION USING ERRCODE='40001'`, audit row in `public.admin_audit_log(admin_user_id, action, target_type, target_id, metadata)` with no private contact data.
- **New route checklist** (run `npm test` after; failures name what is missing):
  1. Add an arm to `M2_ARMS` in `src/__tests__/api/m2RouteArms.ts` (`admin`, `active`, `write`, `query`, `body` flags as applicable; a public anonymous POST has neither `admin` nor `active`, but has `write: true` only if the tree test requires it — follow the failure message).
  2. Add the route to `M1_M2_ENDPOINTS` (and pages to `M1_M2_PAGES`) in `.planning/audit/tools/m1-m2-inventory.mjs`, then run `node .planning/audit/tools/m1-m2-inventory.mjs --write`.
  3. Add every non-GET verb to `MUTATIONS` in `e2e/helpers/authorizationProbes.ts` with its flags-off status (`{ status: 404 }` for discovery-gated routes; admin routes use the same status the M2 admin routes use).
  4. Add every new page to `PAGE_SMOKES` in `e2e/helpers/pageSmokeManifest.ts` (`{ ...publicPage, notFound: true }` for discovery-gated pages; moderation pages follow the existing moderation entries).
  5. Add a `BAD_REQUEST_ROWS`/`PINNED_ELSEWHERE` entry in `src/__tests__/contracts/badRequestTable.ts` pointing at `m2-route-boundaries.test.ts`.
  6. Bump the hard-coded counts the census suites report (`cache-headers-defect.test.ts`, `uncaught-throw-defect.test.ts`, `admin/admin-arm-tree-defect.test.ts`) to the new actual values.
- Client files that `fetch` a mutating `/api/...` must `import type` their body from `@/contracts/...` (contracts census `--client`).
- Stage explicit paths only (never `git add -A`); `.agents/`, `docs/product-master-plan.md`, `skills-lock.json` stay untracked.
- Long commands: print a one-line progress note before and after; DB SQL goes through `docker exec -i supabase_db_Event-Radar psql -v ON_ERROR_STOP=1 -U postgres -f -` with a file, never interactive; never run two DB clients at once; no probes during `supabase db reset`.

## Review Focus

1. **Switch off = old product.** With every `FEATURE_*` unset, `/` must render the legacy homepage exactly as before, `/about` the legacy About, and every new page/API must 404. Pinned by the baseline Playwright suite plus page-smoke entries (Tasks 4, 7, 11, 13) and `src/__tests__/app/home-switch.test.tsx` (Task 5).
2. **Hostile intake.** Oversized/HTML/`javascript:` input, a filled honeypot, a forged `status`/`is_pick` key, or a guessed ID must never publish, set editorial state, or reveal private contact data. Pinned by contract tests (Tasks 2, 9) and pgTAP `140-intake.test.sql` (Task 8).
3. **Double actions.** A retried convert, a double-clicked publish, or a replayed ingestion batch must not create a second record. Pinned by pgTAP (Tasks 1, 8), the webhook replay test (Task 12) and the real local replay (Task 16).
4. **Stale/broken external content.** An expired Instagram image URL must render the placeholder, an expired listing must show a closed state with no action, and a pending item whose date passed must stay visible to moderators. Pinned by Tasks 6, 13, 14.
5. **Private data in public payloads.** Duplicate-review notes, submitter/company contacts, reporter details and draft resources must not appear in any public HTML, RSC payload, sitemap or public JSON. Pinned by pgTAP column-grant checks and the M3 acceptance spec (Task 17).

---

## Package P1-08 — Authored resources (Tasks 1–4, one commit)

### Task 1: Resources schema, RPC and database tests

**Files:**
- Create: `supabase/migrations/20260929120000_m3_resources.sql`
- Create: `supabase/tests/database/130-resources.test.sql`
- Modify: `supabase/tests/database/100-public-table-rls-matrix.test.sql`, `src/__tests__/scripts/check-rls-coverage.test.ts`, `scripts/check-rls-coverage.mjs` (privilegedFunctional set), `src/lib/supabase/types.ts` (regenerated)

**Interfaces:**
- Produces: tables `public.resources`, `public.resource_actions`; private bucket `resource-files`; RPC `public.curate_resource(p_actor uuid, p_id uuid, p_action text, p_data jsonb DEFAULT '{}', p_expected timestamptz DEFAULT NULL) RETURNS jsonb` (actions `create|edit|publish|archive`; returns the full row as jsonb).

- [ ] **Step 1: Write the migration**

```sql
-- M3 P1-08: authored resources. Admin-authored only; public reads published rows.
CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 120 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  resource_type text NOT NULL CHECK (resource_type IN ('guide','external','template')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  summary text NOT NULL CHECK (length(trim(summary)) BETWEEN 1 AND 500),
  body_markdown text CHECK (length(body_markdown) <= 50000),
  external_url text CHECK (external_url ~* '^https://' AND length(external_url) <= 2048),
  file_path text CHECK (file_path ~ '^[0-9a-f-]{36}/[a-z0-9-]{1,80}\.(pdf|docx|xlsx|pptx)$'),
  file_name text CHECK (length(file_name) BETWEEN 1 AND 200),
  file_size integer CHECK (file_size BETWEEN 1 AND 10485760),
  category text NOT NULL CHECK (category IN ('career','applications','hackathons','academics','funding','campus_life')),
  audience text NOT NULL CHECK (length(trim(audience)) BETWEEN 1 AND 200),
  author_name text NOT NULL CHECK (length(trim(author_name)) BETWEEN 1 AND 120),
  author_url text CHECK (author_url ~* '^https://' AND length(author_url) <= 2048),
  source_note text CHECK (length(source_note) <= 500),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT resources_shape CHECK (
    (resource_type = 'guide' AND body_markdown IS NOT NULL AND length(trim(body_markdown)) > 0 AND external_url IS NULL AND file_path IS NULL)
    OR (resource_type = 'external' AND external_url IS NOT NULL AND file_path IS NULL)
    OR (resource_type = 'template' AND external_url IS NULL)),
  CONSTRAINT resources_file_fields CHECK (num_nonnulls(file_path, file_name, file_size) IN (0, 3)),
  CONSTRAINT resources_published_state CHECK (status <> 'published' OR (published_at IS NOT NULL AND reviewed_at IS NOT NULL AND (resource_type <> 'template' OR file_path IS NOT NULL)))
);
CREATE INDEX resources_public ON public.resources (category, reviewed_at DESC) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX resources_created_by ON public.resources (created_by);
CREATE INDEX resources_updated_by ON public.resources (updated_by);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.resources FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, slug, resource_type, title, summary, body_markdown, external_url, file_name, file_size, category,
  audience, author_name, author_url, source_note, status, reviewed_at, published_at, deleted_at) ON public.resources TO anon, authenticated;
GRANT ALL ON public.resources TO service_role;
CREATE POLICY resources_public_read ON public.resources FOR SELECT TO anon, authenticated
  USING (status = 'published' AND deleted_at IS NULL);

CREATE TABLE public.resource_actions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('outbound','download')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resource_actions_resource ON public.resource_actions (resource_id, created_at DESC);
ALTER TABLE public.resource_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.resource_actions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.resource_actions TO authenticated;
GRANT ALL ON public.resource_actions TO service_role;
CREATE POLICY resource_actions_admin_read ON public.resource_actions FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('resource-files', 'resource-files', false, 10485760, ARRAY[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
ON CONFLICT (id) DO NOTHING;
-- No storage.objects policy: only the service role reads/writes; downloads use short signed URLs.

CREATE FUNCTION public.curate_resource(p_actor uuid, p_id uuid, p_action text, p_data jsonb DEFAULT '{}'::jsonb, p_expected timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v public.resources;
  v_before public.resources;
  v_keys text[] := ARRAY['slug','resource_type','title','summary','body_markdown','external_url','file_path','file_name',
    'file_size','category','audience','author_name','author_url','source_note'];
  v_changed text[];
BEGIN
  PERFORM public.discovery_require_editor(p_actor);
  PERFORM pg_advisory_xact_lock(71405);
  IF p_action NOT IN ('create','edit','publish','archive') THEN RAISE EXCEPTION 'invalid action' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_data) k WHERE k <> ALL (v_keys)) THEN
    RAISE EXCEPTION 'unsupported field' USING ERRCODE = '22023';
  END IF;
  IF p_action = 'create' THEN
    INSERT INTO public.resources (slug, resource_type, title, summary, body_markdown, external_url, category, audience,
      author_name, author_url, source_note, created_by, updated_by)
    VALUES (p_data->>'slug', p_data->>'resource_type', p_data->>'title', p_data->>'summary', p_data->>'body_markdown',
      p_data->>'external_url', p_data->>'category', p_data->>'audience', p_data->>'author_name', p_data->>'author_url',
      p_data->>'source_note', p_actor, p_actor)
    RETURNING * INTO v;
    v_changed := ARRAY(SELECT jsonb_object_keys(p_data));
  ELSE
    SELECT * INTO v_before FROM public.resources WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'resource not found' USING ERRCODE = 'P0002'; END IF;
    IF v_before.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'stale resource' USING ERRCODE = '40001'; END IF;
    IF p_action = 'edit' THEN
      IF v_before.published_at IS NOT NULL AND p_data ? 'slug' AND p_data->>'slug' IS DISTINCT FROM v_before.slug THEN
        RAISE EXCEPTION 'slug is fixed after publication' USING ERRCODE = '22023';
      END IF;
      UPDATE public.resources r SET
        slug = COALESCE(p_data->>'slug', r.slug),
        resource_type = COALESCE(p_data->>'resource_type', r.resource_type),
        title = COALESCE(p_data->>'title', r.title),
        summary = COALESCE(p_data->>'summary', r.summary),
        body_markdown = CASE WHEN p_data ? 'body_markdown' THEN p_data->>'body_markdown' ELSE r.body_markdown END,
        external_url = CASE WHEN p_data ? 'external_url' THEN p_data->>'external_url' ELSE r.external_url END,
        file_path = CASE WHEN p_data ? 'file_path' THEN p_data->>'file_path' ELSE r.file_path END,
        file_name = CASE WHEN p_data ? 'file_name' THEN p_data->>'file_name' ELSE r.file_name END,
        file_size = CASE WHEN p_data ? 'file_size' THEN (p_data->>'file_size')::integer ELSE r.file_size END,
        category = COALESCE(p_data->>'category', r.category),
        audience = COALESCE(p_data->>'audience', r.audience),
        author_name = COALESCE(p_data->>'author_name', r.author_name),
        author_url = CASE WHEN p_data ? 'author_url' THEN p_data->>'author_url' ELSE r.author_url END,
        source_note = CASE WHEN p_data ? 'source_note' THEN p_data->>'source_note' ELSE r.source_note END,
        reviewed_at = CASE WHEN r.status = 'published' THEN now() ELSE r.reviewed_at END,
        updated_by = p_actor, updated_at = clock_timestamp()
      WHERE r.id = p_id RETURNING * INTO v;
      v_changed := ARRAY(SELECT jsonb_object_keys(p_data));
    ELSIF p_action = 'publish' THEN
      UPDATE public.resources r SET status = 'published', published_at = COALESCE(r.published_at, now()),
        reviewed_at = now(), updated_by = p_actor, updated_at = clock_timestamp()
      WHERE r.id = p_id RETURNING * INTO v;
    ELSE
      UPDATE public.resources r SET status = 'archived', updated_by = p_actor, updated_at = clock_timestamp()
      WHERE r.id = p_id RETURNING * INTO v;
    END IF;
  END IF;
  INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id, metadata)
  VALUES (p_actor, 'resource_' || p_action, 'resource', v.id::text,
    jsonb_build_object('previous_status', v_before.status, 'changed_fields', to_jsonb(COALESCE(v_changed, '{}'::text[]))));
  RETURN to_jsonb(v);
END $$;
REVOKE ALL ON FUNCTION public.curate_resource(uuid, uuid, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.curate_resource(uuid, uuid, text, jsonb, timestamptz) TO service_role;
```

Before running, confirm `admin_audit_log.target_id`'s type in the baseline migration (`grep -n "admin_audit_log" supabase/migrations/*baseline*.sql`) and drop the `::text` cast if it is `uuid`. Confirm `public.is_admin()` exists with that name.

- [ ] **Step 2: Write `130-resources.test.sql`** (namespace `…0000130xx`, pattern of `120-discovery-functional.test.sql`; `BEGIN; SELECT no_plan(); … SELECT * FROM finish(); ROLLBACK;`). Assertions, each one line:
  - Fixtures as owner: admin `…013001` (`{user,admin}`), student `…013002`; resources: published guide `…013011`, draft guide `…013012`, archived `…013013`, published-but-deleted `…013014`.
  - `tests.act_as_anon()`: count of visible `public.resources` rows in the namespace is 1; `throws_ok('SELECT created_by FROM public.resources','42501',...)`; `throws_ok($$INSERT INTO public.resources(...) VALUES(...)$$,'42501',...)`; `throws_ok($$SELECT public.curate_resource(...)$$,'42501',...)`.
  - `tests.act_as(student)`: `resource_actions` count 0 for seeded action rows.
  - `tests.act_as(admin)`: `throws_ok(curate_resource ...,'42501')` (cookie admin cannot call); `resource_actions` count > 0.
  - `tests.act_as_owner(); SET LOCAL ROLE service_role;`:
    - create guide returns status `draft`, `reviewed_at` NULL;
    - `curate_resource(student, …, 'create', …)` → `42501`;
    - create guide with empty body → `23514`;
    - publish with stale `p_expected` → `40001`;
    - publish with correct `updated_at` sets `published_at` and `reviewed_at`;
    - edit published resource returns `reviewed_at` greater than the value after publish (capture with a temp table);
    - edit published with a new slug → `22023`;
    - unknown key `{"status":"published"}` in edit → `22023`;
    - publishing a `template` without file fields → `23514`;
    - one `admin_audit_log` row with `action='resource_publish'` and `target_id` of the resource.
- [ ] **Step 3: Apply and regenerate.** `supabase db reset --local` (progress note before/after), then `supabase gen types typescript --local --schema public > src/lib/supabase/types.ts`.
- [ ] **Step 4: RLS matrix.** Add four read lines for `resources` (anon allow 1 published fixture, subject allow, outsider allow, admin allow → all allow, so add `resources … write deny` via `throws_ok('INSERT … public.resources …','42501',NULL,'resources authenticated write deny')`), four for `resource_actions` (anon `throws_ok … 42501 … read deny`, subject deny count 0, outsider deny count 0, admin allow count ≥1 from a fixture inserted above the region). Bump `plan(...)`, bump the table count in `check-rls-coverage.test.ts` (36 → 38), add `130-resources` to `privilegedFunctional`.
- [ ] **Step 5: Run.** `supabase test db --local` → all files pass; `node scripts/check-rls-coverage.mjs` → pass; `npx jest src/__tests__/scripts/check-rls-coverage.test.ts` → pass.

### Task 2: Resource contracts and the safe Markdown renderer

**Files:**
- Create: `src/contracts/resources.ts`, `src/contracts/__tests__/resources.test.ts`
- Create: `src/lib/markdown/SafeMarkdown.tsx`, `src/lib/markdown/parse.ts`, `src/lib/markdown/__tests__/parse.test.ts`, `src/lib/markdown/__tests__/SafeMarkdown.test.tsx`

**Interfaces:**
- Produces (`src/contracts/resources.ts`):
  - `ResourceType = z.enum(["guide","external","template"])`, `ResourceCategory = z.enum(["career","applications","hackathons","academics","funding","campus_life"])`, `RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string>`
  - `SafeMarkdownBody` (string ≤50,000, refined: `findUnsafeMarkdown(body) === null`)
  - `ResourceFields` (strict object: `slug`, `resource_type`, `title`, `summary`, `body_markdown?: string|null`, `external_url?: https URL|null`, `category`, `audience`, `author_name`, `author_url?: https URL|null`, `source_note?: string|null`)
  - `ResourceCreateBody = ResourceFields.superRefine(shapeRules)`; `ResourceMutationBody` = discriminated union on `action`: `{action:"edit", expected_updated_at, data: ResourceFields.partial()}` | `{action:"publish"|"archive", expected_updated_at}`
  - `ResourceSlugParams = z.object({ slug: slug regex })`, `ResourceListQuery = z.object({ category: ResourceCategory.optional(), limit: z.coerce.number().int().min(1).max(50).default(24) })`, `ResourceAdminQuery = z.object({ status: z.enum(["draft","published","archived"]).optional(), limit: …max(100).default(50) })`
  - types `PublicResource` (the public column list from Task 1 minus `status`/`deleted_at`), `ResourceAdminRecord` (full row)
- Produces (`src/lib/markdown/parse.ts`): `type MdBlock`, `type MdInline`, `parseMarkdown(src: string): MdBlock[]`, `findUnsafeMarkdown(src: string): string | null` (returns a reason), `isSafeHref(href: string): boolean`
- Produces (`SafeMarkdown.tsx`): `export function SafeMarkdown({ source }: { source: string }): JSX.Element` (no `"use client"`; pure server-renderable)

- [ ] **Step 1: Failing tests** — `parse.test.ts`:

```ts
import { parseMarkdown, findUnsafeMarkdown, isSafeHref } from "../parse";
describe("safe markdown", () => {
  it("parses headings, paragraphs and lists", () => {
    expect(parseMarkdown("# Title\n\nHello **world**\n\n- a\n- b")).toEqual([
      { type: "heading", level: 1, children: [{ type: "text", value: "Title" }] },
      { type: "paragraph", children: [{ type: "text", value: "Hello " }, { type: "strong", children: [{ type: "text", value: "world" }] }] },
      { type: "list", ordered: false, items: [[{ type: "text", value: "a" }], [{ type: "text", value: "b" }]] },
    ]);
  });
  it("keeps only http(s)/mailto links", () => {
    expect(isSafeHref("https://example.org")).toBe(true);
    expect(isSafeHref("mailto:a@b.co")).toBe(true);
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:x", "data:text/html,x", "vbscript:x", "//evil.test", "/relative"]) expect(isSafeHref(bad)).toBe(false);
    expect(parseMarkdown("[x](javascript:alert(1))")[0]).toEqual({ type: "paragraph", children: [{ type: "text", value: "[x](javascript:alert(1))" }] });
  });
  it("rejects raw HTML and unsafe links at validation", () => {
    expect(findUnsafeMarkdown("<script>alert(1)</script>")).toMatch(/HTML/);
    expect(findUnsafeMarkdown("<img src=x onerror=alert(1)>")).toMatch(/HTML/);
    expect(findUnsafeMarkdown("[x](data:text/html;base64,AAA)")).toMatch(/link/);
    expect(findUnsafeMarkdown("Plain 3 < 5 and a [link](https://ok.test)")).toBeNull();
  });
});
```

`SafeMarkdown.test.tsx` (jsdom): render `<SafeMarkdown source={"<b>x</b> [a](https://a.test)"} />`; expect `container.querySelector("b")` to be null, the literal text `<b>x</b>` present, the anchor to have `rel="noopener noreferrer nofollow"` and `target="_blank"`.

- [ ] **Step 2: Run** `npx jest src/lib/markdown` → FAIL (module not found).
- [ ] **Step 3: Implement `parse.ts`.** Block grammar (line-based): fenced code (```` ``` ````…```` ``` ````, literal content), `#`/`##`/`###` headings, `>` blockquote (single paragraph of inlines), `-`/`*` unordered and `1.` ordered list items (one line each), blank-line-separated paragraphs (soft line breaks join with a space). Inline grammar scanned left-to-right: `` `code` `` → `{type:"code"}`, `**x**` → strong, `*x*`/`_x_` → em, `[text](href)` → `{type:"link", href, children}` only when `isSafeHref(href)`; otherwise the whole source slice stays text. `isSafeHref`: `/^(https?:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/i`. `findUnsafeMarkdown`: return `"Raw HTML is not allowed"` if `/<\/?[a-z][^>]*>/i` matches, `"Only https, http and mailto links are allowed"` if any `\]\(([^)\s]+)\)` target fails `isSafeHref`, else `null`.
- [ ] **Step 4: Implement `SafeMarkdown.tsx`.** Map blocks to `h2`/`h3`/`h4` (level+1, the page owns `h1`), `p`, `ul`/`ol`/`li`, `blockquote`, `pre><code`; inlines to `strong`, `em`, `code`, `a`. Classes: wrap in `<div className="prose prose-neutral dark:prose-invert max-w-none">`. Never use `dangerouslySetInnerHTML`.
- [ ] **Step 5: Contracts + tests.** `resources.test.ts` covers: guide without body rejected; external without https URL rejected (`http://` rejected, `javascript:` rejected); template with `external_url` rejected; body with `<iframe>` rejected; `ResourceFields` rejects unknown key `status` (strict); slug regex; `ResourceMutationBody` edit with `data.status` rejected. `shapeRules`: guide ⇒ non-empty body and no URL; external ⇒ URL; template ⇒ no URL.
- [ ] **Step 6: Run** `npx jest src/lib/markdown src/contracts/__tests__/resources.test.ts` → PASS.

### Task 3: Resource services and API routes

**Files:**
- Create: `src/server/resources/service.ts`, `src/server/resources/admin.ts`
- Create: `src/app/api/resources/route.ts`, `src/app/api/resources/[slug]/route.ts`, `src/app/api/resources/[slug]/open/route.ts`
- Create: `src/app/api/admin/resources/route.ts`, `src/app/api/admin/resources/[id]/route.ts`, `src/app/api/admin/resources/[id]/file/route.ts`
- Create: `src/__tests__/api/resources.test.ts`
- Modify: route checklist files (Global Constraints), `src/server/db/elevated/REGISTRY.md`

**Interfaces:**
- Consumes: Task 1 tables/RPC; Task 2 contracts; `adminContext`, `mutationError` from `src/server/opportunities/admin.ts`; `getDiscoveryAccess` from `@/lib/features`; `createRequestContext` from `@/server/context`.
- Produces (`service.ts`):
  - `listResources(ctx: RequestContext, q: { category?: ResourceCategory; limit: number }): Promise<PublicResource[]>` — cookie client, `.from("resources").select(PUBLIC_RESOURCE_COLUMNS).eq("status","published").is("deleted_at",null).order("reviewed_at",{ascending:false}).order("id").limit(q.limit)`
  - `resourceBySlug(ctx, slug: string): Promise<PublicResource | null>`
  - `resourceOpenTarget(ctx, slug): Promise<{ action: "outbound"|"download"; url: string } | null>` — reads the published row with the cookie client; for `external` returns `external_url`; for `template` uses the elevated client to fetch `file_path` (not publicly granted) and `storage.from("resource-files").createSignedUrl(path, 60, { download: file_name })`; records `resource_actions` via the elevated client (a failed insert is logged, never blocks the redirect); `guide` → `null`
  - `PUBLIC_RESOURCE_COLUMNS` string constant
- Produces (`admin.ts`): `adminResource(id: string): Promise<ResourceAdminRecord | null>`, `listAdminResources(q): Promise<ResourceAdminRecord[]>`, `uploadResourceFile(id: string, file: File): Promise<{ file_path: string; file_name: string; file_size: number }>` (path `${id}/${slugifiedBase}.${ext}`, `upsert: true`)
- Routes:
  - `GET /api/resources` (`action: "load resources"`) → `{ items: PublicResource[] }`; discovery gate
  - `GET /api/resources/[slug]` (`"load resource"`) → `{ item }` or 404; discovery gate
  - `GET /api/resources/[slug]/open` (`"open resource"`) → `NextResponse.redirect(url, 302)` or 404; discovery gate
  - `GET|POST /api/admin/resources` (`"load resources for editing"`, `"create resource"`) → `{ items }` / 201 `{ item }`
  - `GET|PATCH /api/admin/resources/[id]` (`"load resource for editing"`, `"update resource"`)
  - `POST /api/admin/resources/[id]/file` (`"upload resource file"`) — `parseForm` with a file rule: max 10 MB; allowed extensions pdf/docx/xlsx/pptx; content sniff: PDF must start `%PDF-`, OOXML must start `PK\x03\x04`; then `curate_resource(... 'edit', { file_path, file_name, file_size }, expected_updated_at from a form field)`.

- [ ] **Step 1: Failing route tests** in `resources.test.ts` (mock `@/server/context`, `@/server/db/elevated`, `@/lib/supabase/server` as in `m2-route-boundaries.test.ts`):
  - discovery switch off → `GET /api/resources` 404 with `private, no-store`, no DB call;
  - switch on → 200 and the query filters `status=published`;
  - `open` for an `external` resource → 302 to its URL and one `resource_actions` insert with `action: "outbound"`; insert failure still 302;
  - `open` for a `guide` → 404;
  - admin `POST` as student → 403 before any DB call; as admin with `<script>` body → 400 before any DB call;
  - `PATCH` mapping: RPC error `40001` → 409, `22023` → 400, `P0002` → 404;
  - file upload: a `.pdf` whose bytes start `PK` → 400; 11 MB → 400 (use `parseForm` limits).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** services and routes following `src/app/api/admin/opportunities/[id]/route.ts` and `src/app/api/opportunities/[id]/route.ts` as templates.
- [ ] **Step 4: Registries** — full new-route checklist; REGISTRY.md rows: public `open` (signed URL + action insert; published check done with cookie client first), admin resources (bounded reads, RPC, storage upload).
- [ ] **Step 5: Run** `npx jest src/__tests__ src/contracts && node scripts/check-contracts.mjs && node scripts/check-contracts.mjs --client && node scripts/check-server-console.mjs && node scripts/check-elevated-ratchet.mjs` → PASS.

### Task 4: Resource pages and the admin editor

**Files:**
- Create: `src/app/resources/page.tsx`, `src/app/resources/[slug]/page.tsx`, `src/components/resources/ResourceCard.tsx`
- Create: `src/app/moderation/resources/page.tsx`, `src/components/moderation/ResourceEditor.tsx`, `src/components/moderation/__tests__/resource-editor.test.tsx`
- Modify: `src/app/moderation/ModerationNav.tsx` (add "Resources" → `/moderation/resources`), page checklist files

**Interfaces:**
- Consumes: Task 3 services/APIs; `SafeMarkdown`.
- Produces: `ResourceCard({ resource }: { resource: PublicResource })` (server-renderable, no client hooks) used by Task 5.

- [ ] **Step 1: Failing editor test** (jsdom): renders with mocked `fetch`; choosing type `template` hides the external URL field and shows the file input; typing `<b>` into the body shows the validation message from `findUnsafeMarkdown` and disables Save; the preview pane renders `SafeMarkdown`.
- [ ] **Step 2: Implement public pages.** `/resources`: `requireDiscoveryPage()`, `listResources` with optional `?category=` (validated through `ResourceListQuery` via `parseWith`, invalid → ignore filter), category chips as links, grid of `ResourceCard` (title, summary, category label, author, "Updated {date}" from `reviewed_at` formatted in America/Toronto). Empty state: "Guides and templates are on the way." (no invented items). `/resources/[slug]`: `notFound()` for invalid slug or missing; `generateMetadata` with `title`, `description: summary`, `alternates.canonical`, `openGraph { type: "article", title, description, url }`; body via `SafeMarkdown` for guides; action button to `/api/resources/{slug}/open` labelled "Open resource" (external) or "Download template (PDF, 120 KB)" (template, from `file_name`/`file_size`); attribution block (author name, optional link, `source_note`). Mobile: single column, 16px gutters, no horizontal scroll.
- [ ] **Step 3: Implement admin page/editor** following `OpportunityEditor.tsx` structure: list (status filter), form, preview, `persist(action)` using `ResourceCreateBody.safeParse` / `PATCH { action, expected_updated_at, data }`, file upload after the draft exists, `?id=` query param preselects a resource (used by Task 11). `moderation/resources/page.tsx` uses the same guard as `moderation/opportunities/page.tsx`.
- [ ] **Step 4: Run** `npx jest src/components/moderation`, `npx tsc --noEmit`, `npm run lint` → PASS.
- [ ] **Step 5: Package gate + commit.**

```bash
npm run test:ci -- --runInBand   # progress note before/after
supabase test db --local
npx tsc --noEmit && npm run lint
git add supabase/migrations/20260929120000_m3_resources.sql supabase/tests/database/130-resources.test.sql supabase/tests/database/100-public-table-rls-matrix.test.sql scripts/check-rls-coverage.mjs src/lib/supabase/types.ts src/contracts/resources.ts src/contracts/__tests__/resources.test.ts src/lib/markdown src/server/resources src/app/api/resources src/app/api/admin/resources src/app/resources src/app/moderation/resources src/app/moderation/ModerationNav.tsx src/components/resources src/components/moderation/ResourceEditor.tsx src/components/moderation/__tests__/resource-editor.test.tsx src/__tests__ src/server/db/elevated/REGISTRY.md .planning/audit e2e/helpers
git commit -m "feat(m3): authored resource library with safe Markdown (P1-08)"
```

---

## Package P1-06 — Homepage, details, founder story (Tasks 5–7, one commit)

### Task 5: Switch-aware homepage and editorial sections

**Files:**
- Create: `src/components/home/LegacyHome.tsx` (verbatim move of current `src/app/page.tsx` body, keeps `"use client"`)
- Modify: `src/app/page.tsx` (becomes a server component)
- Create: `src/server/home/sections.ts`, `src/server/home/__tests__/sections.test.ts`
- Create: `src/components/home/EditorialHome.tsx`, `src/__tests__/app/home-switch.test.tsx`

**Interfaces:**
- Consumes: `discover()` and `publicDetail()` from `src/server/discovery/service.ts`; `listResources` (Task 3); `discoverySurface` from `@/server/discoveryAccess`; `ListingCard`; `ResourceCard`.
- Produces:
  - `type Section<T> = { status: "ok"; items: T[] } | { status: "error" }`
  - `homeSections(ctx: RequestContext): Promise<{ thisWeek: Section<DiscoveryItem>; picks: Section<DiscoveryItem>; resources: Section<PublicResource> }>` — `thisWeek` = `discover(ctx, { window: "this_week", limit: 6, q: "" })` items; `picks` = cookie-client read of `discovery_public` where `is_pick = true`, `canonical_id` null, `published_at <= now`, `expires_at > now`, ordered `editorial_priority desc, actionable_at asc`, limit 4, each row given `closed: false`; `resources` = `listResources(ctx, { limit: 3 })`. Each section is computed independently; a thrown error is logged with `log.error("home section failed", { section })` and becomes `{ status: "error" }`.
  - `EditorialHome()` async server component.

- [ ] **Step 1: Failing tests.** `home-switch.test.tsx` (node project is fine if rendering via `renderToString`; otherwise jsdom): mock `@/server/discoveryAccess` → `{ enabled: false }` ⇒ `HomePage()` returns an element whose type is `LegacyHome`; `{ enabled: true }` ⇒ `EditorialHome`. `sections.test.ts`: `discover` throws ⇒ `thisWeek.status === "error"` while `picks`/`resources` still `ok`; picks query filters `is_pick` and `canonical_id is null`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** `src/app/page.tsx`:

```tsx
import { discoverySurface } from "@/server/discoveryAccess";
import { LegacyHome } from "@/components/home/LegacyHome";
import { EditorialHome } from "@/components/home/EditorialHome";

export default async function HomePage() {
  const surface = await discoverySurface();
  return surface.enabled ? <EditorialHome /> : <LegacyHome />;
}
```

`LegacyHome.tsx` exports `LegacyHome` (the old default export renamed, including its inner `Suspense` wrapper). `EditorialHome` sections, in order, omitting any whose `items` is empty (an `error` section renders a one-line "This section couldn't load. Browse all opportunities." with a link, never a fake list):
  1. Hero: `h1` "Opportunities for Montréal students", one sentence ("Events, hackathons, jobs and programs across campuses, checked before they're listed."), primary link "Browse opportunities" → `/discover`, secondary "This week" → `/discover?window=this_week`. No sign-up prompt.
  2. "This week" — `ListingCard` grid (no `onSave`), footer link to `/discover?window=this_week`. If `ok` and empty: "Nothing checked for this week yet." + link to `/discover`.
  3. "Ady's Picks" — only when non-empty; shows `pick_reason`.
  4. "Browse by type" — links for each `ListingType` using `listingLabels` from `src/components/discovery/presentation.ts` → `/discover?type=<type>`.
  5. "Resources" — `ResourceCard` × ≤3 + link `/resources`; omitted when empty.
  6. Two CTA tiles: "Hiring? Tell us about a role" → `/for-companies`; "Know an opportunity? Submit it" → `/submit`.
  No Weekly Drop signup, no Talent/apply mention (their milestones are not delivered).
- [ ] **Step 4: Run** tests + `npx tsc --noEmit` → PASS.

### Task 6: Shared listing facts, event detail, provenance and image fallback

**Files:**
- Create: `src/components/discovery/ListingFacts.tsx`, `src/components/discovery/__tests__/listing-facts.test.tsx`
- Modify: `src/components/discovery/presentation.ts` (+ `provenanceLabel`), `src/components/discovery/OpportunityDetail.tsx` (use `ListingFacts`)
- Modify: `src/app/events/[id]/page.tsx`, `src/app/events/[id]/EventDetailClient.tsx`, `src/components/events/EventDetailView.tsx`
- Create: `src/components/ui/FallbackImage.tsx`, `src/components/ui/__tests__/fallback-image.test.tsx`
- Modify: `src/components/events/EventCard.tsx`, `src/components/events/DiscoveryCard.tsx`, `src/app/moderation/pending/page.tsx` (image usages → `FallbackImage`)

**Interfaces:**
- Produces:
  - `provenanceLabel(source_type: "manual"|"indexed"|"partner"): string` → `"Added by the Uni-Verse team" | "Automatically indexed" | "Submitted by the organizer"`
  - `ListingFacts({ item }: { item: DiscoveryItem })` — renders a `<dl>`: When (occurrence via `actionDate`), Deadline (date-only shows the date plus "(end of day, {tz})"; `timezone_assumed` adds "Time zone assumed: America/Toronto"), Eligibility (`eligibility_text` or "Check eligibility with organizer"), Relevance (cross-campus / named universities / "Not specified"), Location & work mode, Source (`provenanceLabel` + source link if `source_url`), Last checked (`checked_at` date or "Not yet checked"), Pick reason when `is_pick`.
  - `FallbackImage(props: ImageProps & { fallbackSrc?: string })` (`"use client"`; on `onError` swaps to `fallbackSrc ?? "/placeholder-event.png"` once; empty `src` renders the fallback).
  - `EventDetailClient` gains optional prop `discovery?: DiscoveryItem | null`, passed to `EventDetailView` as `discovery`.

- [ ] **Step 1: Failing tests.** `listing-facts.test.tsx`: null eligibility renders "Check eligibility with organizer"; `source_type: "indexed"` renders "Automatically indexed" and the document never contains "Verified"; date-only deadline renders the assumed-timezone note. `fallback-image.test.tsx`: mock `next/image` to a plain `img` passthrough; `fireEvent.error(img)` ⇒ `src` ends with `/placeholder-event.png`; a second error does not loop.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Event page: when `(await discoverySurface()).enabled`, load `publicDetail(ctx, "event", id)` (existing canonical redirect stays first) and pass it down. In `EventDetailView`, when `discovery` is present: render `ListingFacts` above the description; if `discovery.closed`, render "This event has ended" and hide the RSVP/registration buttons; if `rsvp_link` exists, the primary CTA is "Register on organizer site" (external, `rel="noopener noreferrer"`), native RSVP stays secondary. With `discovery` absent (switch off), rendering is unchanged. `OpportunityDetail` replaces its inline facts with `ListingFacts` and its "Indexed from a public source" text with `provenanceLabel`.
- [ ] **Step 4: Run** `npx jest src/components src/app/events` + `npx tsc --noEmit` → PASS.

### Task 7: Navigation, About, landing cutover, metadata and sitemap

**Files:**
- Modify: `src/components/layout/productNavigation.ts`, `src/components/layout/EditorialShell.tsx`
- Create: `src/content/founder.ts`, `src/components/about/EditorialAbout.tsx`
- Modify: `src/app/about/page.tsx` (switch-aware), `src/app/landing/page.tsx` → move client body to `src/components/landing/LandingClient.tsx`; new server `page.tsx` redirects to `/` when `getFeatureFlags().discovery_ui`
- Modify: `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/opportunities/[id]/page.tsx` (openGraph/twitter)
- Create: `src/__tests__/app/sitemap.test.ts`, `src/components/layout/__tests__/product-navigation.test.ts`

**Interfaces:**
- Produces: `productNavigation` entries `Discover /discover`, `Resources /resources`, `For companies /for-companies`, `Clubs /clubs`, `About /about` (public), `Saved`, `Profile` (account); new export `secondaryAction = { label: "Submit", href: "/submit" }` rendered as an outlined button in `EditorialShell` (desktop and mobile).
- Produces: `FOUNDER_STORY: { heading: string; paragraphs: string[]; link?: { label: string; href: string } } | null = null` in `src/content/founder.ts` with a comment that only owner-supplied factual copy goes here.

- [ ] **Step 1: Failing tests.** `sitemap.test.ts`: with `FEATURE_DISCOVERY_UI` unset the sitemap has no `/discover`/`/resources` entries and keeps `/landing`; with `"true"` it includes `/discover`, `/resources`, `/submit`, `/for-companies`, published opportunity URLs and published resource URLs (mock the client), and excludes `/landing`; `FEATURE_DISCOVERY_ADMIN_PREVIEW="true"` alone adds nothing. `product-navigation.test.ts`: every public href is one of the delivered routes; no `/weekly`, `/talent`, `/recruiting`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Sitemap reads opportunities with the same client the existing sitemap uses for events (a value import of `@supabase/supabase-js` outside `src/lib/supabase/` and `src/server/db/elevated/` fails the elevated ratchet) selecting `id, updated_at` via `discovery_public` (`kind='opportunity'`, `canonical_id is null`), limit 500; resources `slug, reviewed_at` limit 500. `robots.ts` adds `/saved` to `disallow` (`/submit` stays indexable). Opportunity metadata adds `openGraph: { type: "article", title, description, url }` and `twitter: { card: "summary", title, description }`. `EditorialAbout`: factual product description written from this plan's product rules (what Uni-Verse lists, that listings are checked before publication, provenance labels, no paid placement, submissions reviewed by a person, contact route `/submit`), plus a founder section rendered only when `FOUNDER_STORY` is non-null. `/about` renders `EditorialAbout` when `discoverySurface().enabled`, else the existing legacy page body (move it to `src/components/about/LegacyAbout.tsx`).
- [ ] **Step 4: Run** tests, `npx tsc --noEmit`, `npm run lint` → PASS.
- [ ] **Step 5: Package gate + commit** (same gate commands as Task 4 Step 5; stage the Task 5–7 paths explicitly):

```bash
git commit -m "feat(m3): editorial homepage, listing facts and discovery metadata (P1-06)"
```

---

## Package P1-09 — Submissions, reports, company intake (Tasks 8–11, one commit)

### Task 8: Intake schema, RPCs and database tests

**Files:**
- Create: `supabase/migrations/20260929130000_m3_submissions_reports.sql`, `supabase/tests/database/140-intake.test.sql`
- Modify: RLS matrix, coverage count/test, `scripts/check-rls-coverage.mjs`, `src/lib/supabase/types.ts`

**Interfaces:**
- Produces tables `public.submissions`, `public.listing_reports`; RPCs (service_role only):
  - `intake_submission(p_kind text, p_title text, p_organization text, p_source_url text, p_details jsonb, p_contact_name text, p_contact_email text, p_user uuid, p_client_hash text) RETURNS void` — quota errors raise SQLSTATE `UV429`
  - `intake_listing_report(p_kind text, p_id uuid, p_reason text, p_details text, p_user uuid, p_client_hash text) RETURNS void` — invisible target raises `P0002`; quota `UV429`
  - `review_submission(p_actor uuid, p_id uuid, p_action text, p_reason text, p_expected timestamptz) RETURNS jsonb` → `{ submission: <row minus contact fields>, target: { kind: "opportunity"|"resource", id } | null }`
  - `resolve_listing_report(p_actor uuid, p_id uuid, p_action text, p_note text) RETURNS jsonb`

- [ ] **Step 1: Migration.**

```sql
-- M3 P1-09: public intake. No client insert grants; the server calls service-role RPCs.
CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('event','hackathon','job','program','resource','company_request')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  organization text NOT NULL CHECK (length(trim(organization)) BETWEEN 1 AND 200),
  source_url text CHECK (source_url ~* '^https?://' AND length(source_url) <= 2048),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object' AND pg_column_size(details) <= 16384),
  contact_name text CHECK (length(contact_name) <= 120),
  contact_email text CHECK (contact_email IS NULL OR (length(contact_email) <= 254 AND contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  submitter_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  client_hash text NOT NULL CHECK (client_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','converted','rejected','spam')),
  review_reason text CHECK (length(review_reason) <= 1000),
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  target_opportunity_id uuid UNIQUE REFERENCES public.opportunities(id) ON DELETE SET NULL,
  target_resource_id uuid UNIQUE REFERENCES public.resources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(target_opportunity_id, target_resource_id) <= 1),
  CHECK (kind <> 'company_request' OR contact_email IS NOT NULL),
  CHECK (status = 'pending' OR reviewed_at IS NOT NULL)
);
CREATE INDEX submissions_queue ON public.submissions (status, created_at DESC);
CREATE INDEX submissions_client_recent ON public.submissions (client_hash, created_at DESC);
CREATE INDEX submissions_user_recent ON public.submissions (submitter_user_id, created_at DESC);
CREATE INDEX submissions_reviewed_by ON public.submissions (reviewed_by);

CREATE TABLE public.listing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  resource_id uuid REFERENCES public.resources(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('wrong_date','dead_link','scam','duplicate','other')),
  details text CHECK (length(details) <= 1000),
  reporter_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  client_hash text NOT NULL CHECK (client_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolution_note text CHECK (length(resolution_note) <= 1000),
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(event_id, opportunity_id, resource_id) = 1)
);
CREATE INDEX listing_reports_queue ON public.listing_reports (status, created_at DESC);
CREATE INDEX listing_reports_event ON public.listing_reports (event_id);
CREATE INDEX listing_reports_opportunity ON public.listing_reports (opportunity_id);
CREATE INDEX listing_reports_resource ON public.listing_reports (resource_id);
CREATE INDEX listing_reports_client_recent ON public.listing_reports (client_hash, created_at DESC);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.submissions, public.listing_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.submissions, public.listing_reports TO authenticated;
GRANT ALL ON public.submissions, public.listing_reports TO service_role;
CREATE POLICY submissions_admin_read ON public.submissions FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY listing_reports_admin_read ON public.listing_reports FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
```

  Then the four functions (all `LANGUAGE plpgsql SET search_path = ''`, REVOKE from PUBLIC/anon/authenticated, GRANT EXECUTE to service_role):
  - `intake_submission`: `PERFORM pg_advisory_xact_lock(hashtextextended('intake:' || p_client_hash, 0));` raise `UV429` when ≥5 rows share `client_hash` in the last hour, or `p_user` is not null and ≥20 rows share `submitter_user_id` in the last 24 h. Insert with `status` defaulted (the function has no status parameter). A `p_user` that is banned (`public.users.banned_at IS NOT NULL AND (ban_expires_at IS NULL OR ban_expires_at > now())`) raises `42501`.
  - `intake_listing_report`: target visibility — `event`: `status='approved' AND deleted_at IS NULL`; `opportunity`: visible in `public.discovery_public`; `resource`: `status='published' AND deleted_at IS NULL`; else raise `P0002`. Same advisory lock; ≥10 reports per `client_hash` per hour → `UV429`; an `open` report with the same `client_hash`, target and reason in the last 24 h makes the call a no-op.
  - `review_submission`: `PERFORM public.discovery_require_editor(p_actor)`; `SELECT … FOR UPDATE`; P0002 if missing; `40001` if `updated_at IS DISTINCT FROM p_expected` — **except** when `p_action='convert'` and the row is already `converted` (idempotent retry: return the existing target without writing). Non-`pending` rows otherwise raise `22023`. `reject`/`spam` require `p_reason` non-empty for `reject`. `convert`:
    - `resource` kind: requires `source_url ~* '^https://'` (else `22023`); inserts a `resources` draft (`resource_type 'external'`, `external_url = source_url`, `summary = left(coalesce(details->>'description', title), 500)`, `category = coalesce(details->>'category','career')`, `audience = coalesce(details->>'audience','Students')`, `author_name = organization`, `source_note = 'Suggested through public submission'`).
    - other kinds: inserts an `opportunities` draft: `listing_type` = kind (`company_request` → `'job'`), `slug` = `left(trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')), 100) || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6)`, `title`, `organization`, `description` = `concat_ws(E'\n\n', details->>'description', details->>'duties', 'Must have: ' || (details->>'must_have_skills'), 'Nice to have: ' || (details->>'nice_to_have_skills'), details->>'why_worth_it')` falling back to `title`, `location = coalesce(details->>'location','')`, `work_mode = coalesce(details->>'work_mode','in_person')`, `source_type = CASE kind WHEN 'company_request' THEN 'partner' ELSE 'manual' END`, `source_url`, `action_url = source_url`, `application_mode 'external'`, `status 'draft'`, `created_by/updated_by = p_actor`. `checked_at` stays NULL so publication requires an editor check. `contact_name`/`contact_email` are never copied.
    - Sets `status`, `reviewed_by`, `reviewed_at`, `review_reason`, target FK, `updated_at = clock_timestamp()`; audit `submission_<action>` with metadata `{kind, target_kind, target_id}` only.
  - `resolve_listing_report`: editor check; `open` → `resolved|dismissed`; other states → `22023`; audit `listing_report_<action>`.
- [ ] **Step 2: `140-intake.test.sql`** (namespace `…0000140xx`). One line each:
  - anon/authenticated `INSERT INTO public.submissions …` → `42501`; anon `SELECT … FROM public.submissions` → `42501`; student count 0; admin count ≥1.
  - anon/admin-cookie `SELECT public.intake_submission(...)` → `42501`.
  - service_role: 5 intakes with one hash succeed, the 6th → `UV429`; a different hash succeeds.
  - intake row `status` is `pending` (no parameter can set it).
  - report on a draft opportunity → `P0002`; on an approved event succeeds; a duplicate open report adds no row.
  - convert job submission → exactly one new `opportunities` row with `status='draft'`, `checked_at IS NULL`; retry convert with stale `p_expected` returns the same target id and opportunity count is unchanged.
  - convert `company_request` → new opportunity `description` does not contain the contact email (`position(contact_email in description) = 0`), `source_type='partner'`; count of `users` rows whose `roles` changed is 0 (compare a snapshot `array_agg` before/after).
  - reject a converted submission → `22023`; review by a non-admin actor → `42501`.
- [ ] **Step 3:** reset, regenerate types, RLS matrix (both tables: anon deny via `throws_ok … 42501`, subject deny 0, outsider deny 0, admin allow ≥1), bump counts (38 → 40), privilegedFunctional add `140-intake`. Run `supabase test db --local` and `node scripts/check-rls-coverage.mjs` → PASS.

### Task 9: Intake contracts, client hash, rate budget and public intake routes

**Files:**
- Create: `src/contracts/intake.ts`, `src/contracts/__tests__/intake.test.ts`
- Create: `src/server/intake/clientHash.ts`, `src/server/intake/__tests__/clientHash.test.ts`, `src/server/intake/service.ts`
- Modify: `src/server/ratelimit/policy.ts` (+ tests in its existing test file)
- Create: `src/app/api/submissions/route.ts`, `src/app/api/company-requests/route.ts`, `src/app/api/listing-reports/route.ts`, `src/__tests__/api/intake.test.ts`
- Modify: `.env.local.example` (add `INTAKE_HASH_SECRET=` name only — edit the example file with a text tool; do not read `.env.local`)

**Interfaces:**
- Produces (`intake.ts`):
  - `Honeypot = z.string().max(200).optional()` field name `website`
  - `SubmissionBody` = discriminated union on `kind` (`event|hackathon|job|program|resource`), common fields `title` (1–200), `organization` (1–200), `source_url` (SafeHttpUrl, required), `description` (1–2000, no raw HTML via `findUnsafeMarkdown`), `contact_name?` (≤120), `contact_email?` (email ≤254), `website?`; per kind: `event|hackathon` + `starts_on?` (ISO date), `location?` (≤200); `job|program` + `deadline_on?` (ISO date), `location?`, `work_mode?` (`WorkMode`); `resource` + `category?` (`ResourceCategory`), `audience?` (≤200). Strict objects (unknown keys such as `status`, `is_pick` → 400).
  - `CompanyRequestBody` strict: `company_name`, `company_context` (≤1000), `role_title`, `duties` (≤3000), `must_have_skills` (≤1000), `nice_to_have_skills?`, `hours` (≤120), `compensation` (≤200), `location` (≤200), `work_mode` (`WorkMode`), `start_date` (≤60), `employment_type` (`z.enum(["internship","part_time","full_time","contract"])`), `why_worth_it` (≤1000), `source_url?`, `contact_name` (1–120), `contact_email` (required), `website?`
  - `ListingReportBody` strict: `kind` (`event|opportunity|resource`), `id` (UUID), `reason` (`wrong_date|dead_link|scam|duplicate|other`), `details?` (≤1000), `website?`
  - `toIntakeDetails(body): Record<string, string>` — the per-kind extra fields, trimmed, omitting empties
- Produces (`clientHash.ts`): `clientHash(request: NextRequest): string` = hex HMAC-SHA256 of `clientIp(request)` (import from `@/server/ratelimit/policy`) keyed by `process.env.INTAKE_HASH_SECRET`, or the constant `"uni-verse-local-intake-salt"` when unset (log `log.warn("intake hash secret not configured")` once per process when `NODE_ENV === "production"`).
- Produces (`service.ts`): `submitIntake(input: { kind; title; organization; source_url; details; contact_name; contact_email; user_id: string|null; client_hash: string }): Promise<"ok"|"quota">`, `reportListing(input): Promise<"ok"|"quota"|"not_found">` — elevated RPC calls; `UV429` → `"quota"`, `P0002` → `"not_found"`, other errors rethrown.
- Routes: all three `POST`, `cache: "private"`, discovery gate first; `website` non-empty ⇒ `202 { received: true }` with no DB call; user id attached only when `requireActiveUser(ctx)` succeeds (anonymous allowed); success `202 { received: true }`; quota `429 { error: "Too many submissions. Try again later." }`; report `not_found` ⇒ 404. Actions: `"submit listing"`, `"submit hiring request"`, `"report listing"`. Company requests call `submitIntake` with `kind: "company_request"`, `title = role_title`, `organization = company_name`, details from the remaining fields.
- Rate limit: `INTAKE_POST_PREFIXES = ["/api/submissions","/api/company-requests","/api/listing-reports"]`, `INTAKE_BUDGET = 5` per minute per IP for POST.

- [ ] **Step 1: Failing tests.** Contracts: `status: "published"` extra key → invalid; `source_url: "javascript:alert(1)"` → invalid; 2001-char description → invalid; `<script>` in description → invalid; company request without `contact_email` → invalid. `clientHash`: same IP ⇒ same 64-hex value; value ≠ the IP; different secret ⇒ different hash. Routes: switch off ⇒ 404 no DB; honeypot ⇒ 202 no RPC; valid anonymous ⇒ RPC called with `p_user: null`; `UV429` ⇒ 429 private; RPC called with no status/pick argument; response body never echoes `contact_email`. Policy: 6th POST to `/api/submissions` within a minute ⇒ 429.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4:** new-route checklist; REGISTRY rows ("public intake: server-fixed pending status, salted client hash, DB quotas"). **Step 5: Run** `npx jest src/__tests__/api src/contracts src/server` + the static guards → PASS.

### Task 10: Admin review APIs for submissions and reports

**Files:**
- Create: `src/app/api/admin/submissions/route.ts`, `src/app/api/admin/submissions/[id]/route.ts`, `src/app/api/admin/listing-reports/route.ts`, `src/app/api/admin/listing-reports/[id]/route.ts`
- Create: `src/server/intake/admin.ts`, `src/__tests__/api/intake-admin.test.ts`
- Modify: `src/contracts/intake.ts` (+ admin bodies)

**Interfaces:**
- Produces contracts: `SubmissionAdminQuery { status?: "pending"|"converted"|"rejected"|"spam" (default pending), limit ≤100 default 50 }`, `SubmissionReviewBody` = union `{action:"convert", expected_updated_at}` | `{action:"reject", expected_updated_at, reason: 1–1000}` | `{action:"spam", expected_updated_at, reason?}`; `ListingReportAdminQuery { status?: "open"|"resolved"|"dismissed" (default open), limit }`; `ListingReportResolveBody { action: "resolve"|"dismiss", note?: ≤1000 }`.
- Produces (`admin.ts`): `listSubmissions(q)`, `getSubmission(id)` (includes contact fields — admin only), `listListingReports(q)` (joins a display title for the target: event title / opportunity title / resource title).
- Routes: `GET /api/admin/submissions` → `{ items }`; `GET /api/admin/submissions/[id]` → `{ item }`; `PATCH` → `review_submission` → `{ submission, target }`; `GET /api/admin/listing-reports`; `PATCH /api/admin/listing-reports/[id]`. Errors through `mutationError`. Actions: `"load submissions"`, `"load submission"`, `"review submission"`, `"load listing reports"`, `"resolve listing report"`.

- [ ] **Step 1: Failing tests:** student ⇒ 403 before DB; convert retry returns the same `target.id` (mock RPC); `40001` ⇒ 409; list response for `/api/admin/submissions` includes `contact_email` (admin) while none of the public intake responses do.
- [ ] **Step 2–5:** implement, new-route checklist (admin arms), run Jest + guards → PASS.

### Task 11: Submit, For Companies, report button and the moderation queue

**Files:**
- Create: `src/app/submit/page.tsx`, `src/components/intake/SubmitForm.tsx`, `src/app/for-companies/page.tsx`, `src/components/intake/CompanyRequestForm.tsx`, `src/components/intake/ReportListingButton.tsx`, `src/components/intake/__tests__/intake-forms.test.tsx`
- Create: `src/app/moderation/submissions/page.tsx`, `src/components/moderation/SubmissionQueue.tsx`
- Modify: `OpportunityDetail.tsx`, `EventDetailView.tsx` (discovery present), `src/app/resources/[slug]/page.tsx` (add `ReportListingButton`); `ModerationNav.tsx` (+ "Submissions"); `OpportunityEditor.tsx` (`?id=` preselect if not already supported)

- [ ] **Step 1: Failing form tests** (jsdom, mocked fetch): the honeypot input has `tabIndex={-1}`, `autoComplete="off"`, is visually hidden and `aria-hidden`; submit posts to `/api/submissions` with the typed body; on 202 the form is replaced with "Thanks — a person reviews every submission before anything is published." and shows no ID; on 429 shows the rate message; on network error shows "Couldn't send. Your text is still here." and keeps field values; the report dialog is keyboard-operable (Escape closes, focus returns to the trigger).
- [ ] **Step 2: Implement.** `/submit`: type selector (Event, Hackathon, Job or internship, Program, Resource) driving the per-kind fields; labels, `aria-describedby` errors, max lengths mirrored from contracts; a line stating contact details stay private and are used only to ask about this submission. `/for-companies`: short value proposition (Uni-Verse lists roles for Montréal students; every request is reviewed; a request does not create an account, a company page, or applicant access; students apply on your site), then the structured form. `ReportListingButton({ kind, id })`: button "Report a problem" → dialog (reason radio group, optional details) → POST `/api/listing-reports`. Moderation queue: tabs "Submissions" / "Listing reports"; submission detail shows all fields including private contact; actions Convert (then link "Open draft" → `/moderation/opportunities?id=` or `/moderation/resources?id=`), Reject (reason required), Spam; report rows show target title + link, Resolve/Dismiss with note. Both pages gated with `requireDiscoveryPage()` (public) / the moderation layout (admin).
- [ ] **Step 3:** page checklist (inventory + page smoke). **Step 4: Run** Jest, `tsc`, lint → PASS.
- [ ] **Step 5: Package gate + commit:** `git commit -m "feat(m3): public submissions, listing reports and hiring intake (P1-09)"`.

---

## Package P1-07 — Dependable McGill supply (Tasks 12–16, one commit)

### Task 12: Webhook delivery log

**Files:**
- Create: `supabase/migrations/20260929140000_m3_ingestion_deliveries.sql`, `supabase/tests/database/150-ingestion.test.sql`
- Modify: `supabase/functions/_shared/webhook-contract.ts`, `supabase/functions/_shared/webhook-handler.ts`, `supabase/functions/events-webhook/index.ts` (if the handler needs a new dependency), `src/__tests__/webhook/webhook-handler.test.ts`, `src/__tests__/webhook/webhook-contract.test.ts`, `supabase/functions/tests/webhook-handler.test.ts`, `supabase/functions/tests/webhook.test.ts`
- Modify: RLS matrix/counts (40 → 41), privilegedFunctional, types

**Interfaces:**
- Produces table `public.ingestion_deliveries(id uuid pk, producer text NOT NULL CHECK (producer ~ '^[a-z0-9@._-]{1,80}$'), run_id uuid, received_at timestamptz NOT NULL DEFAULT now(), outcome text NOT NULL CHECK (outcome IN ('succeeded','partial','duplicate','failed','rejected','heartbeat')), event_count int NOT NULL CHECK (event_count >= 0), inserted int NOT NULL DEFAULT 0, duplicates int NOT NULL DEFAULT 0, invalid int NOT NULL DEFAULT 0, items_seen int CHECK (items_seen >= 0), error_code text CHECK (error_code ~ '^[a-z0-9_]{1,64}$'))`, index `(received_at DESC)`, admin-read policy, `GRANT SELECT TO authenticated`, service_role ALL. Also: `INSERT INTO storage.buckets (id, name, public) VALUES ('event-images','event-images', true) ON CONFLICT (id) DO NOTHING;` (the bucket already exists in hosted projects; this makes local replay complete).
- Contract: envelope gains optional `run: { id: uuid, producer: /^[a-z0-9@._-]{1,80}$/, status: "ok"|"failed", error_code?: /^[a-z0-9_]{1,64}$/, items_seen?: int ≥ 0 }`. `event_count: 0, events: []` is valid **only** when `run` is present.
- Handler: after a valid signature, always attempt one delivery insert (producer = `run?.producer ?? "unknown"`): invalid envelope/events ⇒ `rejected` (with `invalid` count, no content); `run.status === "failed"` with no events ⇒ `failed` + `error_code`, respond 200 `{ recorded: true }`; empty ok run ⇒ `heartbeat`, 200; all inserted ⇒ `succeeded`; some inserted ⇒ `partial`; none inserted and all duplicates ⇒ `duplicate`; otherwise `failed`. A delivery insert failure logs `webhook.delivery_record_failed` and does not change the response. Unsigned/invalid-signature requests are not recorded. Existing status codes for event batches stay as they are.

- [ ] **Step 1: Failing Jest handler tests:** duplicate-only batch records `outcome: "duplicate"` with `duplicates: n`; failed-run heartbeat returns 200 and records `failed` + `error_code`; empty events without `run` ⇒ 400; invalid signature records nothing; delivery insert throwing still returns the batch's normal status. Mirror the key cases in the Deno offline test.
- [ ] **Step 2: Run** `npx jest src/__tests__/webhook` → FAIL. **Step 3: Implement.** **Step 4:** `150-ingestion.test.sql`: anon read `42501`, student count 0, admin count ≥1, anon insert `42501`, bad `error_code` (`'Bad Code'`) → `23514`. Reset, types, matrix. **Step 5: Run** `npx jest src/__tests__/webhook`, `supabase test db --local`, `npx tsx scripts/test-edge-local.ts` (progress notes; this starts `supabase functions serve`) → PASS.

### Task 13: Freshness in health and the moderation ingestion page

**Files:**
- Modify: `src/contracts/health.ts` (`HealthWebhook`), `src/app/api/health/route.ts` (`checkWebhook`), `src/app/health/page.tsx`, `docs/health.md`, existing health tests
- Create: `src/server/ingestion/summary.ts`, `src/app/api/admin/ingestion/route.ts`, `src/app/moderation/ingestion/page.tsx`, `src/components/moderation/IngestionPanel.tsx`, `src/__tests__/api/ingestion-admin.test.ts`
- Modify: `src/app/moderation/pending/page.tsx` (banner linking to `/moderation/ingestion` when stale pending items exist), `ModerationNav.tsx` (+ "Ingestion")

**Interfaces:**
- Produces: `ingestionSummary(): Promise<{ last_ingest_at: string|null; last_delivery_at: string|null; last_success_at: string|null; last_failure_at: string|null; last_error_code: string|null; pending_review: number; stale_pending: number }>` (elevated; `stale_pending` = pending, non-deleted events with `created_at < now() - 72h` OR `start_date < now()`), `stalePendingEvents(limit = 50)` → `{ id, title, created_at, start_date, source, source_url }[]` ordered oldest first, `recentDeliveries(limit = 20)`.
- `HealthWebhook` becomes the strict object of the summary fields; `checkWebhook()` returns it; it stays informational (does not change overall status). Health page shows each field with `data-testid`s `health-webhook-last-success`, `health-webhook-last-failure`, `health-webhook-stale-pending` (keep `health-webhook-last-ingest`).
- `GET /api/admin/ingestion` (`action: "load ingestion status"`, admin) → `{ summary, deliveries, stale }`.
- `IngestionPanel`: summary cards; a warning when `last_success_at` is null or older than 48 h ("No successful ingestion in the last 48 hours"); deliveries table (time, producer, outcome, counts, error code); stale list with "Review" link to `/moderation/pending` and "Reject as expired" calling the existing `PATCH /api/admin/events/[id]/status` with its existing body shape (read that route's contract first).

- [ ] **Step 1: Failing tests:** health report for an admin contains the new fields (mock elevated client); anonymous still gets only `{ status, version }`; `/api/admin/ingestion` student ⇒ 403 before DB; stale list includes a past-dated pending event.
- [ ] **Step 2–4:** implement; route/page checklists; update `docs/health.md` check table.
- [ ] **Step 5: Run** Jest + guards → PASS.

### Task 14: Safe image persistence

**Files:**
- Create: `src/lib/imageSniff.ts` (+ test), `src/server/ingestion/safeImageFetch.ts`, `src/server/ingestion/__tests__/safeImageFetch.test.ts`, `src/server/ingestion/persistImages.ts`, `src/app/api/admin/ingestion/images/route.ts`
- Modify: `src/server/body.ts` (`checkFileContent` reuses `sniffImageType`), `IngestionPanel.tsx` ("Persist images" button), `src/contracts/ingestion.ts` (new: `PersistImagesBody { limit: 1–10 default 10 }`)

**Interfaces:**
- Produces:
  - `sniffImageType(bytes: Uint8Array): "jpeg"|"png"|"webp"|"gif"|null`
  - `INGEST_IMAGE_HOSTS = [/(^|\.)cdninstagram\.com$/i, /(^|\.)fbcdn\.net$/i]`
  - `isPrivateAddress(ip: string): boolean` — IPv4: 0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.168/16, 198.18/15, 224/4, 240/4; IPv6: `::`, `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, IPv4-mapped `::ffff:a.b.c.d` (check the v4 part), `64:ff9b::/96`
  - `class ImageFetchError extends Error { code: "disallowed_url"|"private_address"|"too_many_redirects"|"http_<status>"|"too_large"|"not_image"|"timeout" }`
  - `fetchIngestImage(url: string, deps?: { lookup?: (host: string) => Promise<string[]>; fetchImpl?: typeof fetch; maxBytes?: number; timeoutMs?: number; maxRedirects?: number }): Promise<{ bytes: Uint8Array; type: "jpeg"|"png"|"webp"|"gif" }>` — defaults 5 MB, 10 s, 3 redirects; each hop: `https:` only, no userinfo, default port, host matches `INGEST_IMAGE_HOSTS`, every resolved address (`dns.promises.lookup(host, { all: true })`) non-private; `fetch(..., { redirect: "manual", signal })`; 3xx ⇒ resolve `Location` relative to the current URL and repeat; non-2xx ⇒ `http_<status>`; `content-length` over cap ⇒ `too_large`; stream the body and abort past the cap; `sniffImageType` null ⇒ `not_image`.
  - `persistEventImages(limit: number): Promise<{ processed: number; persisted: number; cleared: number; failed: { event_id: string; code: string }[] }>` — elevated select of non-deleted `source='instagram'` events in `pending|approved` whose `image_url` host matches `INGEST_IMAGE_HOSTS`, newest first; upload to `event-images` at `ingest/<event id>.<ext>` with `upsert: true` and the sniffed content type; update `image_url` to the public URL; on `http_403|http_404|http_410` set `image_url = null` (counted as `cleared`) so the placeholder renders everywhere; other failures leave the row unchanged. Check `events_guard_moderated_update` does not reject a service-role `image_url` update (read the trigger first; if it does, add a narrowly scoped exception in a migration with a pgTAP test).
  - `POST /api/admin/ingestion/images` (`"persist ingested images"`, admin) → the summary above.

- [ ] **Step 1: Failing tests** (inject `lookup`/`fetchImpl`): `http://` ⇒ `disallowed_url`; `https://evil.test/a.jpg` ⇒ `disallowed_url`; allowed host resolving to `10.0.0.5` ⇒ `private_address`; resolving to `[public, 127.0.0.1]` ⇒ `private_address`; redirect to `https://169.254.169.254/` ⇒ `disallowed_url`; 4 redirects ⇒ `too_many_redirects`; 6 MB streamed body without content-length ⇒ `too_large`; HTML bytes ⇒ `not_image`; PNG bytes ⇒ `{ type: "png" }`; `isPrivateAddress` table for every listed range plus `8.8.8.8` false and `::ffff:127.0.0.1` true.
- [ ] **Step 2–4:** implement; route checklist; REGISTRY row ("admin-triggered, host allow-listed, private-address rejection, bounded; writes only event-images/ingest/*").
- [ ] **Step 5: Run** Jest + guards → PASS.

### Task 15: In-repo Instagram producer and local runner

**Files:**
- Create: `src/lib/ingest/instagramProducer.ts`, `src/lib/ingest/__tests__/instagramProducer.test.ts`, `src/lib/ingest/__fixtures__/apify-profiles.json` (synthetic data in the Apify profile-scraper shape: two profiles, handles `example_club_a`/`example_club_b`, posts with invented captions — no real accounts or people)
- Create: `scripts/ingest/instagram.ts`, `scripts/ingest/run-local.ts`, `docs/runbooks/ingestion.md`
- Modify: `LAST_SCRAPE.md` (pointer to the runbook; the historical log stays)

**Interfaces:**
- Consumes: `classifyBatch`, `partitionByAction`, `InstagramPost`, `ExtractedEvent` from `@/lib/classifier`; `WebhookEvent` type from `@/contracts/webhook`.
- Produces (`instagramProducer.ts`, pure):
  - `PRODUCER_ID = "instagram-apify@1"`
  - `mapApifyProfiles(items: unknown[]): InstagramPost[]` — reads `username`, `fullName`, `latestPosts[]` (`id`, `caption`, `timestamp`, `displayUrl`, `url`, `likesCount`, `commentsCount`); drops malformed items; `account = username`
  - `buildWebhookEvents(posts: InstagramPost[], opts: { now: Date; days: number }): { events: WebhookEvent[]; seen: number; discarded: number }` — posts newer than `now - days`; `classifyBatch` → keep `auto_pending` and `manual_review` partitions with non-null `extracted_fields`; map to `WebhookEvent` with `source_url = post_url`, `image_url`, `organizer` from the extracted fields
  - `chunk<T>(items: T[], size: number): T[][]`
  - `signBody(body: string, secret: string): string` (hex HMAC-SHA256, matches `verifySignature`)
  - `webhookPayload(events: WebhookEvent[], run: { id: string; status: "ok"|"failed"; error_code?: string; items_seen?: number }): string` (JSON with `event_count`, `events`, `run.producer = PRODUCER_ID`)
- `scripts/ingest/instagram.ts` CLI: `--handles a,b,c` (required, ≤10), `--days N` (default 14, ≤60), `--webhook-url URL` (required), `--dry-run` (prints counts only), `--fixture path` (skip Apify). Secrets: `WEBHOOK_SECRET` from env (required unless `--dry-run`), `APIFY_API_TOKEN` from env or `dotenv.parse(readFileSync(".env"))` — never printed. Target guard: webhook host must be `127.0.0.1`/`localhost` unless `INGEST_ALLOW_REMOTE_TARGET === "I_UNDERSTAND_THIS_WRITES_TO_A_REMOTE_PROJECT"`. Apify call: `POST https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?timeout=240` with header `Authorization: Bearer <token>` and body `{ "usernames": handles, "resultsLimit": 12 }`, 300 s client timeout. On Apify failure: send one signed payload with `run.status = "failed"`, `error_code = "apify_http_<status>" | "apify_timeout" | "apify_network"`, then exit 1. Batches of 25; each POST retried at most 3 times on network/5xx with 1 s/2 s/4 s backoff (content hashes make retries idempotent). Output: one line per batch with counts and HTTP status, then a final summary; never captions, tokens or payloads.
- `scripts/ingest/run-local.ts`: modelled on `scripts/test-edge-local.ts` — `localStackEnv()`, `assertSeedTargetAllowed` + `isLocalSeedTarget`, random `WEBHOOK_SECRET` in a temp env file, `supabase functions serve events-webhook --env-file … --no-verify-jwt`, wait for the 401 readiness probe, then spawn `npx tsx scripts/ingest/instagram.ts` with `--webhook-url ${stack.url}/functions/v1/events-webhook` and the forwarded CLI args, `WEBHOOK_SECRET` in its env; stop the server in `finally`.

- [ ] **Step 1: Failing tests** with the fixture: `mapApifyProfiles` returns the fixture's valid posts and drops a malformed profile; `buildWebhookEvents` drops posts older than `days` and posts the classifier discards; every event passes `WebhookEvent` validation from `supabase/functions/_shared/webhook-contract.ts`; `signBody` output verifies with `verifySignature` from `supabase/functions/_shared/webhook-signature.ts`; `webhookPayload([], { status: "failed", … })` parses with the contract (empty events allowed with `run`).
- [ ] **Step 2–3:** implement; `npx jest src/lib/ingest` → PASS; `npx tsx scripts/ingest/instagram.ts --fixture src/lib/ingest/__fixtures__/apify-profiles.json --handles example_club_a --webhook-url http://127.0.0.1:1/x --dry-run` prints counts and exits 0.
- [ ] **Step 4: Runbook** `docs/runbooks/ingestion.md`: operator (Ady; backup operator to be named by the owner), prerequisites, local run command, producer-to-publication path (producer → signed webhook → pending event → `/moderation/pending` → approval → `/discover`), replay (rerun is safe; duplicates are recorded as `duplicate`), failure diagnosis (`/moderation/ingestion`, delivery outcomes, error codes), image persistence and expiry, the stale queue, scheduling status (operator-run; hosted schedule is an M4 decision), what never to do (run against production without the owner, print tokens, bypass moderation by inserting `approved` rows).

### Task 16: Real local ingestion run (evidence)

**Files:**
- Create: `.planning/milestones/m3/evidence/ingestion-real-run.log`, `.planning/milestones/m3/evidence/ingestion-replay.log`, `.planning/milestones/m3/evidence/ingestion-failure.log`

- [ ] **Step 1:** Local stack up, seed loaded. Run `npx tsx scripts/ingest/run-local.ts --handles mcgillhacks,mcgillwics,mcgillesports --days 45 2>&1 | tee .planning/milestones/m3/evidence/ingestion-real-run.log`. Expected: Apify returns profiles; ≥0 events inserted as `pending`; a `succeeded`/`partial`/`duplicate` delivery row. If the classifier yields zero events for these handles, rerun once with up to 7 more handles from `LAST_SCRAPE.md` known to post events (e.g. `mcgillhacks,pharma.hacks,mcgillwics,mcgillvc,competitions_mus,mcgill_caseleague,nsbemcgill`) — stop at 10 handles total and record both runs.
- [ ] **Step 2: Replay.** Rerun the same command into `ingestion-replay.log`. Expected: `inserted 0`, a `duplicate` delivery, and the pending-event count unchanged (record a before/after `SELECT count(*) FROM events WHERE source='instagram' AND status='pending'` via a SQL file).
- [ ] **Step 3: Failure visibility.** Run with `APIFY_API_TOKEN=invalid` (env override for this one command) into `ingestion-failure.log`. Expected: the producer exits 1 after sending a `failed` run; `/api/admin/ingestion` shows `last_failure_at` and `error_code = apify_http_401`.
- [ ] **Step 4:** Leave the pending rows for the computer-use demo (Task 18). Do not approve them here.
- [ ] **Step 5: Package gate + commit:** `git commit -m "feat(m3): observable McGill ingestion with safe image persistence (P1-07)"` (stage the Task 12–16 paths and evidence logs explicitly).

---

## Verification and close (Tasks 17–18, one commit)

### Task 17: M3 acceptance browser suite

**Files:**
- Create: `playwright.m3.config.ts` (spreads `playwright.m1-m2.config.ts`; `testMatch: /specs\/m3-acceptance\.spec\.ts/`; env `FEATURE_DISCOVERY_UI: "true"`, `CURATOR_USER_ID: IDS.admin`, `INTAKE_HASH_SECRET: "local-m3-intake-secret"`)
- Create: `e2e/specs/m3-acceptance.spec.ts` (disposable rows in UUID namespace `ad070300-…`, cleaned in `afterAll`, following `m1-m2-acceptance.spec.ts`)
- Modify: `playwright.config.ts` and `playwright.m1-m2.config.ts` so their `chromium` projects ignore the M3 spec

Tests (each an independent `test()`):
1. Guest home: hero `h1` visible; "Browse opportunities" reaches `/discover` without sign-in; no text "Talent", "Apply with", "Weekly Drop".
2. Discover filters: select type Hackathon and university cross-campus; reload keeps the URL params and results; open a listing; browser back restores the filtered URL.
3. Detail facts: a seeded opportunity with date-only deadline shows the deadline, "Check eligibility with organizer", the provenance label; a closed opportunity shows the closed state and no action link.
4. Save after login: the `student` persona saves the listing; `/saved` shows it; the legacy saved event also shows.
5. Resources: admin publishes a guide through the API; guest opens `/resources/<slug>` at 360×800 with no horizontal scroll (`document.documentElement.scrollWidth <= 360`); a draft resource is absent from `/api/resources` and `/sitemap.xml`; creating a guide containing `[x](javascript:alert(1))` returns 400.
6. Submission → publication: guest submits a hackathon on `/submit`; the receipt shows no ID; admin converts it in `/moderation/submissions`, opens the draft, fills required fields, checks the source, publishes; guest finds it on `/discover`. A second convert PATCH with the old `expected_updated_at` returns the same target and the opportunity count is unchanged. Honeypot POST returns 202 and adds no row.
7. Report: guest reports the listing; admin sees it in the Listing reports tab with the reason; the public page and API never contain the reporter details.
8. Company request: POST a company request with a unique contact email; admin sees it; convert creates a draft `job` with `source_type` partner; the contact email appears in no public response (`/`, `/discover`, the draft's eventual public page after publish, `/api/discovery`); the submitter's roles are unchanged.
9. Private fields: fetch `/`, `/discover`, `/opportunities/<id>` both as HTML and with header `RSC: 1`; none contain a seeded `duplicate_review_note` sentinel or the company contact email.
10. Ingestion page: admin sees `/moderation/ingestion` with a delivery row; student gets redirected/denied per the moderation layout.
11. Broken image: an event with an unreachable `image_url` on an allowed host renders `/placeholder-event.png` after load.

- [ ] **Step 1:** write the spec. **Step 2:** `npx playwright test --config=playwright.m3.config.ts` (progress note; builds the app) → all pass. Fix product defects found, not the assertions.

### Task 18: Full gate, computer-use demo and report

- [ ] **Step 1: Full local gate** (sequential, each with progress notes, logs to `.planning/milestones/m3/evidence/<name>-final.log`): `supabase db reset --local`; `npx tsx scripts/seed/load.ts`; `supabase test db --local`; `npm run test:ci -- --runInBand`; `npx tsc --noEmit`; `npm run lint`; type drift (`supabase gen types … > /tmp/types.gen.ts && diff -u src/lib/supabase/types.ts /tmp/types.gen.ts`); static guards (migration filenames, elevated ratchet, contracts ×2, server console, characterization tags, RLS coverage); `docker run --rm --privileged --net container:supabase_auth_Event-Radar alpine sysctl -w net.ipv4.tcp_tw_reuse=1`; `npx playwright test --config=playwright.config.ts` (baseline, switches off); `npx playwright test --config=playwright.m1-m2.config.ts`; `npx playwright test --config=playwright.m3.config.ts`; `npx tsx scripts/test-edge-local.ts`; `npm run build`.
- [ ] **Step 2: Computer-use demo** of the milestone script against a local production build with `FEATURE_DISCOVERY_UI=true`: guest browse → filter a cross-campus hackathon → inspect deadline/source → sign in and save → read a resource → submit an opportunity → publish it from moderation → approve one real ingested McGill event from Task 16, persist its image, see it on `/discover` → a closed listing with its action disabled. Record observations and screenshots in `.planning/milestones/m3/COMPUTER-USE-VERIFICATION.md`.
- [ ] **Step 3: Report.** `.planning/milestones/m3/REPORT.md` (delivered per package, compatibility/security notes, verification counts with evidence links, what was not done: owner content, hosted schedule, CDN caching, production migration), update `.planning/STATE.md` "Current product work" and the M3 status line in `docs/plans/2026-09-27-universe-phase-1-milestones.md`, and the launch-content checklist state in `.planning/milestones/m1-m2/DECISIONS.md` if anything changed (it should not: no owner content was supplied).
- [ ] **Step 4: Commit:** `git commit -m "test(m3): acceptance suite, verification evidence and report"` (explicit paths).
