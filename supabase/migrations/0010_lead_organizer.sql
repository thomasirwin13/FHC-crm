-- Add lead organizer (assigned team member) to contacts and organizations
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assigned_user_id integer REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS assigned_user_id integer REFERENCES users(id) ON DELETE SET NULL;
