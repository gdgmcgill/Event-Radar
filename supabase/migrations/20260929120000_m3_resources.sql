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
        reviewed_at = CASE WHEN r.status = 'published' THEN clock_timestamp() ELSE r.reviewed_at END,
        updated_by = p_actor, updated_at = clock_timestamp()
      WHERE r.id = p_id RETURNING * INTO v;
      v_changed := ARRAY(SELECT jsonb_object_keys(p_data));
    ELSIF p_action = 'publish' THEN
      UPDATE public.resources r SET status = 'published', published_at = COALESCE(r.published_at, clock_timestamp()),
        reviewed_at = clock_timestamp(), updated_by = p_actor, updated_at = clock_timestamp()
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
