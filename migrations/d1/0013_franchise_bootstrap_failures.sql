CREATE TABLE assistant_bootstrap_failures (
  media TEXT NOT NULL, mal_id INTEGER NOT NULL, reason TEXT NOT NULL,
  observed_at TEXT NOT NULL, retry_after TEXT NOT NULL, PRIMARY KEY(media,mal_id)
);

DROP TRIGGER assistant_relations_update;
CREATE TRIGGER assistant_relations_update AFTER UPDATE ON anime_relations_cache
WHEN OLD.payload IS NOT NEW.payload OR OLD.mal_id IS NOT NEW.mal_id BEGIN
  DELETE FROM assistant_franchise_edges WHERE source_id=OLD.mal_id;
  INSERT OR IGNORE INTO assistant_franchise_edges SELECT * FROM assistant_cached_relations WHERE source_id=NEW.mal_id;
END;
