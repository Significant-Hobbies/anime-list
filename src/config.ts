export enum AnimeField {
  MalId = "mal_id",
  Url = "url",
  Title = "title",
  TitleEnglish = "title_english",
  Type = "type",
  Episodes = "episodes",
  Aired = "aired",
  Score = "score",
  ScoredBy = "scored_by",
  Rank = "rank",
  Popularity = "popularity",
  Members = "members",
  Favorites = "favorites",
  Year = "year",
  Season = "season",
  Synopsis = "synopsis",
  Genres = "genres",
  Themes = "themes",
  Demographics = "demographics",
}

export enum FilterAction {
  Equals = "EQUALS",
  GreaterThan = "GREATER_THAN",
  GreaterThanOrEquals = "GREATER_THAN_OR_EQUALS",
  LessThan = "LESS_THAN",
  LessThanOrEquals = "LESS_THAN_OR_EQUALS",
  IncludesAll = "INCLUDES_ALL",
  IncludesAny = "INCLUDES_ANY",
  Excludes = "EXCLUDES",
  Contains = "CONTAINS",
}

export enum Genre {
  Comedy = "Comedy",
  Action = "Action",
  Fantasy = "Fantasy",
  Adventure = "Adventure",
  SciFi = "Sci-Fi",
  Drama = "Drama",
  Romance = "Romance",
  Hentai = "Hentai",
  Supernatural = "Supernatural",
  SliceOfLife = "Slice of Life",
  Mystery = "Mystery",
  Ecchi = "Ecchi",
  Sports = "Sports",
  Horror = "Horror",
  AvantGarde = "Avant Garde",
  Suspense = "Suspense",
  AwardWinning = "Award Winning",
  BoysLove = "Boys Love",
  Gourmet = "Gourmet",
  GirlsLove = "Girls Love",
  Erotica = "Erotica",
}

export enum Theme {
  Music = "Music",
  School = "School",
  Historical = "Historical",
  Mecha = "Mecha",
  Military = "Military",
  AdultCast = "Adult Cast",
  Parody = "Parody",
  Mythology = "Mythology",
  SuperPower = "Super Power",
  MartialArts = "Martial Arts",
  Space = "Space",
  Harem = "Harem",
  Psychological = "Psychological",
  Isekai = "Isekai",
  IdolsFemale = "Idols (Female)",
  Anthropomorphic = "Anthropomorphic",
  Detective = "Detective",
  MahouShoujo = "Mahou Shoujo",
  StrategyGame = "Strategy Game",
  TeamSports = "Team Sports",
  Gore = "Gore",
  CGDCT = "CGDCT",
  GagHumor = "Gag Humor",
  Samurai = "Samurai",
  UrbanFantasy = "Urban Fantasy",
  Workplace = "Workplace",
  Iyashikei = "Iyashikei",
  Vampire = "Vampire",
  Racing = "Racing",
  IdolsMale = "Idols (Male)",
  TimeTravel = "Time Travel",
  VideoGame = "Video Game",
  Reincarnation = "Reincarnation",
  PerformingArts = "Performing Arts",
  OtakuCulture = "Otaku Culture",
  LovePolygon = "Love Polygon",
  Pets = "Pets",
  OrganizedCrime = "Organized Crime",
  CombatSports = "Combat Sports",
  VisualArts = "Visual Arts",
  ReverseHarem = "Reverse Harem",
  Survival = "Survival",
  Educational = "Educational",
  Childcare = "Childcare",
  Delinquents = "Delinquents",
  Crossdressing = "Crossdressing",
  HighStakesGame = "High Stakes Game",
  Medical = "Medical",
  Showbiz = "Showbiz",
  LoveStatusQuo = "Love Status Quo",
  MagicalSexShift = "Magical Sex Shift",
  Villainess = "Villainess",
}

export const API_CONFIG = {
  baseUrl: "https://api.jikan.moe/v4",
  endpoints: {
    topAnime: "/top/anime",
    topManga: "/top/manga",
    userHistory: "/users",
    seasons: "/seasons",
    currentSeason: "/seasons/now",
  },
  rateLimit: 1000, // 1 call per second (safe within 3/sec, 60/min limits)
  totalPages: 10000,
} as const;

const DATA_DIR = process.env.DATA_DIR || ".";

export const FILE_PATHS = {
  animeData: `${DATA_DIR}/anime_data.json`,
  cleanAnimeData: `${DATA_DIR}/cleaned_anime_data.json`,
  userWatchList: `${DATA_DIR}/user_watchedlist_data.json`,
  mangaData: `${DATA_DIR}/manga_data.json`,
  cleanMangaData: `${DATA_DIR}/cleaned_manga_data.json`,
  userMangaWatchList: `${DATA_DIR}/user_manga_watchedlist_data.json`,
};

export const DISTRIBUTION_RANGES = {
  score: [7, 8, 9],
  members: [100000, 1000000],
  favorites: [1000, 10000, 100000],
  years: [2000, 2010, 2020],
} as const;

/** Manga catalog uses lower popularity thresholds than anime. */
export const MANGA_DISTRIBUTION_RANGES = {
  score: [7, 7.5, 8, 8.5],
  members: [1000, 10000, 50000, 100000],
  favorites: [10, 100, 1000, 5000],
  years: [1990, 2000, 2010, 2020],
} as const;

export const PERCENTILE_FIELDS = {
  score: AnimeField.Score,
  members: AnimeField.Members,
  favorites: AnimeField.Favorites,
  years: AnimeField.Year,
} as const;
