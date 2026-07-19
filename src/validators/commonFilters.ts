import { z } from 'zod';
import { FilterAction } from '../config';

const comparisonActionSchema = z.enum([
  FilterAction.Equals,
  FilterAction.GreaterThan,
  FilterAction.GreaterThanOrEquals,
  FilterAction.LessThan,
  FilterAction.LessThanOrEquals,
] as const);

const arrayIncludesActionSchema = z.enum([
  FilterAction.IncludesAll,
  FilterAction.IncludesAny,
] as const);

const textSearchActionSchema = z.enum([FilterAction.Equals, FilterAction.Contains] as const);

type RefinePath = Array<string | number>;

export interface ArrayFieldValidators<Field extends string> {
  validateValues?: (field: Field, values: string[], ctx: z.RefinementCtx, path: RefinePath) => void;
  validateMultiplier?: (
    field: Field,
    multiplier: Record<string, number>,
    ctx: z.RefinementCtx
  ) => void;
}

export const createNumericFilterSchema = <Field extends string>(
  fieldSchema: z.ZodEnum<[Field, ...Field[]]>
) =>
  z.object({
    field: fieldSchema,
    action: comparisonActionSchema,
    value: z.number(),
    score_multiplier: z.number().optional(),
  });

export const createArrayFilterSchemas = <Field extends string>(
  fieldSchema: z.ZodEnum<[Field, ...Field[]]>,
  validators?: ArrayFieldValidators<Field>
) => {
  const includesSchema = z
    .object({
      field: fieldSchema,
      action: arrayIncludesActionSchema,
      value: z.array(z.string().min(1)),
      score_multiplier: z.record(z.number()).optional(),
    })
    .superRefine((data, ctx) => {
      const field = data.field as Field;
      validators?.validateValues?.(field, data.value, ctx, ['value']);
      if (data.score_multiplier) {
        validators?.validateMultiplier?.(field, data.score_multiplier, ctx);
      }
    });

  const excludesSchema = z
    .object({
      field: fieldSchema,
      action: z.literal(FilterAction.Excludes),
      value: z.union([z.string().min(1), z.array(z.string().min(1))]),
      score_multiplier: z.record(z.number()).optional(),
    })
    .superRefine((data, ctx) => {
      const field = data.field as Field;
      const values = Array.isArray(data.value) ? data.value : [data.value];
      validators?.validateValues?.(field, values, ctx, ['value']);
    });

  return { includesSchema, excludesSchema };
};

export const createStringFilterSchemas = <Field extends string>(
  fieldSchema: z.ZodEnum<[Field, ...Field[]]>
) => {
  const textSchema = z.object({
    field: fieldSchema,
    action: textSearchActionSchema,
    value: z.string().min(1),
    score_multiplier: z.number().optional(),
  });

  const includesSchema = z.object({
    field: fieldSchema,
    action: arrayIncludesActionSchema,
    value: z.array(z.string().min(1)),
    score_multiplier: z.number().optional(),
  });

  const excludesSchema = z.object({
    field: fieldSchema,
    action: z.literal(FilterAction.Excludes),
    value: z.union([z.string().min(1), z.array(z.string().min(1))]),
    score_multiplier: z.number().optional(),
  });

  return { textSchema, includesSchema, excludesSchema };
};

export const createBooleanFilterSchema = <Field extends string>(
  fieldSchema: z.ZodEnum<[Field, ...Field[]]>
) =>
  z.object({
    field: fieldSchema,
    action: z.literal(FilterAction.Equals),
    value: z.boolean(),
    score_multiplier: z.number().optional(),
  });

export const createFilterUnion = <T>(schemas: z.ZodTypeAny[]): z.ZodType<T> => {
  if (schemas.length === 0) {
    throw new Error('At least one schema is required to create a filter union');
  }

  if (schemas.length === 1) {
    return schemas[0] as unknown as z.ZodType<T>;
  }

  const [first, second, ...rest] = schemas;
  return z.union([first, second, ...rest] as [
    z.ZodTypeAny,
    z.ZodTypeAny,
    ...z.ZodTypeAny[],
  ]) as z.ZodType<T>;
};

export const createFiltersArraySchema = <T>(filterSchema: z.ZodType<T>): z.ZodArray<z.ZodType<T>> =>
  z.array(filterSchema);
