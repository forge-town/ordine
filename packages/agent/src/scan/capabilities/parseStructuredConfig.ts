import JSON5 from "json5";
import { Result } from "neverthrow";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import { CapabilityParseError } from "./capabilitySchemas";

export type StructuredConfig = Record<string, unknown>;

const asStructuredConfig = (value: unknown): StructuredConfig => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Capability config root must be an object");
  }

  return value as StructuredConfig;
};

export const parseJsonConfig = (raw: string) =>
  Result.fromThrowable(
    () => asStructuredConfig(JSON5.parse(raw) as unknown),
    (cause) => new CapabilityParseError("JSON/JSONC", cause),
  )();

export const parseTomlConfig = (raw: string) =>
  Result.fromThrowable(
    () => asStructuredConfig(parseToml(raw)),
    (cause) => new CapabilityParseError("TOML", cause),
  )();

export const parseYamlConfig = (raw: string) =>
  Result.fromThrowable(
    () => asStructuredConfig(parseYaml(raw) as unknown),
    (cause) => new CapabilityParseError("YAML", cause),
  )();
