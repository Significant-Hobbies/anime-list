import { z } from 'zod';
import {
  MANGA_ARRAY_FIELDS,
  MANGA_BOOLEAN_FIELDS,
  MANGA_NUMERIC_FIELDS,
  MANGA_STRING_FIELDS,
  type MangaArrayField,
  type MangaBooleanField,
  type MangaFilter,
  type MangaNumericField,
  type MangaStringField,
} from '../types/manga';
import {
  createArrayFilterSchemas,
  createBooleanFilterSchema,
  createFilterUnion,
  createFiltersArraySchema,
  createNumericFilterSchema,
  createStringFilterSchemas,
} from './commonFilters';
import { watchTagSchema } from './watchTags';

const numericFieldSchema = z.enum(
  MANGA_NUMERIC_FIELDS as [MangaNumericField, ...MangaNumericField[]]
);
const arrayFieldSchema = z.enum(MANGA_ARRAY_FIELDS as [MangaArrayField, ...MangaArrayField[]]);
const stringFieldSchema = z.enum(MANGA_STRING_FIELDS as [MangaStringField, ...MangaStringField[]]);
const booleanFieldSchema = z.enum(
  MANGA_BOOLEAN_FIELDS as [MangaBooleanField, ...MangaBooleanField[]]
);

const numericFilterSchema = createNumericFilterSchema(numericFieldSchema);
const { includesSchema: arrayFilterIncludesSchema, excludesSchema: arrayFilterExcludesSchema } =
  createArrayFilterSchemas(arrayFieldSchema);
const {
  textSchema: stringTextFilterSchema,
  includesSchema: stringIncludesFilterSchema,
  excludesSchema: stringExcludesFilterSchema,
} = createStringFilterSchemas(stringFieldSchema);
const booleanFilterSchema = createBooleanFilterSchema(booleanFieldSchema);

const mangaFilterSchema = createFilterUnion<MangaFilter>([
  numericFilterSchema,
  arrayFilterIncludesSchema,
  arrayFilterExcludesSchema,
  stringTextFilterSchema,
  stringIncludesFilterSchema,
  stringExcludesFilterSchema,
  booleanFilterSchema,
]);

const mangaFiltersSchema = createFiltersArraySchema(mangaFilterSchema);

export const mangaFilterRequestSchema = z.object({
  filters: mangaFiltersSchema,
  hideWatched: z.array(watchTagSchema).default([]),
  pagesize: z.number().int().min(1).default(50),
  offset: z.number().int().min(0).default(0),
  sortBy: numericFieldSchema.optional(),
});

export type MangaFilterRequestBody = z.infer<typeof mangaFilterRequestSchema> & {
  sortBy?: MangaNumericField;
};
