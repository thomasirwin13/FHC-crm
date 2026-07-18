-- Multiple lead organizers for contacts and organizations
-- Replaces the single assigned_user_id FK with many-to-many junction tables.

CREATE TABLE contact_organizers (
  id serial PRIMARY KEY,
  contact_id integer NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  UNIQUE(contact_id, user_id)
);

CREATE TABLE organization_organizers (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Migrate existing assigned_user_id data
INSERT INTO contact_organizers (contact_id, user_id, team_id)
SELECT id, assigned_user_id, team_id FROM contacts WHERE assigned_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO organization_organizers (organization_id, user_id, team_id)
SELECT id, assigned_user_id, team_id FROM organizations WHERE assigned_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Outreach frequency for individual contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS outreach_frequency varchar(20)
  CHECK (outreach_frequency IN ('weekly', 'monthly', 'quarterly', 'yearly'));

-- RLS
ALTER TABLE contact_organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_organizers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can manage contact organizers"
  ON contact_organizers USING (is_team_member(team_id))
  WITH CHECK (is_team_member(team_id));

CREATE POLICY "Team members can manage organization organizers"
  ON organization_organizers USING (is_team_member(team_id))
  WITH CHECK (is_team_member(team_id));

-- Indexes
CREATE INDEX idx_contact_organizers_user ON contact_organizers(user_id);
CREATE INDEX idx_contact_organizers_contact ON contact_organizers(contact_id);
CREATE INDEX idx_organization_organizers_user ON organization_organizers(user_id);
CREATE INDEX idx_organization_organizers_org ON organization_organizers(organization_id);
CREATE INDEX idx_contacts_outreach_frequency ON contacts(outreach_frequency) WHERE outreach_frequency IS NOT NULL;

-- Grants
GRANT ALL ON contact_organizers TO authenticated;
GRANT ALL ON organization_organizers TO authenticated;
GRANT USAGE ON SEQUENCE contact_organizers_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE organization_organizers_id_seq TO authenticated;
