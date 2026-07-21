-- Add "meeting form" to 1-on-1 meetings so the form/medium of each meeting can be tracked.
-- Options: not_specified (0), text_check_in (1), phone_call (2), zoom_meeting (3), in_person (4).
-- Existing rows default to 'not_specified'.
ALTER TABLE one_on_ones
  ADD COLUMN IF NOT EXISTS meeting_form varchar(20) NOT NULL DEFAULT 'not_specified'
  CHECK (meeting_form IN ('not_specified', 'text_check_in', 'phone_call', 'zoom_meeting', 'in_person'));
