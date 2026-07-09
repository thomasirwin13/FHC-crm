-- Legislative bills tracked by the team
CREATE TABLE IF NOT EXISTS legislative_bills (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  bill_id TEXT NOT NULL,
  bill_id_param TEXT,
  title TEXT NOT NULL,
  topic TEXT,
  tier TEXT DEFAULT 'Tier 2',
  house_location TEXT,
  committee_location TEXT,
  committee_hearing_date DATE,
  last_amended_date DATE,
  committee_action_date DATE,
  committee_motion TEXT,
  committee_vote_result TEXT,
  lead_authors TEXT,
  principal_coauthors TEXT,
  coauthors TEXT,
  history_actions JSONB DEFAULT '[]',
  last_scraped TIMESTAMP,
  stages JSONB DEFAULT '[]',
  alert_type TEXT DEFAULT 'none',
  alert_note TEXT DEFAULT '',
  badge_label TEXT DEFAULT '',
  highlight TEXT DEFAULT 'none',
  policy_deadline DATE,
  source_url TEXT,
  letter_status TEXT DEFAULT 'not_started',
  letter_status_label TEXT DEFAULT 'Not submitted',
  letter_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, bill_id)
);

-- Legislative events / calendar items
CREATE TABLE IF NOT EXISTS legislative_events (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  date_label TEXT,
  urgency TEXT DEFAULT 'future',
  badge_label TEXT,
  event_type TEXT DEFAULT 'event',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS
ALTER TABLE legislative_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislative_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can manage legislative bills"
  ON legislative_bills FOR ALL
  USING (is_team_member(team_id))
  WITH CHECK (is_team_member(team_id));

CREATE POLICY "Team members can manage legislative events"
  ON legislative_events FOR ALL
  USING (is_team_member(team_id))
  WITH CHECK (is_team_member(team_id));
