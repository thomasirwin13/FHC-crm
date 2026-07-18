-- Migration 0025: Reports, audience segments, campaign drafts, contact districts, audit events
-- Plus suppression/consent fields on contacts

-- ============================================================
-- 1. Suppression and consent fields on contacts
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS bounced boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suppressed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamp,
  ADD COLUMN IF NOT EXISTS bounce_reason text;

-- Backfill: treat NULL subscription_status as 'active'
UPDATE contacts SET subscription_status = 'active'
  WHERE subscription_status IS NULL;

-- ============================================================
-- 2. Saved reports
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_reports (
  id serial PRIMARY KEY,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  entity_type text NOT NULL DEFAULT 'contacts',
  filter_definition jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_definition jsonb,
  group_by text,
  aggregate_functions jsonb,
  created_by integer REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_reports_select ON saved_reports
  FOR SELECT USING (is_team_member(team_id));

CREATE POLICY saved_reports_insert ON saved_reports
  FOR INSERT WITH CHECK (is_team_member(team_id));

CREATE POLICY saved_reports_update ON saved_reports
  FOR UPDATE USING (is_team_member(team_id));

CREATE POLICY saved_reports_delete ON saved_reports
  FOR DELETE USING (is_team_member(team_id));

-- ============================================================
-- 3. Report runs
-- ============================================================
CREATE TABLE IF NOT EXISTS report_runs (
  id serial PRIMARY KEY,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  report_id integer REFERENCES saved_reports(id) ON DELETE SET NULL,
  run_by integer REFERENCES users(id),
  result_count integer NOT NULL DEFAULT 0,
  parameters jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_runs_select ON report_runs
  FOR SELECT USING (is_team_member(team_id));

CREATE POLICY report_runs_insert ON report_runs
  FOR INSERT WITH CHECK (is_team_member(team_id));

-- ============================================================
-- 4. Audience segments
-- ============================================================
CREATE TABLE IF NOT EXISTS audience_segments (
  id serial PRIMARY KEY,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  source_report_id integer REFERENCES saved_reports(id) ON DELETE SET NULL,
  filter_definition jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_count integer NOT NULL DEFAULT 0,
  contactable_email integer NOT NULL DEFAULT 0,
  contactable_sms integer NOT NULL DEFAULT 0,
  excluded_count integer NOT NULL DEFAULT 0,
  last_calculated_at timestamp,
  created_by integer REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE audience_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY audience_segments_select ON audience_segments
  FOR SELECT USING (is_team_member(team_id));

CREATE POLICY audience_segments_insert ON audience_segments
  FOR INSERT WITH CHECK (is_team_member(team_id));

CREATE POLICY audience_segments_update ON audience_segments
  FOR UPDATE USING (is_team_member(team_id));

CREATE POLICY audience_segments_delete ON audience_segments
  FOR DELETE USING (is_team_member(team_id));

-- ============================================================
-- 5. Campaign drafts
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_drafts (
  id serial PRIMARY KEY,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  audience_segment_id integer REFERENCES audience_segments(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'email',
  subject text,
  message_body text,
  merge_fields jsonb,
  status text NOT NULL DEFAULT 'draft',
  tone text,
  call_to_action text,
  district_context text,
  created_by integer REFERENCES users(id),
  approved_by integer REFERENCES users(id),
  approved_at timestamp,
  external_campaign_id text,
  external_platform text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT campaign_status_check CHECK (status IN ('draft', 'approved', 'sent', 'cancelled'))
);

ALTER TABLE campaign_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_drafts_select ON campaign_drafts
  FOR SELECT USING (is_team_member(team_id));

CREATE POLICY campaign_drafts_insert ON campaign_drafts
  FOR INSERT WITH CHECK (is_team_member(team_id));

CREATE POLICY campaign_drafts_update ON campaign_drafts
  FOR UPDATE USING (is_team_member(team_id));

CREATE POLICY campaign_drafts_delete ON campaign_drafts
  FOR DELETE USING (is_team_member(team_id));

-- ============================================================
-- 6. Contact district metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_districts (
  id serial PRIMARY KEY,
  contact_id integer NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  district_type text NOT NULL,
  district_number text NOT NULL,
  jurisdiction text NOT NULL DEFAULT 'California',
  district_name text,
  source text NOT NULL DEFAULT 'census_geocoder',
  effective_date date,
  matched_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT district_type_check CHECK (
    district_type IN (
      'congressional',
      'state_senate',
      'state_assembly',
      'county_supervisor',
      'city_council'
    )
  ),
  UNIQUE (contact_id, district_type, jurisdiction)
);

ALTER TABLE contact_districts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contact_districts_select ON contact_districts
  FOR SELECT USING (is_team_member(team_id));

CREATE POLICY contact_districts_insert ON contact_districts
  FOR INSERT WITH CHECK (is_team_member(team_id));

CREATE POLICY contact_districts_update ON contact_districts
  FOR UPDATE USING (is_team_member(team_id));

CREATE POLICY contact_districts_delete ON contact_districts
  FOR DELETE USING (is_team_member(team_id));

CREATE INDEX IF NOT EXISTS idx_contact_districts_lookup
  ON contact_districts (team_id, district_type, district_number, jurisdiction);

-- ============================================================
-- 7. Audit events
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_events (
  id serial PRIMARY KEY,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id integer REFERENCES users(id),
  event_type text NOT NULL,
  entity_type text,
  entity_id integer,
  details jsonb,
  ip_address text,
  created_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_events_select ON audit_events
  FOR SELECT USING (is_team_member(team_id));

CREATE POLICY audit_events_insert ON audit_events
  FOR INSERT WITH CHECK (is_team_member(team_id));

CREATE INDEX IF NOT EXISTS idx_audit_events_team_type
  ON audit_events (team_id, event_type, created_at DESC);

-- ============================================================
-- 8. Indexes for common queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contacts_subscription
  ON contacts (team_id, subscription_status, bounced, suppressed);

CREATE INDEX IF NOT EXISTS idx_contacts_districts
  ON contacts (team_id, congressional_district, state_senate_district, state_assembly_district);

CREATE INDEX IF NOT EXISTS idx_saved_reports_team
  ON saved_reports (team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audience_segments_team
  ON audience_segments (team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_drafts_team
  ON campaign_drafts (team_id, status, created_at DESC);

-- ============================================================
-- 9. Grants
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_reports TO authenticated;
GRANT SELECT, INSERT ON report_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON audience_segments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON campaign_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON contact_districts TO authenticated;
GRANT SELECT, INSERT ON audit_events TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE saved_reports_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE report_runs_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE audience_segments_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE campaign_drafts_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE contact_districts_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE audit_events_id_seq TO authenticated;
