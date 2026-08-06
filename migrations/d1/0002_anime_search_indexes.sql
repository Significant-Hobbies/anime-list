-- Keep the catalogue browse path in index order so LIMIT can stop early.
-- `members` is included where it is not already the leading column because
-- the discover UI applies a popularity threshold by default.
CREATE INDEX IF NOT EXISTS idx_anime_score_members
  ON anime_data(score DESC, mal_id ASC, members);

CREATE INDEX IF NOT EXISTS idx_anime_search_members
  ON anime_data(members DESC, mal_id ASC);

CREATE INDEX IF NOT EXISTS idx_anime_search_year
  ON anime_data(year DESC, mal_id ASC, members);

CREATE INDEX IF NOT EXISTS idx_anime_search_favorites
  ON anime_data(favorites DESC, mal_id ASC, members);
