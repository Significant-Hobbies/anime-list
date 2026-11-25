-- Only public catalog data is cached. The revision changes in the same D1
-- transaction as the mutation, including ordinary daily/quarterly imports.
CREATE TABLE assistant_discovery_revision (singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL);
INSERT INTO assistant_discovery_revision VALUES (1,1);

CREATE TRIGGER assistant_discovery_anime_data_insert AFTER INSERT ON anime_data
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER assistant_discovery_anime_data_update AFTER UPDATE OF title, title_english, genres, themes, demographics, score, year, type, status, episodes, members, popularity, synopsis ON anime_data
WHEN OLD.title IS NOT NEW.title OR OLD.title_english IS NOT NEW.title_english OR OLD.genres IS NOT NEW.genres OR OLD.themes IS NOT NEW.themes OR OLD.demographics IS NOT NEW.demographics OR OLD.score IS NOT NEW.score OR OLD.year IS NOT NEW.year OR OLD.type IS NOT NEW.type OR OLD.status IS NOT NEW.status OR OLD.episodes IS NOT NEW.episodes OR OLD.members IS NOT NEW.members OR OLD.popularity IS NOT NEW.popularity OR OLD.synopsis IS NOT NEW.synopsis
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER assistant_discovery_anime_data_delete AFTER DELETE ON anime_data
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;

CREATE TRIGGER assistant_discovery_manga_data_insert AFTER INSERT ON manga_data
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER assistant_discovery_manga_data_update AFTER UPDATE OF title, title_english, genres, themes, demographics, score, year, type, status, chapters, members, popularity, synopsis, available_languages, available_in_english ON manga_data
WHEN OLD.title IS NOT NEW.title OR OLD.title_english IS NOT NEW.title_english OR OLD.genres IS NOT NEW.genres OR OLD.themes IS NOT NEW.themes OR OLD.demographics IS NOT NEW.demographics OR OLD.score IS NOT NEW.score OR OLD.year IS NOT NEW.year OR OLD.type IS NOT NEW.type OR OLD.status IS NOT NEW.status OR OLD.chapters IS NOT NEW.chapters OR OLD.members IS NOT NEW.members OR OLD.popularity IS NOT NEW.popularity OR OLD.synopsis IS NOT NEW.synopsis OR OLD.available_languages IS NOT NEW.available_languages OR OLD.available_in_english IS NOT NEW.available_in_english
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER assistant_discovery_manga_data_delete AFTER DELETE ON manga_data
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;

CREATE TRIGGER assistant_discovery_assistant_anime_details_insert AFTER INSERT ON assistant_anime_details
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER assistant_discovery_assistant_anime_details_update AFTER UPDATE OF aliases, studios ON assistant_anime_details
WHEN OLD.aliases IS NOT NEW.aliases OR OLD.studios IS NOT NEW.studios
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER assistant_discovery_assistant_anime_details_delete AFTER DELETE ON assistant_anime_details
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;

CREATE TRIGGER assistant_discovery_assistant_manga_details_insert AFTER INSERT ON assistant_manga_details
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER assistant_discovery_assistant_manga_details_update AFTER UPDATE OF aliases ON assistant_manga_details
WHEN OLD.aliases IS NOT NEW.aliases
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER assistant_discovery_assistant_manga_details_delete AFTER DELETE ON assistant_manga_details
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;

CREATE TRIGGER assistant_discovery_catalog_title_metadata_insert AFTER INSERT ON catalog_title_metadata
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER assistant_discovery_catalog_title_metadata_update AFTER UPDATE OF aliases, studios ON catalog_title_metadata
WHEN OLD.aliases IS NOT NEW.aliases OR OLD.studios IS NOT NEW.studios
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER assistant_discovery_catalog_title_metadata_delete AFTER DELETE ON catalog_title_metadata
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;

CREATE TRIGGER assistant_discovery_assistant_franchise_edges_insert AFTER INSERT ON assistant_franchise_edges
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER assistant_discovery_assistant_franchise_edges_update AFTER UPDATE OF source_id, target_type, target_id, relation ON assistant_franchise_edges
WHEN OLD.source_id IS NOT NEW.source_id OR OLD.target_type IS NOT NEW.target_type OR OLD.target_id IS NOT NEW.target_id OR OLD.relation IS NOT NEW.relation
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER assistant_discovery_assistant_franchise_edges_delete AFTER DELETE ON assistant_franchise_edges
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;

CREATE TRIGGER assistant_discovery_assistant_manga_edges_insert AFTER INSERT ON assistant_manga_edges
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER assistant_discovery_assistant_manga_edges_update AFTER UPDATE OF source_id, target_type, target_id, relation ON assistant_manga_edges
WHEN OLD.source_id IS NOT NEW.source_id OR OLD.target_type IS NOT NEW.target_type OR OLD.target_id IS NOT NEW.target_id OR OLD.relation IS NOT NEW.relation
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER assistant_discovery_assistant_manga_edges_delete AFTER DELETE ON assistant_manga_edges
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
