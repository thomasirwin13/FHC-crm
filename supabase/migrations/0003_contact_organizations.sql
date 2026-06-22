-- Many-to-many junction table for contacts <-> organizations
CREATE TABLE IF NOT EXISTS contact_organizations (
  id serial PRIMARY KEY,
  contact_id integer NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now() NOT NULL,
  UNIQUE(contact_id, organization_id)
);

-- Migrate existing single organization_id data into the junction table
INSERT INTO contact_organizations (contact_id, organization_id, team_id)
SELECT id, organization_id, team_id
FROM contacts
WHERE organization_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE contact_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can manage contact_organizations"
  ON contact_organizations FOR ALL
  USING (is_team_member(team_id));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contact_orgs_contact ON contact_organizations(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_orgs_org ON contact_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_contact_orgs_team ON contact_organizations(team_id);
