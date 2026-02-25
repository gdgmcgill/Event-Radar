-- Add status column (default 'approved' so existing clubs remain visible)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';

-- Add category column (nullable)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS category text;

-- Add created_by column to track who created the club (for granting organizer on approval)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_clubs_status ON clubs(status);
