import { z } from "zod/v4";

export const ORDINE_EXECUTION_API_VERSION = 2;
export const EXECUTION_INLINE_VALUE_MAX_BYTES = 256 * 1024;
export const EXECUTION_MAX_PORTS = 64;
export const EXECUTION_MAX_VALUES_PER_PORT = 256;
export const EXECUTION_MAX_JSON_DEPTH = 32;
export const EXECUTION_MAX_JSON_NODES = 16_384;
export const EXECUTION_MAX_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export const ExecutionApiVersionSchema = z.literal(ORDINE_EXECUTION_API_VERSION);
const RESERVED_IDENTIFIERS = new Set(Object.getOwnPropertyNames(Object.prototype));
export const ExecutionIdentifierSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u)
  .refine((value) => !RESERVED_IDENTIFIERS.has(value), "Reserved identifier");
export const ExecutionRequestIdSchema = z.uuid();
export const ExecutionRevisionSchema = z.number().int().positive();
export const ExecutionTimestampSchema = z.iso.datetime({ offset: true });

const RESERVED_PORT_IDS = new Set(["__proto__", "prototype", "constructor"]);
export const ExecutionPortIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/u)
  .refine((value) => !RESERVED_PORT_IDS.has(value), "Reserved port identifier");
