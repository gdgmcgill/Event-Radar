-- =============================================================================
-- 000-setup.sql — pgTAP plus the in-repo test helpers
-- Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-05
--
-- The leading zeros are load-bearing. `supabase test db` hands every file in
-- this directory to pg_prove in sorted order, each in its own session, so this
-- file must sort first for its objects to exist when the test files run.
--
-- ZERO-DEPENDENCY BY CONTRACT. The impersonation helpers below are two
-- configuration statements written here, not a package fetched from a registry
-- at test time. A registry-fetched database test-helper package was evaluated
-- and rejected: it would put a network dependency inside the test command, make
-- CI non-deterministic, and install objects into the schema that will never
-- exist in production. Plan 03-05's acceptance criteria grep this directory for
-- the package registry, its client, and the helper schema that package installs;
-- that grep returns 0 and is meant to stay that way. The pattern is deliberately
-- not spelled out here — a tripwire that matches its own documentation reports a
-- hit for the wrong reason.
--
-- pgTAP IS A LOCAL-TIME CONTROL. The extension is created in the LOCAL test
-- database only. `.planning/audit/async/extensions.json` records pgTAP as
-- available but not installed in production, and nothing in this plan installs
-- it there. These tests prove a database built from `supabase/migrations/`
-- behaves correctly; they assert nothing about the running production database.
--
-- THE DDL BELOW IS DELIBERATELY OUTSIDE A TRANSACTION. The TAP self-check at
-- the bottom rolls back, as every pgTAP file must. If the extension and helper
-- definitions were inside that transaction they would roll back with it and no
-- later file would find them.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO PUBLIC;


-- -----------------------------------------------------------------------------
-- Impersonation
--
-- `auth.uid()` in this project reads BOTH claim forms — it coalesces the
-- singular `request.jwt.claim.sub` against `sub` pulled out of the full
-- `request.jwt.claims` object — and which one is populated has varied across
-- GoTrue versions. Both are therefore set, and the RLS suite's FIRST assertion
-- checks that the observed user id actually changed rather than trusting that
-- it did. A helper that silently fails to impersonate would make every "deny"
-- assertion pass for the wrong reason.
--
-- `is_local := true` scopes every setting to the surrounding transaction, so a
-- file that rolls back leaves no session state behind for the next one.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION tests.act_as(uid uuid) RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', uid, 'role', 'authenticated')::text,
                     true);
END
$$;

CREATE OR REPLACE FUNCTION tests.act_as_anon() RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
END
$$;

CREATE OR REPLACE FUNCTION tests.act_as_owner() RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  -- Back to the session role, which owns the tables and therefore bypasses RLS.
  -- This is how an integrity assertion asks "is the row still there?" after a
  -- policy has filtered it away from somebody else.
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
END
$$;


-- -----------------------------------------------------------------------------
-- Index introspection
--
-- An index has no behaviour to characterize, only presence — but asserting a
-- NAME exists proves nothing about what it covers. These helpers return the
-- index's actual column list, access method and partial predicate, so the
-- assertions in 010-fk-indexes.test.sql name the table and the columns rather
-- than a string somebody could satisfy by creating an index on anything.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION tests.index_columns(p_schema text, p_table text, p_index text)
  RETURNS text[] LANGUAGE sql STABLE AS $$
  SELECT array_agg(a.attname::text ORDER BY k.ord)
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_class tc ON tc.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tc.relnamespace
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = tc.oid AND a.attnum = k.attnum
   WHERE n.nspname = p_schema
     AND tc.relname = p_table
     AND ic.relname = p_index;
$$;

CREATE OR REPLACE FUNCTION tests.index_am(p_schema text, p_table text, p_index text)
  RETURNS text LANGUAGE sql STABLE AS $$
  SELECT am.amname::text
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_am am ON am.oid = ic.relam
    JOIN pg_class tc ON tc.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tc.relnamespace
   WHERE n.nspname = p_schema
     AND tc.relname = p_table
     AND ic.relname = p_index;
$$;

CREATE OR REPLACE FUNCTION tests.index_is_partial(p_schema text, p_table text, p_index text)
  RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT i.indpred IS NOT NULL
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_class tc ON tc.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tc.relnamespace
   WHERE n.nspname = p_schema
     AND tc.relname = p_table
     AND ic.relname = p_index;
$$;


-- -----------------------------------------------------------------------------
-- Plan introspection
--
-- Presence is not usability. An index the planner cannot apply to the predicate
-- it was created for is a row in pg_index and nothing else. `explain_text`
-- returns the plan as one string so a test can assert the index NAME appears in
-- it. The caller is expected to set `enable_seqscan = off` for the transaction
-- first: on an empty table a sequential scan is free, so the question worth
-- asking is not "did the planner choose it" but "CAN the planner use it".
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION tests.explain_text(p_sql text)
  RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  line record;
  plan_text text := '';
BEGIN
  FOR line IN EXECUTE 'EXPLAIN (COSTS OFF) ' || p_sql LOOP
    plan_text := plan_text || line."QUERY PLAN" || E'\n';
  END LOOP;
  RETURN plan_text;
END
$$;


-- -----------------------------------------------------------------------------
-- Self-check. This file is a test file too: if the helpers above are not
-- installed and callable, every later file fails for a reason that has nothing
-- to do with the schema it is checking.
-- -----------------------------------------------------------------------------

BEGIN;
SELECT plan(5);

SELECT has_function('tests', 'act_as', ARRAY['uuid'], 'tests.act_as(uuid) is installed');
SELECT has_function('tests', 'act_as_anon', 'tests.act_as_anon() is installed');
SELECT has_function('tests', 'act_as_owner', 'tests.act_as_owner() is installed');

-- The helper genuinely moves auth.uid(), rather than merely running without error.
SELECT tests.act_as('00000000-0000-4000-8000-0000000000aa');
SELECT is((SELECT auth.uid()), '00000000-0000-4000-8000-0000000000aa'::uuid,
          'act_as moves auth.uid() to the impersonated subject');

SELECT tests.act_as_anon();
SELECT is((SELECT auth.uid()), NULL::uuid,
          'act_as_anon clears auth.uid() — an anonymous caller has no subject');

SELECT * FROM finish();
ROLLBACK;
