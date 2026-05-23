"use client";

import type { SearchFilter, FieldOptions, FilterActions } from "@/lib/types";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const GENRES = [
  "Comedy", "Action", "Fantasy", "Adventure", "Sci-Fi", "Drama", "Romance",
  "Supernatural", "Slice of Life", "Mystery", "Ecchi", "Sports", "Horror",
  "Avant Garde", "Suspense", "Award Winning", "Boys Love", "Gourmet", "Girls Love",
];

const THEMES = [
  "Music", "School", "Historical", "Mecha", "Military", "Adult Cast", "Parody",
  "Mythology", "Super Power", "Martial Arts", "Space", "Harem", "Psychological",
  "Isekai", "Anthropomorphic", "Detective", "Mahou Shoujo", "Strategy Game",
  "Team Sports", "Gore", "CGDCT", "Gag Humor", "Samurai", "Urban Fantasy",
  "Workplace", "Iyashikei", "Vampire", "Racing", "Time Travel", "Video Game",
  "Reincarnation", "Performing Arts", "Otaku Culture", "Love Polygon", "Pets",
  "Organized Crime", "Combat Sports", "Visual Arts", "Reverse Harem", "Survival",
  "Educational", "Childcare", "Delinquents", "Crossdressing", "High Stakes Game",
  "Medical", "Showbiz", "Love Status Quo", "Villainess",
];

const DEMOGRAPHICS = ["Shounen", "Shoujo", "Seinen", "Josei", "Kids"];

const SEASONS = ["winter", "spring", "summer", "fall"];
const ANIME_TYPES = ["TV", "Movie", "OVA", "ONA", "Special", "Music"];
const MANGA_TYPES = ["Manga", "Novel", "Light Novel", "One-shot", "Doujin", "Manhwa", "Manhua", "OEL"];
const VALUE_SELECT_FIELDS = new Set(["type", "season"]);
const TEXT_ACTIONS = ["CONTAINS", "EQUALS", "EXCLUDES"];
const ENUM_ACTIONS = ["EQUALS", "EXCLUDES"];

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  title_english: "English Title",
  synopsis: "Synopsis",
  score: "Score",
  scored_by: "Scored By",
  rank: "Rank",
  popularity: "Popularity",
  members: "Members",
  favorites: "Favorites",
  year: "Year",
  episodes: "Episodes",
  genres: "Genres",
  themes: "Themes",
  demographics: "Demographics",
  type: "Type",
  season: "Season",
};

const ACTION_LABELS: Record<string, string> = {
  EQUALS: "is",
  CONTAINS: "contains",
  EXCLUDES: "is not",
  GREATER_THAN: "greater than",
  GREATER_THAN_OR_EQUALS: "at least",
  LESS_THAN: "less than",
  LESS_THAN_OR_EQUALS: "at most",
  INCLUDES_ALL: "includes all",
  INCLUDES_ANY: "includes any",
};

interface Props {
  filter: SearchFilter;
  index: number;
  fields: FieldOptions;
  actions: FilterActions;
  mediaType?: "anime" | "manga";
  onChange: (index: number, filter: SearchFilter) => void;
  onRemove: (index: number) => void;
}

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? humanize(field);
}

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? humanize(action.toLowerCase());
}

function isValueSelectField(field: string): boolean {
  return VALUE_SELECT_FIELDS.has(field);
}

function getActionsForField(
  field: string,
  fields: FieldOptions,
  actions: FilterActions
): string[] {
  if (fields.numeric.includes(field)) return [...actions.comparison];
  if (fields.array.includes(field)) return [...actions.array];
  if (isValueSelectField(field)) return [...ENUM_ACTIONS];
  return [...TEXT_ACTIONS];
}

function isArrayField(field: string, fields: FieldOptions): boolean {
  return fields.array.includes(field);
}

function getDefaultAction(
  field: string,
  fields: FieldOptions,
  actions: FilterActions
): string {
  if (fields.numeric.includes(field)) {
    return field === "rank" || field === "popularity"
      ? "LESS_THAN_OR_EQUALS"
      : "GREATER_THAN_OR_EQUALS";
  }
  if (fields.array.includes(field)) {
    return actions.array.includes("INCLUDES_ANY") ? "INCLUDES_ANY" : actions.array[0] || "INCLUDES_ANY";
  }
  if (isValueSelectField(field)) return "EQUALS";
  return "CONTAINS";
}

function getValueOptions(field: string, mediaType: "anime" | "manga"): string[] | null {
  if (field === "genres") return GENRES;
  if (field === "themes") return THEMES;
  if (field === "demographics") return DEMOGRAPHICS;
  if (field === "season") return SEASONS;
  if (field === "type") return mediaType === "manga" ? MANGA_TYPES : ANIME_TYPES;
  if (field === "status") {
    return ["Publishing", "Finished", "On Hiatus", "Discontinued", "Not yet published"];
  }
  return null;
}

export default function FilterRow({
  filter,
  index,
  fields,
  actions,
  mediaType = "anime",
  onChange,
  onRemove,
}: Props) {
  const allFields = [...fields.numeric, ...fields.array, ...fields.string];
  const availableActions = getActionsForField(filter.field, fields, actions);
  const isArray = isArrayField(filter.field, fields);
  const valueOptions = getValueOptions(filter.field, mediaType);
  const normalizedAction = availableActions.includes(filter.action) ? filter.action : availableActions[0];
  const normalizedValue = isArray
    ? Array.isArray(filter.value) ? filter.value : []
    : Array.isArray(filter.value) ? filter.value[0] ?? "" : filter.value;
  
  const normalizedFilter: SearchFilter = {
    ...filter,
    action: normalizedAction,
    value: normalizedValue,
  };

  const handleFieldChange = (field: string) => {
    onChange(index, {
      ...normalizedFilter,
      field,
      action: getDefaultAction(field, fields, actions),
      value: isArrayField(field, fields) ? [] : "",
    });
  };

  const handleValueChange = (value: string) => {
    if (isArray) {
      const current = Array.isArray(normalizedFilter.value) ? normalizedFilter.value : [];
      const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      onChange(index, { ...normalizedFilter, value: updated });
    } else if (fields.numeric.includes(filter.field)) {
      onChange(index, { ...normalizedFilter, value: value === "" ? "" : Number(value) });
    } else {
      onChange(index, { ...normalizedFilter, value });
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 bg-surface p-4 rounded-sm border border-outline/5 transition-all hover:border-outline/20">
      <div className="flex gap-3 flex-1">
        <select
          value={normalizedFilter.field}
          onChange={(e) => handleFieldChange(e.target.value)}
          className="h-10 bg-surface-container-low border border-outline/10 px-3 text-[10px] font-black tracking-widest uppercase text-white rounded-sm focus:border-primary focus:outline-none min-w-[140px]"
        >
          {allFields.map((f) => (
            <option key={f} value={f}>{getFieldLabel(f)}</option>
          ))}
        </select>

        <select
          value={normalizedFilter.action}
          onChange={(e) => onChange(index, { ...normalizedFilter, action: e.target.value })}
          className="h-10 bg-surface-container-low border border-outline/10 px-3 text-[10px] font-black tracking-widest uppercase text-primary rounded-sm focus:border-primary focus:outline-none min-w-[140px]"
        >
          {availableActions.map((a) => (
            <option key={a} value={a}>{getActionLabel(a)}</option>
          ))}
        </select>
      </div>

      <div className="flex-[2] flex flex-wrap gap-2">
        {isArray && valueOptions ? (
          valueOptions.map((opt) => {
            const selected = Array.isArray(filter.value) && filter.value.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => handleValueChange(opt)}
                className={cn(
                  "px-3 py-1 border text-[9px] font-black tracking-widest uppercase rounded-sm transition-all",
                  selected ? "bg-primary/20 text-primary border-primary" : "bg-surface-container-highest/20 border-outline/10 text-white/30 hover:text-white"
                )}
              >
                {opt}
              </button>
            );
          })
        ) : valueOptions ? (
          <select
            value={typeof normalizedFilter.value === "string" ? normalizedFilter.value : ""}
            onChange={(e) => handleValueChange(e.target.value)}
            className="h-10 w-full bg-surface-container-low border border-outline/10 px-3 text-[10px] font-black tracking-widest uppercase text-white rounded-sm focus:border-primary focus:outline-none"
          >
            <option value="">SELECT VALUE...</option>
            {valueOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            type={fields.numeric.includes(filter.field) ? "number" : "text"}
            value={normalizedFilter.value as string | number}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="INPUT PARAMETER..."
            className="h-10 w-full bg-surface-container-low border border-outline/10 px-4 text-[10px] font-black tracking-widest uppercase text-white placeholder:text-white/10 rounded-sm focus:border-primary focus:outline-none"
          />
        )}
      </div>

      <button
        onClick={() => onRemove(index)}
        className="h-10 w-10 flex items-center justify-center text-white/20 hover:text-error transition-colors md:ml-2"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}