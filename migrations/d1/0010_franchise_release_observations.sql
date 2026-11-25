-- Only live upstream observations produce events. A restore replays the original
-- history separately from metadata snapshots and must never synthesize changes.
DROP TRIGGER IF EXISTS assistant_release_first;
DROP TRIGGER IF EXISTS assistant_release_changed;
