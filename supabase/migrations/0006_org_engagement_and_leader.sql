-- Engagement level for organizations (same 5-level ladder as contacts)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS engagement_level varchar(50) NOT NULL DEFAULT 'potential';

-- Team leader: one designated contact per organization
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS team_leader_id integer REFERENCES contacts(id) ON DELETE SET NULL;
