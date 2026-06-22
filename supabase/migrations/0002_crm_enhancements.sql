-- Add type field to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS type varchar(100);

-- Add action_committed field to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS action_committed boolean NOT NULL DEFAULT false;

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id serial PRIMARY KEY,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id),
  name varchar(255) NOT NULL,
  date date NOT NULL,
  location varchar(255),
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Meeting attendance (contacts who attended a meeting)
CREATE TABLE IF NOT EXISTS meeting_attendance (
  id serial PRIMARY KEY,
  meeting_id integer NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  contact_id integer NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, contact_id)
);

-- One-on-one meetings between organizers and contacts
CREATE TABLE IF NOT EXISTS one_on_ones (
  id serial PRIMARY KEY,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  contact_id integer NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  organizer_name varchar(255),
  date date NOT NULL,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS meetings_team_id_idx ON meetings(team_id);
CREATE INDEX IF NOT EXISTS meetings_date_idx ON meetings(date);
CREATE INDEX IF NOT EXISTS meeting_attendance_meeting_id_idx ON meeting_attendance(meeting_id);
CREATE INDEX IF NOT EXISTS meeting_attendance_contact_id_idx ON meeting_attendance(contact_id);
CREATE INDEX IF NOT EXISTS one_on_ones_team_id_idx ON one_on_ones(team_id);
CREATE INDEX IF NOT EXISTS one_on_ones_contact_id_idx ON one_on_ones(contact_id);

-- RLS for meetings
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY meetings_team_isolation ON meetings
  USING (is_team_member(team_id));

-- RLS for meeting_attendance
ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY meeting_attendance_team_isolation ON meeting_attendance
  USING (is_team_member(team_id));

-- RLS for one_on_ones
ALTER TABLE one_on_ones ENABLE ROW LEVEL SECURITY;
CREATE POLICY one_on_ones_team_isolation ON one_on_ones
  USING (is_team_member(team_id));
