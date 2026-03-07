-- A/B Testing Framework tables

CREATE TABLE IF NOT EXISTS experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  target_metric text NOT NULL DEFAULT 'ctr'
    CHECK (target_metric IN ('ctr', 'save_rate', 'dismiss_rate')),
  start_date timestamptz,
  end_date timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiment_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  weight integer NOT NULL DEFAULT 1 CHECK (weight > 0),
  UNIQUE (experiment_id, name)
);

CREATE TABLE IF NOT EXISTS experiment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, user_id)
);

-- Add experiment_variant_id to recommendation_feedback
ALTER TABLE recommendation_feedback
  ADD COLUMN IF NOT EXISTS experiment_variant_id uuid REFERENCES experiment_variants(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiment_variants_experiment ON experiment_variants(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_experiment ON experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_user ON experiment_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_variant ON recommendation_feedback(experiment_variant_id);

-- RLS
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage experiments" ON experiments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND 'admin' = ANY(users.roles))
  );

CREATE POLICY "Anyone can read running experiments" ON experiments
  FOR SELECT USING (status = 'running');

CREATE POLICY "Admins can manage variants" ON experiment_variants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND 'admin' = ANY(users.roles))
  );

CREATE POLICY "Anyone can read variants of running experiments" ON experiment_variants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM experiments WHERE experiments.id = experiment_id AND experiments.status = 'running')
  );

CREATE POLICY "Users can read own assignments" ON experiment_assignments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service can insert assignments" ON experiment_assignments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can read all assignments" ON experiment_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND 'admin' = ANY(users.roles))
  );
