-- Region(s) an organization operates in — a multi-select replacing the
-- free-text location field on the org detail tab.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS regions text[] NOT NULL DEFAULT '{}';
