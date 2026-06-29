-- Engagement level for contacts (every contact gets one, defaults to potential/Level 0)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS engagement_level varchar(50) NOT NULL DEFAULT 'potential';
