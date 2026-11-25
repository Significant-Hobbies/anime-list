-- MAL anime and manga IDs occupy separate namespaces. Preserve the provider's
-- directed labels so adaptations, crossovers and shared characters never
-- imply an anime sequel or a required place in a viewing order.
CREATE TABLE assistant_franchise_edges (
  source_id INTEGER NOT NULL,
  relation TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  target_title TEXT NOT NULL,
  PRIMARY KEY (source_id, relation, target_type, target_id)
);
CREATE INDEX assistant_franchise_edges_target ON assistant_franchise_edges(target_type, target_id, source_id);

CREATE VIEW assistant_cached_relations AS
SELECT c.mal_id AS source_id, LOWER(TRIM(g.value ->> '$.relation')) AS relation,
       LOWER(TRIM(e.value ->> '$.type')) AS target_type, e.value ->> '$.mal_id' AS target_id,
       COALESCE(e.value ->> '$.name', '') AS target_title
FROM anime_relations_cache c,
     json_each(CASE WHEN json_valid(c.payload) THEN c.payload ELSE '[]' END) g,
     json_each(CASE WHEN g.type='object' THEN g.value ELSE '{}' END, '$.entries') e
WHERE CASE WHEN e.type='object' THEN json_type(e.value, '$.mal_id') END = 'integer' AND (e.value ->> '$.mal_id') > 0
  AND (e.value ->> '$.type') IN ('anime', 'manga') AND (g.value ->> '$.relation') IS NOT NULL;

INSERT OR IGNORE INTO assistant_franchise_edges SELECT * FROM assistant_cached_relations;
CREATE TRIGGER assistant_relations_insert AFTER INSERT ON anime_relations_cache BEGIN
  DELETE FROM assistant_franchise_edges WHERE source_id = NEW.mal_id;
  INSERT OR IGNORE INTO assistant_franchise_edges SELECT * FROM assistant_cached_relations WHERE source_id = NEW.mal_id;
END;
CREATE TRIGGER assistant_relations_update AFTER UPDATE ON anime_relations_cache BEGIN
  DELETE FROM assistant_franchise_edges WHERE source_id = OLD.mal_id;
  INSERT OR IGNORE INTO assistant_franchise_edges SELECT * FROM assistant_cached_relations WHERE source_id = NEW.mal_id;
END;
CREATE TRIGGER assistant_relations_delete AFTER DELETE ON anime_relations_cache BEGIN
  DELETE FROM assistant_franchise_edges WHERE source_id = OLD.mal_id;
END;

CREATE VIEW assistant_franchise_member_edges AS
SELECT source_id, target_id, relation FROM assistant_franchise_edges
WHERE target_type = 'anime' AND source_id <> target_id AND relation IN
('sequel','prequel','side story','parent story','spin-off','alternative version',
 'alternative setting','summary','full story','compilation','contains');
CREATE VIEW assistant_sequel_edges AS
SELECT source_id AS earlier, target_id AS later FROM assistant_franchise_member_edges WHERE relation = 'sequel'
UNION ALL SELECT target_id, source_id FROM assistant_franchise_member_edges WHERE relation = 'prequel';

CREATE TABLE assistant_anime_details (
  mal_id INTEGER PRIMARY KEY, title TEXT NOT NULL, title_english TEXT,
  aliases TEXT NOT NULL, studios TEXT NOT NULL, status TEXT, aired_from TEXT, aired_to TEXT,
  season TEXT, year INTEGER, format TEXT, episodes INTEGER, synopsis TEXT, streaming TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE assistant_franchise_monitors (
  user_id TEXT NOT NULL, mal_id INTEGER NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, mal_id)
);
CREATE TABLE assistant_release_events (
  id INTEGER PRIMARY KEY, mal_id INTEGER NOT NULL, observed_at TEXT NOT NULL,
  previous_status TEXT, status TEXT, previous_start TEXT, scheduled_start TEXT
);
CREATE INDEX assistant_release_events_title ON assistant_release_events(mal_id, observed_at);
CREATE TABLE assistant_provider_attempts (mal_id INTEGER PRIMARY KEY, attempted_at TEXT NOT NULL);
CREATE TRIGGER assistant_release_first AFTER INSERT ON assistant_anime_details BEGIN
  INSERT INTO assistant_release_events(mal_id,observed_at,status,scheduled_start)
    VALUES(NEW.mal_id,NEW.updated_at,NEW.status,NEW.aired_from);
END;
CREATE TRIGGER assistant_release_changed AFTER UPDATE ON assistant_anime_details
WHEN OLD.status IS NOT NEW.status OR OLD.aired_from IS NOT NEW.aired_from BEGIN
  INSERT INTO assistant_release_events(mal_id,observed_at,previous_status,status,previous_start,scheduled_start)
    VALUES(NEW.mal_id,NEW.updated_at,OLD.status,NEW.status,OLD.aired_from,NEW.aired_from);
END;

CREATE TABLE assistant_manga_details (
  mal_id INTEGER PRIMARY KEY, title TEXT NOT NULL, title_english TEXT, aliases TEXT NOT NULL,
  status TEXT, published_from TEXT, synopsis TEXT, format TEXT, chapters INTEGER, volumes INTEGER,
  updated_at TEXT NOT NULL
);
CREATE TABLE assistant_manga_edges (
  source_id INTEGER NOT NULL, relation TEXT NOT NULL, target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL, target_title TEXT NOT NULL,
  PRIMARY KEY(source_id,relation,target_type,target_id)
);
CREATE INDEX assistant_manga_edges_target ON assistant_manga_edges(target_type,target_id,source_id);
CREATE TABLE assistant_manga_attempts (mal_id INTEGER PRIMARY KEY, attempted_at TEXT NOT NULL);
CREATE VIEW assistant_all_relations AS
  SELECT 'anime' AS source_type,e.* FROM assistant_franchise_edges e
  UNION ALL SELECT 'manga',e.* FROM assistant_manga_edges e;
CREATE VIEW assistant_media_membership AS
  SELECT source_type,source_id,target_type,target_id FROM assistant_all_relations
  WHERE relation IN ('prequel','sequel','side story','parent story','spin-off','alternative version',
    'alternative setting','summary','full story','compilation','contains','adaptation','source');
CREATE VIEW assistant_manga_sequel_edges AS
SELECT source_id AS earlier,target_id AS later FROM assistant_manga_edges WHERE target_type='manga' AND relation='sequel'
UNION ALL SELECT target_id,source_id FROM assistant_manga_edges WHERE target_type='manga' AND relation='prequel';
