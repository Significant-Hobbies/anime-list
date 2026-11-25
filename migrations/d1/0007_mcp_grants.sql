-- Grants bind to the digest of a specific issued credential. Existing tokens remain read-only.
CREATE TABLE assistant_write_grants (
  token_hash TEXT PRIMARY KEY REFERENCES user_api_tokens(token_hash) ON DELETE CASCADE
);
