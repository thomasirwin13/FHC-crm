-- In-app notifications for team members
CREATE TABLE IF NOT EXISTS notifications (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  team_id bigint NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications (user_id, read, created_at DESC)
  WHERE read = false;
CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = get_app_user_id());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = get_app_user_id());
