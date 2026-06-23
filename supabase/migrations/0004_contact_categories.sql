-- Contact categories (team-defined tags)
CREATE TABLE IF NOT EXISTS contact_categories (
  id serial PRIMARY KEY,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  color varchar(30) NOT NULL DEFAULT 'gray',
  created_at timestamp DEFAULT now() NOT NULL,
  UNIQUE(team_id, name)
);

-- Junction table: contacts <-> categories
CREATE TABLE IF NOT EXISTS contact_category_assignments (
  id serial PRIMARY KEY,
  contact_id integer NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  category_id integer NOT NULL REFERENCES contact_categories(id) ON DELETE CASCADE,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now() NOT NULL,
  UNIQUE(contact_id, category_id)
);

-- Preferred contact method on contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_contact_method varchar(50);

-- RLS
ALTER TABLE contact_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can manage contact_categories"
  ON contact_categories FOR ALL USING (is_team_member(team_id));

ALTER TABLE contact_category_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can manage contact_category_assignments"
  ON contact_category_assignments FOR ALL USING (is_team_member(team_id));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contact_categories_team ON contact_categories(team_id);
CREATE INDEX IF NOT EXISTS idx_cat_assignments_contact ON contact_category_assignments(contact_id);
CREATE INDEX IF NOT EXISTS idx_cat_assignments_category ON contact_category_assignments(category_id);
CREATE INDEX IF NOT EXISTS idx_cat_assignments_team ON contact_category_assignments(team_id);
