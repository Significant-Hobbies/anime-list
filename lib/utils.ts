import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAnimeDetailHref(malId: number | string) {
  return `/anime/${malId}`;
}

export function getMangaDetailHref(malId: number | string) {
  return `/manga/${malId}`;
}
