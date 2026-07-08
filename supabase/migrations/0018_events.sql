-- Events table for tracking Partiful events (and any other events)
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_date DATE,
  source TEXT DEFAULT 'partiful',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, name)
);

-- Junction table: which contacts attended which events
CREATE TABLE IF NOT EXISTS contact_event_attendance (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  rsvp_status TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(contact_id, event_id)
);

-- RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_event_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can manage events"
  ON events FOR ALL
  USING (is_team_member(team_id))
  WITH CHECK (is_team_member(team_id));

CREATE POLICY "Team members can manage attendance"
  ON contact_event_attendance FOR ALL
  USING (is_team_member(team_id))
  WITH CHECK (is_team_member(team_id));
