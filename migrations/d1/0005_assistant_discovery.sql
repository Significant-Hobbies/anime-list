CREATE TABLE assistant_discovery_preferences (
  user_id TEXT PRIMARY KEY,
  hard_filters TEXT NOT NULL DEFAULT '{}',
  preferences TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CONSTRAINT assistant_preference_bounds CHECK (
    (json_extract(hard_filters,'$.min_score') <= json_extract(hard_filters,'$.max_score') OR json_extract(hard_filters,'$.min_score') IS NULL OR json_extract(hard_filters,'$.max_score') IS NULL) AND
    (json_extract(hard_filters,'$.min_year') <= json_extract(hard_filters,'$.max_year') OR json_extract(hard_filters,'$.min_year') IS NULL OR json_extract(hard_filters,'$.max_year') IS NULL) AND
    (json_extract(hard_filters,'$.min_episodes') <= json_extract(hard_filters,'$.max_episodes') OR json_extract(hard_filters,'$.min_episodes') IS NULL OR json_extract(hard_filters,'$.max_episodes') IS NULL) AND
    (json_extract(hard_filters,'$.min_chapters') <= json_extract(hard_filters,'$.max_chapters') OR json_extract(hard_filters,'$.min_chapters') IS NULL OR json_extract(hard_filters,'$.max_chapters') IS NULL) AND
    (json_extract(hard_filters,'$.min_members') <= json_extract(hard_filters,'$.max_members') OR json_extract(hard_filters,'$.min_members') IS NULL OR json_extract(hard_filters,'$.max_members') IS NULL) AND
    (json_extract(hard_filters,'$.min_popularity') <= json_extract(hard_filters,'$.max_popularity') OR json_extract(hard_filters,'$.min_popularity') IS NULL OR json_extract(hard_filters,'$.max_popularity') IS NULL) AND
    (json_extract(hard_filters,'$.min_user_rating') <= json_extract(hard_filters,'$.max_user_rating') OR json_extract(hard_filters,'$.min_user_rating') IS NULL OR json_extract(hard_filters,'$.max_user_rating') IS NULL)
  )
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
