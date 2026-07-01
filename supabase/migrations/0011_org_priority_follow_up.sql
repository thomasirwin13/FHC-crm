ALTER TABLE organizations ADD COLUMN IF NOT EXISTS priority_follow_up boolean NOT NULL DEFAULT false;
