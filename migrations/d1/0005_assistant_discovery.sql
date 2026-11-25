CREATE TABLE assistant_discovery_preferences (
  user_id TEXT PRIMARY KEY,
  hard_filters TEXT NOT NULL DEFAULT '{}',
  preferences TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE assistant_recommendation_feedback (
  user_id TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('anime','manga')),
  mal_id INTEGER NOT NULL,
  signal TEXT NOT NULL CHECK (signal IN ('like','dislike','dismiss','neutral')),
  reason TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, media_type, mal_id)
);
CREATE INDEX assistant_feedback_recent ON assistant_recommendation_feedback(user_id, updated_at DESC, media_type, mal_id);
