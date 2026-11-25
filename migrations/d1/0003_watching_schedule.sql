-- Manual plans keep their original rows. Watching titles need storage only
-- when the owner changes progress, reorders them, or removes them from the plan.
CREATE TABLE watching_schedule_preferences (
  user_id TEXT NOT NULL,
  mal_id TEXT NOT NULL,
  episodes_per_day INTEGER NOT NULL DEFAULT 3,
  episodes_watched INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER,
  hidden INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, mal_id),
  FOREIGN KEY (user_id, mal_id) REFERENCES anime_watchlist(user_id, mal_id) ON DELETE CASCADE
);

CREATE VIEW schedule_queue AS
SELECT user_id, mal_id, episodes_per_day, episodes_watched, sort_order
FROM anime_schedule
UNION ALL
SELECT w.user_id, w.mal_id, COALESCE(p.episodes_per_day, 3),
       COALESCE(p.episodes_watched, 0), p.sort_order
FROM anime_watchlist w
JOIN user_tags t ON t.user_id = w.user_id AND t.id = w.tag_id AND t.name = 'Watching'
LEFT JOIN watching_schedule_preferences p ON p.user_id = w.user_id AND p.mal_id = w.mal_id
WHERE COALESCE(p.hidden, 0) = 0
  AND NOT EXISTS (
    SELECT 1 FROM anime_schedule s WHERE s.user_id = w.user_id AND s.mal_id = w.mal_id
  );

-- Start a fresh automatic plan each time a title enters Watching.
CREATE TRIGGER clear_schedule_preferences_on_status_change
AFTER UPDATE OF tag_id ON anime_watchlist
WHEN OLD.tag_id <> NEW.tag_id AND EXISTS (
  SELECT 1 FROM user_tags WHERE user_id = NEW.user_id AND id IN (OLD.tag_id, NEW.tag_id) AND name <> 'Watching'
)
BEGIN
  DELETE FROM watching_schedule_preferences WHERE user_id = OLD.user_id AND mal_id = OLD.mal_id;
END;
