[← Home](https://anime.significanthobbies.com/)

# MCP Server

Canonical: https://anime.significanthobbies.com/mcp

Anime List exposes an MCP (Model Context Protocol) server so AI tools like ChatGPT, Claude Desktop, or Cursor can find anime and manga, compare seasons, and track your list. Connect your account for personal discovery. Grant write permission to save changes you request.

Endpoint:  https://anime.significanthobbies.com/api/mcp

## Public tools (no auth)

- semantic_search  — Find stories by synopsis, trope, or a natural-language description.

- get_similar_titles  — Find titles similar to one or more catalog entries.

- get_streaming_links  — Look up provider-listed streaming services for an anime.

- get_franchise  — Explore connected seasons and adaptations by catalog ID.

- get_seasonal_anime  — Browse releases by year and season.

- search_anime  — Search with filters and sorting. Use the recommended sort with a connected account for personalized results.

- search_manga  — Search manga with filters and sorting.

- list_search_fields  — Find available filter fields for anime or manga.

- list_filter_actions  — Find available comparison and array filter actions.

- get_anime_detail  — Full detail for one anime by MAL id.

- get_manga_detail  — Full detail for one manga by MAL id.

- get_anime_stats  — Aggregate stats over the anime catalog.

- get_random_anime  — Random anime, optionally filtered by genre.

## Personal tools

- get_watchlist  — Filter your anime and manga by status, tags or rating and page through the results.

- get_watchlist_entry  — Read one season or manga entry by catalog ID.

- get_user_preferences / update_user_preferences  — Inspect, save or clear your discovery preferences.

- record_recommendation_feedback / get_recommendation_feedback  — Record a reaction or read earlier feedback.

- list_library_tags / manage_watchlist_tags  — List, create, rename or remove personal classifications.

- get_released_sequels / get_upcoming_sequels  — Find sequels to completed titles.

- set_franchise_monitor / get_franchise_updates  — Follow release changes in selected franchises.

- discover_titles  — Find candidates using your history and saved preferences.

- get_watchlist_stats  — Count tracked seasons and manga entries by status and personal rating.

- upsert_watchlist_entries  — Save statuses, notes, tags, or optional ratings with write permission.

- remove_watchlist_entries  — Remove explicitly selected entries with write permission.

- get_manga_watchlist_enriched  — Your manga list with titles, chapters, genres, and scores.

- list_watchlist  — Your anime watchlist with statuses.

- list_manga_watchlist  — Your manga watchlist with statuses.

- list_watchlist_tags  — Legacy watch statuses with per-status counts.

- get_watchlist_enriched  — Your watchlist joined with catalog metadata (title, image, score, genres).

## Client configuration

Add the server to your AI tool. For watchlist tools, create a token below and replace <paste-token-here> with it. Older tokens have read-only access, including through the REST API. For writes, create a token with write permission.

For ChatGPT, connect with OAuth at  https://anime-mcp.significanthobbies.com/anime-list/mcp . Grant write access to change your list or preferences.

### Claude Desktop

  Copy

```
{
  "mcpServers": {
    "anime-list": {
      "command": "npx",
      "args": ["mcp-remote", "https://anime.significanthobbies.com/api/mcp", "--header", "Authorization: ${AUTHORIZATION_HEADER}"],
      "env": { "AUTHORIZATION_HEADER": "Bearer <paste-token-here>" }
    }
  }
}
```

Cursor and other MCP clients: use the same URL with an Authorization: Bearer anime_list_… header.

Sign in to create and manage Personal Access Tokens for watchlist access.

Personal tokens and account data are excluded.
