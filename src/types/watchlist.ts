export type WatchTag = string;

interface UserInfo {
  id: string;
  name: string;
}

export interface WatchedAnime {
  status: WatchTag;
  id: string;
  title?: string;
  type?: string;
  episodes?: number;
  note?: string;
  [key: string]: string | number | undefined;
}

export interface WatchedManga {
  status: WatchTag;
  id: string;
  [key: string]: string | number | undefined;
}

export interface WatchlistData {
  user: UserInfo;
  anime: Record<string, WatchedAnime>;
}

export interface MangaWatchlistData {
  user: UserInfo;
  manga: Record<string, WatchedManga>;
}

export interface WatchlistTag {
  id: string;
  tag: WatchTag;
  count: number;
  color: string;
}
