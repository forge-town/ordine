import type { ExecutionError, ExecutionJsonObject } from "@repo/schemas";
import { Result } from "neverthrow";
import { z } from "zod/v4";
import { executionError } from "./errors";
import { jsonValueEqual } from "./jsonValueEqual";

const keywords = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "minItems",
  "maxItems",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "enum",
  "const",
]);
const types = new Set(["object", "array", "string", "number", "integer", "boolean", "null"]);
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const compile = (schema: Record<string, unknown>): z.ZodType => {
  for (const key of Object.keys(schema))
    if (!keywords.has(key)) throw new Error("Unsupported JSON Schema keyword");
  if (schema.type !== undefined && (typeof schema.type !== "string" || !types.has(schema.type)))
    throw new Error("Unsupported JSON Schema type");
  const requireType = (keys: string[], type: string) => {
    if (keys.some((key) => Object.hasOwn(schema, key)) && schema.type !== type)
      throw new Error("JSON Schema keyword requires an explicit matching type");
  };
  requireType(["properties", "required", "additionalProperties"], "object");
  requireType(["items", "minItems", "maxItems"], "array");
  requireType(["minLength", "maxLength"], "string");
  if (
    (schema.minimum !== undefined || schema.maximum !== undefined) &&
    schema.type !== "number" &&
    schema.type !== "integer"
  )
    throw new Error("Numeric bounds require a numeric type");
  for (const key of ["minItems", "maxItems", "minLength", "maxLength"]) {
    if (
      schema[key] !== undefined &&
      (typeof schema[key] !== "number" || !Number.isInteger(schema[key]) || schema[key] < 0)
    )
      throw new Error("Invalid JSON Schema bound");
  }
  for (const key of ["minimum", "maximum"])
    if (
      schema[key] !== undefined &&
      (typeof schema[key] !== "number" || !Number.isFinite(schema[key]))
    )
      throw new Error("Invalid numeric bound");
  for (const [minimum, maximum] of [
    ["minItems", "maxItems"],
    ["minLength", "maxLength"],
    ["minimum", "maximum"],
  ]) {
    const lower = schema[minimum!];
    const upper = schema[maximum!];
    if (typeof lower === "number" && typeof upper === "number" && lower > upper)
      throw new Error("Inverted JSON Schema bounds");
  }

  const result = { schema: z.unknown() as z.ZodType };
  if (schema.type === "object") {
    if (schema.properties !== undefined && !isObject(schema.properties))
      throw new Error("Properties must be a schema map");
    const properties = (schema.properties ?? {}) as Record<string, unknown>;
    if (
      schema.required !== undefined &&
      (!Array.isArray(schema.required) ||
        schema.required.some((key) => typeof key !== "string") ||
        new Set(schema.required).size !== schema.required.length)
    )
      throw new Error("Required must contain unique property names");
    const required = new Set((schema.required ?? []) as string[]);
    for (const key of required)
      if (!Object.hasOwn(properties, key))
        throw new Error("Required properties must have a declared schema");
    if (
      schema.additionalProperties !== undefined &&
      typeof schema.additionalProperties !== "boolean"
    )
      throw new Error("Only boolean additionalProperties is supported");
    const shape: Record<string, z.ZodType> = Object.create(null);
    for (const [key, value] of Object.entries(properties)) {
      if (!isObject(value)) throw new Error("Property schema must be an object");
      const child = compile(value);
      shape[key] = required.has(key) ? child : child.optional();
    }
    result.schema =
      schema.additionalProperties === false ? z.strictObject(shape) : z.looseObject(shape);
    // Required presence remains required even when the property's schema is unconstrained.
    result.schema = result.schema.refine(
      (value) => isObject(value) && [...required].every((key) => Object.hasOwn(value, key)),
    );
  } else if (schema.type === "array") {
    if (schema.items !== undefined && !isObject(schema.items))
      throw new Error("Only a single object items schema is supported");
    const array = {
      schema: z.array(
        schema.items === undefined ? z.unknown() : compile(schema.items as Record<string, unknown>),
      ),
    };
    if (typeof schema.minItems === "number") array.schema = array.schema.min(schema.minItems);
    if (typeof schema.maxItems === "number") array.schema = array.schema.max(schema.maxItems);
    result.schema = array.schema;
  } else {
    // The bundled converter returns early for enum/const, so compose them separately below.
    const scalar = { ...schema };
    delete scalar.enum;
    delete scalar.const;
    delete scalar.minLength;
    delete scalar.maxLength;
    result.schema = z.fromJSONSchema(scalar as Parameters<typeof z.fromJSONSchema>[0]);
    if (schema.type === "string")
      result.schema = result.schema.refine(
        (value) =>
          typeof value === "string" &&
          (schema.minLength === undefined || [...value].length >= (schema.minLength as number)) &&
          (schema.maxLength === undefined || [...value].length <= (schema.maxLength as number)),
      );
  }
  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum) || schema.enum.length === 0)
      throw new Error("Enum must be a nonempty JSON array");
    const values = schema.enum;
    result.schema = result.schema.refine((value) =>
      values.some((candidate) => jsonValueEqual(value, candidate)),
    );
  }
  if (Object.hasOwn(schema, "const"))
    result.schema = result.schema.refine((value) => jsonValueEqual(value, schema.const));

  return result.schema;
};

export const compilePortJsonSchema = (
  schema: ExecutionJsonObject,
): Result<z.ZodType, ExecutionError> =>
  Result.fromThrowable(
    () => compile(schema),
    () =>
      executionError(
        "JSON_SCHEMA_UNSUPPORTED",
        "JSON Schema is invalid or outside the supported subset",
      ),
  )();
