import { createHash } from "node:crypto";
import { PreparedRunSchema, type PreparedRun } from "@repo/schemas";
import { ExecutionIntegrityError } from "./executionErrors";

/** Call with schema-validated data; object undefined fields have normal JSON omission semantics. */
export const canonicalExecutionJson = (value: unknown): string => {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalExecutionJson).join(",")}]`;
  if (
    value &&
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  ) {
    const entries = Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalExecutionJson(child)}`).join(",")}}`;
  }
  throw new ExecutionIntegrityError("Canonical execution hashing requires JSON data");
};

export const hashExecutionJson = (value: unknown): string =>
  createHash("sha256").update(canonicalExecutionJson(value), "utf8").digest("hex");

export const hashPreparedRun = (prepared: PreparedRun): string => {
  const normalized = PreparedRunSchema.parse(prepared);
  const excluded = new Set(["id", "createdAt", "contentHash", "pipeline"]);
  const content = Object.fromEntries(
    Object.entries(normalized).filter(([key]) => !excluded.has(key)),
  );
  const pipeline = Object.fromEntries(
    Object.entries(normalized.pipeline).filter(([key]) => key !== "editor"),
  );

  return hashExecutionJson({ ...content, pipeline });
};

export const verifyPreparedRun = (input: unknown): PreparedRun => {
  const parsed = PreparedRunSchema.safeParse(input);
  if (!parsed.success)
    throw new ExecutionIntegrityError("Prepared run does not satisfy the execution contract");
  if (hashPreparedRun(parsed.data) !== parsed.data.contentHash)
    throw new ExecutionIntegrityError("Prepared run content hash mismatch");

  return parsed.data;
};
