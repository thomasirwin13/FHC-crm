-- Consolidate organization categorization onto the `type` column.
-- The `industry` column was a legacy free-form field with no populated rows
-- and no editable UI. Any remaining values are copied into `type` (only when
-- `type` is empty) before the column is dropped, to avoid data loss.

UPDATE organizations
SET type = industry
WHERE (type IS NULL OR type = '')
  AND industry IS NOT NULL
  AND industry <> '';

ALTER TABLE organizations DROP COLUMN IF EXISTS industry;
