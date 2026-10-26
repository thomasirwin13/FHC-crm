-- Let a team choose, per key, whether Claude may change CRM data (update
-- contacts and organizations, log 1-on-1s) or only read it. Existing keys
-- stay read-only.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS can_write BOOLEAN NOT NULL DEFAULT false;
