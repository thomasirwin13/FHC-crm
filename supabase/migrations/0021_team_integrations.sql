-- Per-team integration credentials (Action Network, MailerLite, etc.)
-- Each team stores its own API keys so a multi-tenant deployment can point
-- different teams at different external accounts. Protected by RLS so only
-- members of the owning team can read or write their credentials.
CREATE TABLE IF NOT EXISTS team_integrations (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,          -- 'action_network' | 'mailerlite'
  api_key TEXT,
  config JSONB NOT NULL DEFAULT '{}',  -- provider-specific extras (e.g. mailerlite group_id)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, provider)
);

ALTER TABLE team_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can manage integrations"
  ON team_integrations FOR ALL
  USING (is_team_member(team_id))
  WITH CHECK (is_team_member(team_id));
