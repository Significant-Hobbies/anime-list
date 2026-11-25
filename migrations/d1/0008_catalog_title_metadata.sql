CREATE TABLE catalog_title_metadata (
  media TEXT NOT NULL CHECK (media IN ('anime','manga')),
  mal_id INTEGER NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  studios TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (media,mal_id)
);
