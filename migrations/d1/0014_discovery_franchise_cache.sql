-- Franchise-filtered discovery reads live membership. Other catalog projections
-- are independent of graph edits, and result-page franchise labels are always live.
DROP TRIGGER assistant_discovery_assistant_franchise_edges_insert;
DROP TRIGGER assistant_discovery_assistant_franchise_edges_update;
DROP TRIGGER assistant_discovery_assistant_franchise_edges_delete;
DROP TRIGGER assistant_discovery_assistant_manga_edges_insert;
DROP TRIGGER assistant_discovery_assistant_manga_edges_update;
DROP TRIGGER assistant_discovery_assistant_manga_edges_delete;

DROP TRIGGER assistant_discovery_assistant_anime_details_update;
CREATE TRIGGER assistant_discovery_assistant_anime_details_update AFTER UPDATE OF aliases, studios, synopsis ON assistant_anime_details
WHEN OLD.aliases IS NOT NEW.aliases OR OLD.studios IS NOT NEW.studios OR OLD.synopsis IS NOT NEW.synopsis
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;

DROP TRIGGER assistant_discovery_assistant_manga_details_update;
CREATE TRIGGER assistant_discovery_assistant_manga_details_update AFTER UPDATE OF aliases, synopsis ON assistant_manga_details
WHEN OLD.aliases IS NOT NEW.aliases OR OLD.synopsis IS NOT NEW.synopsis
BEGIN UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1; END;
UPDATE assistant_discovery_revision SET revision=revision+1 WHERE singleton=1;
