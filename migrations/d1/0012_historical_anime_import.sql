-- Capture the existing completion date before the membership triggers run.
-- Applying an imported status is not an observation of when someone finished a show.
CREATE VIEW anime_watchlist_import AS
SELECT w.user_id, w.mal_id, w.tag_id, w.title, w.type, w.episodes, w.note, d.completed_at
FROM anime_watchlist w LEFT JOIN library_details d
ON d.user_id=w.user_id AND d.media='anime' AND d.mal_id=w.mal_id;

CREATE TRIGGER import_historical_anime INSTEAD OF INSERT ON anime_watchlist_import BEGIN
  INSERT INTO anime_watchlist(user_id, mal_id, tag_id, title, type, episodes, note)
  VALUES(NEW.user_id, NEW.mal_id, NEW.tag_id, NEW.title, NEW.type, NEW.episodes, NEW.note)
  ON CONFLICT(user_id, mal_id) DO UPDATE SET
    tag_id=excluded.tag_id,
    title=COALESCE(excluded.title, anime_watchlist.title),
    type=COALESCE(excluded.type, anime_watchlist.type),
    episodes=COALESCE(excluded.episodes, anime_watchlist.episodes),
    note=COALESCE(excluded.note, anime_watchlist.note);

  UPDATE library_details SET completed_at=NEW.completed_at
  WHERE user_id=NEW.user_id AND media='anime' AND mal_id=NEW.mal_id
    AND completed_at IS NOT NEW.completed_at
    AND EXISTS (SELECT 1 FROM user_tags WHERE user_id=NEW.user_id AND id=NEW.tag_id
                AND lower(name) IN ('completed','done'));
END;
