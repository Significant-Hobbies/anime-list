import animeCatalog from "../cleaned_anime_data.json";
import {
  DEFAULT_ANIME_MIN_MEMBERS,
  DEFAULT_ANIME_PAGE_SIZE,
} from "./animeSearchDefaults";
import type { AnimeSummary, SearchResponse } from "./types";

type SeedAnime = {
  mal_id: number;
  url: string;
  title: string;
  title_english?: string;
  type?: string;
  score?: number;
  members?: number;
  favorites?: number;
  synopsis?: string;
  year?: number;
  status?: string;
  image?: string;
  genres?: Record<string, number>;
  themes?: Record<string, number>;
};

function truncateSynopsis(text?: string, max = 180): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

function isDefaultCatalogItem(anime: SeedAnime): boolean {
  return (
    typeof anime.score === "number" &&
    typeof anime.members === "number" &&
    typeof anime.favorites === "number" &&
    typeof anime.year === "number" &&
    anime.members >= DEFAULT_ANIME_MIN_MEMBERS
  );
}

function toSummary(anime: SeedAnime): AnimeSummary {
  const score = anime.score ?? 0;

  return {
    id: anime.mal_id,
    score,
    points: score,
    name: anime.title,
    title_english: anime.title_english,
    link: anime.url,
    synopsis: truncateSynopsis(anime.synopsis),
    members: anime.members ?? 0,
    favorites: anime.favorites ?? 0,
    year: anime.year ?? 0,
    status: anime.status ?? "",
    genres: Object.keys(anime.genres ?? {}),
    themes: Object.keys(anime.themes ?? {}),
    type: anime.type ?? "",
    image: anime.image,
  };
}

export function getInitialAnimeSearch(): SearchResponse {
  const filtered = (animeCatalog as SeedAnime[]).filter(isDefaultCatalogItem);
  const firstPage = [...filtered]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, DEFAULT_ANIME_PAGE_SIZE)
    .map(toSummary);

  return {
    totalFiltered: filtered.length,
    filteredList: firstPage,
  };
}
