-- Keep membership and status in the original watchlists so the website, imports
-- and Schedule always see the same library as connected assistants.
CREATE TABLE library_details (
  user_id TEXT NOT NULL, media TEXT NOT NULL CHECK(media IN ('anime','manga')), mal_id TEXT NOT NULL,
  rating REAL CHECK (rating BETWEEN 1 AND 10), notes TEXT,
  created_at TEXT, updated_at TEXT, completed_at TEXT,
  PRIMARY KEY(user_id, media, mal_id)
);
-- Rows that predate timestamp tracking have no reliable dates.
INSERT INTO library_details(user_id,media,mal_id)
SELECT user_id,'anime',mal_id FROM anime_watchlist
UNION ALL SELECT user_id,'manga',mal_id FROM manga_watchlist;

CREATE TABLE library_tags (
  user_id TEXT NOT NULL, name TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY(user_id, name)
);
CREATE TABLE library_entry_tags (
  user_id TEXT NOT NULL, media TEXT NOT NULL, mal_id TEXT NOT NULL, name TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY(user_id, media, mal_id, name),
  FOREIGN KEY(user_id, media, mal_id) REFERENCES library_details(user_id, media, mal_id) ON DELETE CASCADE,
  FOREIGN KEY(user_id, name) REFERENCES library_tags(user_id, name) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_library_entry_tags_name ON library_entry_tags(user_id, name);

CREATE TRIGGER library_anime_created AFTER INSERT ON anime_watchlist BEGIN
  INSERT INTO library_details (user_id,media,mal_id,created_at,updated_at,completed_at)
  VALUES (NEW.user_id,'anime',NEW.mal_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),CASE WHEN (SELECT LOWER(name) IN ('done','completed') FROM user_tags WHERE user_id=NEW.user_id AND id=NEW.tag_id) THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') END)
  ON CONFLICT(user_id,media,mal_id) DO NOTHING;
END;

CREATE TRIGGER library_anime_updated AFTER UPDATE ON anime_watchlist
WHEN NEW.tag_id IS NOT OLD.tag_id OR NEW.note IS NOT OLD.note
BEGIN
  INSERT INTO library_details (user_id,media,mal_id,updated_at,completed_at)
  VALUES (NEW.user_id,'anime',NEW.mal_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),CASE WHEN NEW.tag_id IS NOT OLD.tag_id AND (SELECT LOWER(name) IN ('done','completed') FROM user_tags WHERE user_id=NEW.user_id AND id=NEW.tag_id) THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') END)
  ON CONFLICT(user_id,media,mal_id) DO UPDATE SET updated_at=excluded.updated_at,
    completed_at=iif(OLD.tag_id IS NEW.tag_id,library_details.completed_at,
      iif((SELECT LOWER(name) IN ('done','completed') FROM user_tags WHERE user_id=NEW.user_id AND id=NEW.tag_id),COALESCE(library_details.completed_at,excluded.completed_at),NULL));
END;

CREATE TRIGGER library_anime_removed AFTER DELETE ON anime_watchlist BEGIN
  DELETE FROM library_details WHERE user_id=OLD.user_id AND media='anime' AND mal_id=OLD.mal_id;
END;

CREATE TRIGGER library_manga_created AFTER INSERT ON manga_watchlist BEGIN
  INSERT INTO library_details (user_id,media,mal_id,created_at,updated_at,completed_at)
  VALUES (NEW.user_id,'manga',NEW.mal_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),CASE WHEN (SELECT LOWER(name) IN ('done','completed') FROM user_tags WHERE user_id=NEW.user_id AND id=NEW.tag_id) THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') END)
  ON CONFLICT(user_id,media,mal_id) DO NOTHING;
END;

CREATE TRIGGER library_manga_updated AFTER UPDATE ON manga_watchlist
WHEN NEW.tag_id IS NOT OLD.tag_id
BEGIN
  INSERT INTO library_details (user_id,media,mal_id,updated_at,completed_at)
  VALUES (NEW.user_id,'manga',NEW.mal_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),CASE WHEN NEW.tag_id IS NOT OLD.tag_id AND (SELECT LOWER(name) IN ('done','completed') FROM user_tags WHERE user_id=NEW.user_id AND id=NEW.tag_id) THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') END)
  ON CONFLICT(user_id,media,mal_id) DO UPDATE SET updated_at=excluded.updated_at,
    completed_at=iif(OLD.tag_id IS NEW.tag_id,library_details.completed_at,
      iif((SELECT LOWER(name) IN ('done','completed') FROM user_tags WHERE user_id=NEW.user_id AND id=NEW.tag_id),COALESCE(library_details.completed_at,excluded.completed_at),NULL));
END;

CREATE TRIGGER library_manga_removed AFTER DELETE ON manga_watchlist BEGIN
  DELETE FROM library_details WHERE user_id=OLD.user_id AND media='manga' AND mal_id=OLD.mal_id;
END;

CREATE VIEW assistant_library AS
SELECT entries.*, CASE lower(legacy_status)
  WHEN 'completed' THEN 'Done' WHEN 'done' THEN 'Done'
  WHEN 'watching' THEN 'Watching' WHEN 'reading' THEN 'Watching'
  WHEN 'deferred' THEN 'Delaying' WHEN 'delaying' THEN 'Delaying' WHEN 'on-hold' THEN 'Delaying'
  WHEN 'avoiding' THEN 'Dropped' WHEN 'dropped' THEN 'Dropped'
  ELSE legacy_status END AS status
FROM (
SELECT w.user_id, 'anime' AS media, w.mal_id, t.name AS legacy_status,
  COALESCE(NULLIF(c.title_english,''),NULLIF(c.title,''),NULLIF(w.title,''),'ID: ' || w.mal_id) AS title,
  c.year, c.score AS catalog_score,c.genres,c.themes,
  d.rating, w.note AS notes,d.created_at,d.updated_at,d.completed_at,
  (SELECT json_group_array(name) FROM library_entry_tags e
   WHERE e.user_id=w.user_id AND e.media='anime' AND e.mal_id=w.mal_id) AS tags
FROM anime_watchlist w
JOIN user_tags t ON t.user_id=w.user_id AND t.id=w.tag_id
LEFT JOIN anime_data c ON c.mal_id=w.mal_id
LEFT JOIN library_details d ON d.user_id=w.user_id AND d.media='anime' AND d.mal_id=w.mal_id
UNION ALL
SELECT w.user_id, 'manga' AS media, w.mal_id, t.name AS legacy_status,
  COALESCE(NULLIF(c.title_english,''),NULLIF(c.title,''),'ID: ' || w.mal_id) AS title,
  c.year, c.score AS catalog_score,c.genres,c.themes,
  d.rating, d.notes AS notes,d.created_at,d.updated_at,d.completed_at,
  (SELECT json_group_array(name) FROM library_entry_tags e
   WHERE e.user_id=w.user_id AND e.media='manga' AND e.mal_id=w.mal_id) AS tags
FROM manga_watchlist w
JOIN user_tags t ON t.user_id=w.user_id AND t.id=w.tag_id
LEFT JOIN manga_data c ON c.mal_id=w.mal_id
LEFT JOIN library_details d ON d.user_id=w.user_id AND d.media='manga' AND d.mal_id=w.mal_id
) entries;

CREATE TRIGGER library_tag_insert AFTER INSERT ON library_entry_tags BEGIN
  UPDATE library_details SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE user_id=NEW.user_id AND media=NEW.media AND mal_id=NEW.mal_id;
END;

CREATE TRIGGER library_tag_delete AFTER DELETE ON library_entry_tags BEGIN
  UPDATE library_details SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE user_id=OLD.user_id AND media=OLD.media AND mal_id=OLD.mal_id;
END;

CREATE TRIGGER library_tag_update AFTER UPDATE OF name ON library_entry_tags BEGIN
  UPDATE library_details SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE user_id=NEW.user_id AND media=NEW.media AND mal_id=NEW.mal_id;
END;
