-- Per-team API keys that let an outside AI assistant (e.g. Claude cowork) read
-- the team's CRM data through the /api/mcp endpoint.
--
-- Only a SHA-256 hash of each key is stored. The full key is shown once, when
-- it is created, and can't be recovered afterwards — only revoked.
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,            -- first characters of the key, shown in the UI
  key_hash TEXT NOT NULL UNIQUE,       -- sha256 hex of the full key
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_team_id ON api_keys(team_id);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view api keys"
  ON api_keys FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "Team members can create api keys"
  ON api_keys FOR INSERT
  WITH CHECK (is_team_member(team_id) AND created_by = get_app_user_id());

CREATE POLICY "Team members can revoke api keys"
  ON api_keys FOR UPDATE
  USING (is_team_member(team_id))
  WITH CHECK (is_team_member(team_id));
