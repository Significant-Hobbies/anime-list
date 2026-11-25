# Anime List MCP

Connect ChatGPT to the [hosted account endpoint](https://anime-mcp.significanthobbies.com/anime-list/mcp) using OAuth. Other MCP clients can use the [product endpoint](https://anime.significanthobbies.com/api/mcp) with a personal access token issued on the [connections page](https://anime.significanthobbies.com/mcp). Catalog tools also work anonymously on the product endpoint.

## Discovery

- `search_anime` and `search_manga` accept a title query, typed field/operator filters, sortBy, pagesize (1–100), and offset. Follow nextCall for the next page. For example, use `{"filters":[{"field":"score","action":"GREATER_THAN_OR_EQUALS","value":7}],"pagesize":20,"offset":0}`.
- `semantic_search` ranks titles using synopsis embeddings, keywords, and normalized tropes. `get_similar_titles` accepts a media type and MAL ID as a reference. `discover_titles` also uses the connected account's ratings, feedback, and saved preferences. Done and Dropped are excluded by default. Request-specific filters override matching saved fields.
- `get_franchise`, `get_released_sequels`, and `get_upcoming_sequels` use media-qualified catalog relationships. Check the returned coverage before concluding a franchise has no further sequels. `get_seasonal_anime` includes provider-listed upcoming titles. `get_streaming_links` reports provider-listed services where available. `set_franchise_monitor` and `get_franchise_updates` track observed release changes.
- `get_anime_detail` and `get_manga_detail` return extended metadata. All tools publish their inputs and outputs through `tools/list`.

## Personal library

Each anime season or manga catalog entry has its own ID and status. Use `get_watchlist`, `get_watchlist_entry`, and `get_watchlist_stats` for private reads. Counts refer to individual catalog entries. Older entries may have unknown creation or completion dates.

`upsert_watchlist_entries` accepts up to 50 anime and manga entries. Omitted fields preserve their values. A null personal rating clears it. Ratings range from 1 to 10. `remove_watchlist_entries` removes the selected entries. Check each per-entry outcome before reporting a bulk change. `manage_watchlist_tags` and `list_library_tags` handle classifications. `list_watchlist_tags` retains the legacy status-bucket interface.

`get_user_preferences` and `update_user_preferences` manage saved discovery settings. `record_recommendation_feedback` and `get_recommendation_feedback` store reactions separately from watch status.

Private reads require account access. Mutations also require delegated write permission and an explicit user request for that change. Existing read-only grants and tokens retain read-only access. The hosted connector can request additional consent. Personal-token users can create a write-enabled token on the connections page.
