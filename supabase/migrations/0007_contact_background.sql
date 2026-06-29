-- Add background description field to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS background text;
