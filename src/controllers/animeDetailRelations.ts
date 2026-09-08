import type { BaseAnimeItem } from '../types/anime';
import type { AnimeDetailResponse, AnimeRelation } from '../types/animeDetail';

export function enrichAnimeRelations(
  relations: AnimeRelation[],
  animeMap: ReadonlyMap<number, BaseAnimeItem>
): AnimeDetailResponse['relations'] {
  return relations.flatMap((group) =>
    group.entries.map((entry) => {
      // MAL anime and manga IDs are separate namespaces; numeric IDs collide.
      const relatedAnime = entry.type === 'anime' ? animeMap.get(entry.mal_id) : undefined;
      return {
        mal_id: entry.mal_id,
        relation: group.relation,
        title: relatedAnime?.title || entry.name,
        title_english: relatedAnime?.title_english,
        image: relatedAnime?.image,
        type: relatedAnime?.type || entry.type,
        status: relatedAnime?.status,
        episodes: relatedAnime?.episodes,
        year: relatedAnime?.year,
        url: relatedAnime?.url || entry.url,
      };
    })
  );
}
