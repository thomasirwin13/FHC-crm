-- Retire the free-text organization location field. Region (regions[]) and
-- the street address columns replace it.

ALTER TABLE organizations DROP COLUMN IF EXISTS location;
