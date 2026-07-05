-- Add regions array column to contacts (same as organizations)
ALTER TABLE contacts ADD COLUMN regions text[] DEFAULT '{}';
