import { z } from 'zod';
import { AnimeField, Genre, Theme } from '../config';
import {
  ARRAY_FIELDS,
  type ArrayField,
  type Filter,
  type NumericField,
  NUMERIC_FIELDS,
  STRING_FIELDS,
  type StringField,
} from '../types/anime';
import {
  createArrayFilterSchemas,
  createFilterUnion,
  createFiltersArraySchema,
  createNumericFilterSchema,
  createStringFilterSchemas,
} from './commonFilters';
import { watchTagSchema } from './watchTags';

const getValidCategories = (field: ArrayField): Set<string> => {
  if (field === AnimeField.Genres) return new Set<string>(Object.values(Genre));
  if (field === AnimeField.Themes) return new Set<string>(Object.values(Theme));
  return new Set();
};

const ensureValidCategories = (
  field: ArrayField,
  values: string[],
  ctx: z.RefinementCtx,
  path: (string | number)[]
): void => {
  const validCategories = getValidCategories(field);
  if (validCategories.size === 0) {
    return;
  }

  const invalidValues = values.filter((value) => !validCategories.has(value as Genre | Theme));

  if (invalidValues.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid ${field} values: ${invalidValues.join(', ')}`,
      path,
    });
  }
};

const ensureValidMultiplierCategories = (
  field: ArrayField,
  multiplier: Record<string, number>,
  ctx: z.RefinementCtx
): void => {
  const validCategories = getValidCategories(field);
  if (validCategories.size === 0) {
    return;
  }

  const invalidKeys = Object.keys(multiplier).filter(
    (key) => !validCategories.has(key as Genre | Theme)
  );

  if (invalidKeys.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid categories in score_multiplier: ${invalidKeys.join(', ')}`,
      path: ['score_multiplier'],
    });
  }
};

const numericFieldSchema = z.enum(NUMERIC_FIELDS as [NumericField, ...NumericField[]]);
const arrayFieldSchema = z.enum(ARRAY_FIELDS as [ArrayField, ...ArrayField[]]);
const stringFieldSchema = z.enum(STRING_FIELDS as [StringField, ...StringField[]]);

const numericFilterSchema = createNumericFilterSchema(numericFieldSchema);

const { includesSchema: arrayFilterIncludesSchema, excludesSchema: arrayFilterExcludesSchema } =
  createArrayFilterSchemas(arrayFieldSchema, {
    validateValues: ensureValidCategories,
    validateMultiplier: ensureValidMultiplierCategories,
  });

const {
  textSchema: stringTextFilterSchema,
  includesSchema: stringIncludesFilterSchema,
  excludesSchema: stringExcludesFilterSchema,
} = createStringFilterSchemas(stringFieldSchema);

const filterSchema = createFilterUnion<Filter>([
  numericFilterSchema,
  arrayFilterIncludesSchema,
  arrayFilterExcludesSchema,
  stringTextFilterSchema,
  stringIncludesFilterSchema,
  stringExcludesFilterSchema,
]);

const filtersSchema = createFiltersArraySchema(filterSchema);

const airingSchema = z.enum(['yes', 'no', 'any'] as const);

export const filterRequestSchema = z
  .object({
    filters: filtersSchema,
    hideWatched: z.array(watchTagSchema).default([]),
    includeWatched: z.array(watchTagSchema).default([]),
    pagesize: z.number().int().min(1).default(40),
    offset: z.number().int().min(0).default(0),
    sortBy: numericFieldSchema.optional(),
    airing: airingSchema.default('any'),
  })
  .refine((data) => !(data.hideWatched.length > 0 && data.includeWatched.length > 0), {
    message: 'Cannot use both hideWatched and includeWatched at the same time',
  });
