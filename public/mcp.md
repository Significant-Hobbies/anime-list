[← Home](https://anime.significanthobbies.com/)

# MCP Server

Canonical: https://anime.significanthobbies.com/mcp

Anime List exposes an MCP (Model Context Protocol) server so AI tools like ChatGPT, Claude Desktop, or Cursor can search the complete catalog and read your watchlist. Search and watchlist tools return up to 100 results per page. Pass nextCall to tools/call until it is null to retrieve every match with the same filters and sort.

Endpoint:  https://anime.significanthobbies.com/api/mcp

## Public tools (no auth)

- search_anime  — Search with filters and sorting. Use the recommended sort with a connected account for personalized results.

- search_manga  — Search manga with filters and sorting.

- list_search_fields  — Find available filter fields for anime or manga.

- list_filter_actions  — Find available comparison and array filter actions.

- get_anime_detail  — Full detail for one anime by MAL id.

- get_manga_detail  — Full detail for one manga by MAL id.

- get_anime_stats  — Aggregate stats over the anime catalog.

- get_random_anime  — Random anime, optionally filtered by genre.

## Watchlist tools (require a token)

- get_manga_watchlist_enriched  — Your manga list with titles, chapters, genres, and scores.

- list_watchlist  — Your anime watchlist with statuses.

- list_manga_watchlist  — Your manga watchlist with statuses.

- list_watchlist_tags  — Your watchlist tags with per-tag counts.

- get_watchlist_enriched  — Your watchlist joined with catalog metadata (title, image, score, genres).

## Client configuration

Add the server to your AI tool. For watchlist tools, create a token below and replace <paste-token-here> with it.

### Claude Desktop

  Copy

```
{
  "mcpServers": {
    "anime-list": {
      "command": "npx",
      "args": ["mcp-remote", "https://anime.significanthobbies.com/api/mcp"],
      "env": { "AUTHORIZATION_HEADER": "Bearer <paste-token-here>" }
    }
  }
}
```

Cursor and other MCP clients: use the same URL with an Authorization: Bearer anime_list_… header.

Sign in to create and manage Personal Access Tokens for watchlist access.

Personal tokens and account data are excluded.
