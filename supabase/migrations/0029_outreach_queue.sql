-- Outreach queue: tracks contacts each organizer needs to reach out to
CREATE TABLE outreach_queue (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'need_outreach'
    CHECK (status IN ('need_outreach', 'scheduling', 'scheduled')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);

CREATE INDEX idx_outreach_queue_user_status ON outreach_queue(user_id, status);
CREATE INDEX idx_outreach_queue_team ON outreach_queue(team_id);

-- RLS
ALTER TABLE outreach_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY outreach_queue_select ON outreach_queue
  FOR SELECT USING (is_team_member(team_id));

CREATE POLICY outreach_queue_insert ON outreach_queue
  FOR INSERT WITH CHECK (is_team_member(team_id));

CREATE POLICY outreach_queue_update ON outreach_queue
  FOR UPDATE USING (is_team_member(team_id));

CREATE POLICY outreach_queue_delete ON outreach_queue
  FOR DELETE USING (is_team_member(team_id));
