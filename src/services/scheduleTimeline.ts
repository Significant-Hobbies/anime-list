export interface EnrichedScheduleItem {
  mal_id: string;
  episodes_per_day: number;
  sort_order: number;
  episodes_watched: number;
  title: string;
  image?: string;
  episodes?: number;
  type?: string;
  score?: number;
  url?: string;
  watchStatus: string;
}

interface TimelineEntry {
  mal_id: string;
  title: string;
  image?: string;
  episodes_today: number;
  episode_range: [number, number];
  is_final_day: boolean;
}

export interface TimelineDay {
  day: number;
  date: string;
  entries: TimelineEntry[];
}

export function computeTimeline(
  items: EnrichedScheduleItem[],
  startDate: Date = new Date()
): {
  timeline: TimelineDay[];
  stats: {
    total_episodes: number;
    total_days: number;
    start_date: string;
    finish_date: string;
  };
} {
  const timeline: TimelineDay[] = [];
  let currentDay = 0;
  let totalEpisodes = 0;

  for (const item of items) {
    const totalEps = item.episodes ?? 0;
    if (totalEps === 0) continue;
    totalEpisodes += totalEps;
    const epd = item.episodes_per_day;
    const days = Math.ceil(totalEps / epd);

    for (let d = 0; d < days; d++) {
      const episodesThisDay = Math.min(epd, totalEps - d * epd);
      const startEp = d * epd + 1;
      const endEp = startEp + episodesThisDay - 1;
      const date = new Date(startDate);
      date.setDate(date.getDate() + currentDay);

      let dayEntry = timeline.find((t) => t.day === currentDay);
      if (!dayEntry) {
        dayEntry = {
          day: currentDay,
          date: date.toISOString().split('T')[0],
          entries: [],
        };
        timeline.push(dayEntry);
      }

      dayEntry.entries.push({
        mal_id: item.mal_id,
        title: item.title,
        image: item.image,
        episodes_today: episodesThisDay,
        episode_range: [startEp, endEp],
        is_final_day: d === days - 1,
      });

      currentDay++;
    }
  }

  const startDateStr = startDate.toISOString().split('T')[0];
  const finishDate = new Date(startDate);
  finishDate.setDate(finishDate.getDate() + Math.max(0, currentDay - 1));

  return {
    timeline,
    stats: {
      total_episodes: totalEpisodes,
      total_days: currentDay,
      start_date: startDateStr,
      finish_date: finishDate.toISOString().split('T')[0],
    },
  };
}
