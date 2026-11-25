import { getSchedule, upsertScheduleItems } from '../db/schedule';
import { computeTimeline } from './scheduleTimeline';

export async function buildScheduleTimelineResponse(userId: string) {
  const items = await getSchedule(userId);
  const { timeline, stats } = computeTimeline(items);
  return { items, timeline, stats };
}

export async function addScheduleItems(userId: string, malIds: string[], episodesPerDay: number) {
  await upsertScheduleItems(
    userId,
    malIds.map((id) => ({ malId: id, episodesPerDay: episodesPerDay }))
  );
}
