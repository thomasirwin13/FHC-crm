-- =============================================================================
-- AI Service Tables
-- Usage tracking, citations, and feedback for the AI service layer.
-- =============================================================================

-- ai_usage: token/cost tracking per AI request
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  chat_id INTEGER REFERENCES chats(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  workload TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost NUMERIC(12,6),
  latency_ms INTEGER,
  request_id TEXT,
  tool_calls INTEGER DEFAULT 0,
  retrieval_count INTEGER DEFAULT 0,
  succeeded BOOLEAN NOT NULL DEFAULT false,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_team ON ai_usage(team_id);
CREATE INDEX idx_ai_usage_user ON ai_usage(user_id);
CREATE INDEX idx_ai_usage_created ON ai_usage(created_at);
CREATE INDEX idx_ai_usage_feature ON ai_usage(feature);
CREATE INDEX idx_ai_usage_model ON ai_usage(model);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_usage_team_isolation" ON ai_usage
  FOR ALL USING (is_team_member(team_id))
  WITH CHECK (is_team_member(team_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_usage TO authenticated;

-- ai_citations: link AI messages to source records
CREATE TABLE IF NOT EXISTS ai_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  chunk_id TEXT,
  source_title TEXT,
  excerpt TEXT,
  rank INTEGER,
  similarity_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_citations_message ON ai_citations(message_id);
CREATE INDEX idx_citations_team ON ai_citations(team_id);

ALTER TABLE ai_citations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_citations_team_isolation" ON ai_citations
  FOR ALL USING (is_team_member(team_id))
  WITH CHECK (is_team_member(team_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_citations TO authenticated;

-- ai_feedback: thumbs up/down on AI messages
CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  model TEXT,
  helpful BOOLEAN NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

CREATE INDEX idx_feedback_team ON ai_feedback(team_id);
CREATE INDEX idx_feedback_message ON ai_feedback(message_id);

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_feedback_team_isolation" ON ai_feedback
  FOR ALL USING (is_team_member(team_id))
  WITH CHECK (is_team_member(team_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_feedback TO authenticated;
