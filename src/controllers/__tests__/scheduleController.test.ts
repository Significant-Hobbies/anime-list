import { getAnimeWatchlist, upsertAnimeWatchlist } from "../../db/watchlist";
import { getSchedule, upsertScheduleItems } from "../../db/schedule";
import { animeStore } from "../../store/animeStore";
import {
  addScheduleItems,
  buildScheduleTimelineResponse,
} from "../../services/scheduleService";

jest.mock("../../db/watchlist", () => ({
  getAnimeWatchlist: jest.fn(),
  upsertAnimeWatchlist: jest.fn(),
}));

jest.mock("../../db/schedule", () => ({
  getSchedule: jest.fn(),
  upsertScheduleItems: jest.fn(),
  updateScheduleItem: jest.fn(),
  removeScheduleItems: jest.fn(),
  reorderSchedule: jest.fn(),
}));

jest.mock("../../store/animeStore", () => ({
  animeStore: {
    getAnimeList: jest.fn(),
  },
}));

const mockedGetAnimeWatchlist = jest.mocked(getAnimeWatchlist);
const mockedUpsertAnimeWatchlist = jest.mocked(upsertAnimeWatchlist);
const mockedGetSchedule = jest.mocked(getSchedule);
const mockedUpsertScheduleItems = jest.mocked(upsertScheduleItems);
const mockedGetAnimeList = jest.mocked(animeStore.getAnimeList);

describe("scheduleService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not backfill schedule rows from watchlist items marked Watching", async () => {
    mockedGetSchedule.mockResolvedValue([]);
    mockedGetAnimeWatchlist.mockResolvedValue({
      user: { id: "user-1", name: "User" },
      anime: {
        "1": {
          id: "1",
          status: "Watching",
        },
      },
    });
    mockedGetAnimeList.mockResolvedValue([
      {
        mal_id: 1,
        url: "https://myanimelist.net/anime/1",
        title: "Cowboy Bebop",
        title_english: "Cowboy Bebop",
        type: "TV",
        episodes: 26,
        score: 8.7,
        genres: {},
        themes: {},
        demographics: {},
      },
    ] as any);

    const result = await buildScheduleTimelineResponse("user-1");

    expect(mockedUpsertScheduleItems).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
  });

  it("keeps watchlist status as display-only metadata for scheduled items", async () => {
    mockedGetSchedule.mockResolvedValue([
      {
        mal_id: "1",
        episodes_per_day: 3,
        sort_order: 0,
        episodes_watched: 0,
      },
    ]);
    mockedGetAnimeWatchlist.mockResolvedValue({
      user: { id: "user-1", name: "User" },
      anime: {
        "1": {
          id: "1",
          status: "Done",
        },
      },
    });
    mockedGetAnimeList.mockResolvedValue([
      {
        mal_id: 1,
        url: "https://myanimelist.net/anime/1",
        title: "Cowboy Bebop",
        title_english: "Cowboy Bebop",
        type: "TV",
        episodes: 26,
        score: 8.7,
        genres: {},
        themes: {},
        demographics: {},
      },
    ] as any);

    const result = await buildScheduleTimelineResponse("user-1");

    expect(mockedUpsertScheduleItems).not.toHaveBeenCalled();
    expect(result.items).toEqual([
      expect.objectContaining({
        mal_id: "1",
        watchStatus: "Done",
      }),
    ]);
  });

  it("does not add watchlist entries when adding anime to the schedule", async () => {
    await addScheduleItems("user-1", ["1"], 4);

    expect(mockedUpsertScheduleItems).toHaveBeenCalledWith("user-1", [
      { malId: "1", episodesPerDay: 4 },
    ]);
    expect(mockedUpsertAnimeWatchlist).not.toHaveBeenCalled();
  });
});
