-- Political districts resolved from a contact's address via the US Census
-- Bureau geocoder. Stored on the contact so lookups aren't repeated.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS congressional_district text,
  ADD COLUMN IF NOT EXISTS state_senate_district text,
  ADD COLUMN IF NOT EXISTS state_assembly_district text,
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS districts_updated_at timestamptz;
