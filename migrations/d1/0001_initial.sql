PRAGMA defer_foreign_keys = true;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  picture TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

CREATE TABLE anime_watchlist (
  user_id TEXT NOT NULL DEFAULT 'default',
  mal_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  title TEXT,
  type TEXT,
  episodes INTEGER,
  note TEXT,
  PRIMARY KEY (user_id, mal_id)
);

CREATE TABLE manga_watchlist (
  user_id TEXT NOT NULL DEFAULT 'default',
  mal_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (user_id, mal_id)
);

CREATE TABLE anime_dismissals (
  user_id TEXT NOT NULL,
  mal_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, mal_id)
);

CREATE TABLE anime_schedule (
  user_id TEXT NOT NULL,
  mal_id TEXT NOT NULL,
  episodes_per_day INTEGER NOT NULL DEFAULT 3,
  sort_order INTEGER NOT NULL DEFAULT 0,
  episodes_watched INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, mal_id)
);

CREATE TABLE anime_data (
  mal_id INTEGER PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  title_english TEXT,
  type TEXT,
  episodes INTEGER,
  aired_from TEXT,
  aired_to TEXT,
  score REAL,
  scored_by INTEGER,
  rank INTEGER,
  status TEXT,
  popularity INTEGER,
  members INTEGER,
  favorites INTEGER,
  synopsis TEXT,
  year INTEGER,
  season TEXT,
  image TEXT,
  genres TEXT,
  themes TEXT,
  demographics TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT
);

CREATE TABLE manga_data (
  mal_id INTEGER PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  title_english TEXT,
  type TEXT,
  chapters INTEGER,
  volumes INTEGER,
  published_from TEXT,
  published_to TEXT,
  score REAL,
  scored_by INTEGER,
  rank INTEGER,
  status TEXT,
  popularity INTEGER,
  members INTEGER,
  favorites INTEGER,
  synopsis TEXT,
  year INTEGER,
  image TEXT,
  has_colored INTEGER,
  is_completed INTEGER,
  available_in_english INTEGER,
  available_languages TEXT,
  genres TEXT NOT NULL DEFAULT '{}',
  themes TEXT NOT NULL DEFAULT '{}',
  demographics TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE anime_relations_cache (
  mal_id INTEGER PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE anime_recommendations_cache (
  mal_id INTEGER PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE saved_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  filters_json TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app',
  frequency TEXT NOT NULL DEFAULT 'daily',
  paused INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE saved_search_alerts (
  id TEXT PRIMARY KEY,
  saved_search_id TEXT NOT NULL,
  mal_id TEXT NOT NULL,
  title_type TEXT NOT NULL DEFAULT 'anime',
  title TEXT,
  match_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  seen_at TEXT,
  UNIQUE(saved_search_id, mal_id, title_type)
);

CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'public',
  cover_mode TEXT NOT NULL DEFAULT 'posters',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE collection_items (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  mal_id TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'anime',
  position INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(collection_id, mal_id, media_type)
);

CREATE TABLE user_api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);

CREATE INDEX idx_user_tags_user ON user_tags(user_id);
CREATE INDEX idx_user_tags_user_lower_name ON user_tags(user_id, lower(name));
CREATE UNIQUE INDEX idx_user_tags_user_name ON user_tags(user_id, name);
CREATE INDEX idx_watchlist_user ON anime_watchlist(user_id);
CREATE INDEX idx_watchlist_tag_id ON anime_watchlist(tag_id);
CREATE INDEX idx_watchlist_user_tag ON anime_watchlist(user_id, tag_id);
CREATE INDEX idx_manga_watchlist_user ON manga_watchlist(user_id);
CREATE INDEX idx_manga_watchlist_tag_id ON manga_watchlist(tag_id);
CREATE INDEX idx_manga_watchlist_user_tag ON manga_watchlist(user_id, tag_id);
CREATE INDEX idx_anime_dismissals_user ON anime_dismissals(user_id);
CREATE INDEX idx_schedule_user ON anime_schedule(user_id);
CREATE INDEX idx_anime_score ON anime_data(score);
CREATE INDEX idx_anime_year ON anime_data(year);
CREATE INDEX idx_anime_members ON anime_data(members);
CREATE INDEX idx_anime_favorites ON anime_data(favorites);
CREATE INDEX idx_manga_data_score ON manga_data(score);
CREATE INDEX idx_manga_data_members ON manga_data(members);
CREATE INDEX idx_manga_data_year ON manga_data(year);
CREATE INDEX idx_anime_relations_cache_fetched_at ON anime_relations_cache(fetched_at);
CREATE INDEX idx_anime_recommendations_cache_fetched_at ON anime_recommendations_cache(fetched_at);
CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX idx_saved_search_alerts_search ON saved_search_alerts(saved_search_id);
CREATE INDEX idx_saved_search_alerts_unseen ON saved_search_alerts(saved_search_id, seen_at);
CREATE INDEX idx_collections_user ON collections(user_id);
CREATE INDEX idx_collection_items_collection ON collection_items(collection_id);
CREATE INDEX idx_user_api_tokens_user ON user_api_tokens(user_id);
CREATE INDEX idx_user_api_tokens_hash ON user_api_tokens(token_hash);
