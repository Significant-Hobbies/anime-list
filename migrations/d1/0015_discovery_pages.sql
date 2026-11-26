-- These pages contain only public ranking inputs. A source change evicts its
-- bucket transactionally. Generation checks prevent a stale backfill winning.
CREATE TABLE assistant_discovery_pages (
  media TEXT NOT NULL, bucket INTEGER NOT NULL, generation INTEGER NOT NULL DEFAULT 1,
  model TEXT, payload TEXT,
  PRIMARY KEY(media,bucket)
) WITHOUT ROWID;
INSERT INTO assistant_discovery_pages(media,bucket)
  SELECT 'anime', mal_id/128 FROM anime_data GROUP BY mal_id/128
  UNION ALL SELECT 'manga', mal_id/128 FROM manga_data GROUP BY mal_id/128;

DROP TRIGGER assistant_discovery_anime_data_insert;
CREATE TRIGGER assistant_discovery_anime_data_insert AFTER INSERT ON anime_data
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES('anime',NEW.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;

DROP TRIGGER assistant_discovery_anime_data_update;
CREATE TRIGGER assistant_discovery_anime_data_update AFTER UPDATE OF title, title_english, genres, themes, demographics, score, year, type, status, episodes, members, popularity, synopsis ON anime_data
WHEN OLD.title IS NOT NEW.title OR OLD.title_english IS NOT NEW.title_english OR OLD.genres IS NOT NEW.genres OR OLD.themes IS NOT NEW.themes OR OLD.demographics IS NOT NEW.demographics OR OLD.score IS NOT NEW.score OR OLD.year IS NOT NEW.year OR OLD.type IS NOT NEW.type OR OLD.status IS NOT NEW.status OR OLD.episodes IS NOT NEW.episodes OR OLD.members IS NOT NEW.members OR OLD.popularity IS NOT NEW.popularity OR OLD.synopsis IS NOT NEW.synopsis
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES('anime',NEW.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;

DROP TRIGGER assistant_discovery_anime_data_delete;
CREATE TRIGGER assistant_discovery_anime_data_delete AFTER DELETE ON anime_data
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES('anime',OLD.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;

DROP TRIGGER assistant_discovery_manga_data_insert;
CREATE TRIGGER assistant_discovery_manga_data_insert AFTER INSERT ON manga_data
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES('manga',NEW.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;

DROP TRIGGER assistant_discovery_manga_data_update;
CREATE TRIGGER assistant_discovery_manga_data_update AFTER UPDATE OF title, title_english, genres, themes, demographics, score, year, type, status, chapters, members, popularity, synopsis, available_languages, available_in_english ON manga_data
WHEN OLD.title IS NOT NEW.title OR OLD.title_english IS NOT NEW.title_english OR OLD.genres IS NOT NEW.genres OR OLD.themes IS NOT NEW.themes OR OLD.demographics IS NOT NEW.demographics OR OLD.score IS NOT NEW.score OR OLD.year IS NOT NEW.year OR OLD.type IS NOT NEW.type OR OLD.status IS NOT NEW.status OR OLD.chapters IS NOT NEW.chapters OR OLD.members IS NOT NEW.members OR OLD.popularity IS NOT NEW.popularity OR OLD.synopsis IS NOT NEW.synopsis OR OLD.available_languages IS NOT NEW.available_languages OR OLD.available_in_english IS NOT NEW.available_in_english
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES('manga',NEW.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;

DROP TRIGGER assistant_discovery_manga_data_delete;
CREATE TRIGGER assistant_discovery_manga_data_delete AFTER DELETE ON manga_data
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES('manga',OLD.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;

DROP TRIGGER assistant_discovery_assistant_anime_details_insert;
CREATE TRIGGER assistant_discovery_assistant_anime_details_insert AFTER INSERT ON assistant_anime_details
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES('anime',NEW.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;

DROP TRIGGER assistant_discovery_assistant_anime_details_update;
CREATE TRIGGER assistant_discovery_assistant_anime_details_update AFTER UPDATE OF aliases, studios, synopsis ON assistant_anime_details
WHEN OLD.aliases IS NOT NEW.aliases OR OLD.studios IS NOT NEW.studios OR OLD.synopsis IS NOT NEW.synopsis
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES('anime',NEW.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;

DROP TRIGGER assistant_discovery_assistant_anime_details_delete;
CREATE TRIGGER assistant_discovery_assistant_anime_details_delete AFTER DELETE ON assistant_anime_details
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES('anime',OLD.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;

DROP TRIGGER assistant_discovery_assistant_manga_details_insert;
CREATE TRIGGER assistant_discovery_assistant_manga_details_insert AFTER INSERT ON assistant_manga_details
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES('manga',NEW.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;

DROP TRIGGER assistant_discovery_assistant_manga_details_update;
CREATE TRIGGER assistant_discovery_assistant_manga_details_update AFTER UPDATE OF aliases, synopsis ON assistant_manga_details
WHEN OLD.aliases IS NOT NEW.aliases OR OLD.synopsis IS NOT NEW.synopsis
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES('manga',NEW.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;

DROP TRIGGER assistant_discovery_assistant_manga_details_delete;
CREATE TRIGGER assistant_discovery_assistant_manga_details_delete AFTER DELETE ON assistant_manga_details
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES('manga',OLD.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;

DROP TRIGGER assistant_discovery_catalog_title_metadata_insert;
CREATE TRIGGER assistant_discovery_catalog_title_metadata_insert AFTER INSERT ON catalog_title_metadata
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES(NEW.media,NEW.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;

DROP TRIGGER assistant_discovery_catalog_title_metadata_update;
CREATE TRIGGER assistant_discovery_catalog_title_metadata_update AFTER UPDATE OF aliases, studios ON catalog_title_metadata
WHEN OLD.aliases IS NOT NEW.aliases OR OLD.studios IS NOT NEW.studios
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES(NEW.media,NEW.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;

DROP TRIGGER assistant_discovery_catalog_title_metadata_delete;
CREATE TRIGGER assistant_discovery_catalog_title_metadata_delete AFTER DELETE ON catalog_title_metadata
BEGIN
  UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
  INSERT INTO assistant_discovery_pages(media,bucket) VALUES(OLD.media,OLD.mal_id/128)
  ON CONFLICT(media,bucket) DO UPDATE SET generation=generation+1,model=NULL,payload=NULL;
END;
