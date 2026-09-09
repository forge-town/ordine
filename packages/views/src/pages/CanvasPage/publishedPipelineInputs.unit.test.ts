import { describe, expect, it, vi } from "vitest";
import { ok } from "neverthrow";
import type { ExecutionPortDefinition } from "@repo/schemas";
import { parsePublishedPipelineInputs } from "./publishedPipelineInputs";
const port = (patch: Partial<ExecutionPortDefinition> = {}): ExecutionPortDefinition => ({
  id: "input",
  valueType: "text",
  cardinality: "one",
  required: true,
  allowEmpty: false,
  ...patch,
});
const lookup = vi.fn(async (artifactId: string) =>
  ok({ artifactId, mimeType: "text/plain", sizeBytes: 12, sha256: "a".repeat(64) }),
);
describe("published input contracts", () => {
  it("preserves ordered many values and parsed JSON", async () => {
    expect(
      await parsePublishedPipelineInputs(
        [port({ cardinality: "many" })],
        { input: '["second","first"]' },
        lookup,
      ),
    ).toEqual({
      input: [
        { kind: "text", value: "second" },
        { kind: "text", value: "first" },
      ],
    });
    expect(
      await parsePublishedPipelineInputs(
        [port({ valueType: "json" })],
        { input: '{"a":1}' },
        lookup,
      ),
    ).toEqual({ input: [{ kind: "json", value: { a: 1 } }] });
  });
  it("resolves artifact metadata before accepting a typed reference", async () => {
    expect(
      await parsePublishedPipelineInputs(
        [port({ valueType: "artifact", mimeTypes: ["text/plain"] })],
        { input: "asset-one" },
        lookup,
      ),
    ).toEqual({ input: [{ kind: "artifact", artifactId: "asset-one" }] });
    expect(lookup).toHaveBeenCalledWith("asset-one");
  });
  it.each<{ ports: ExecutionPortDefinition[]; drafts: Record<string, string> }>([
    { ports: [port()], drafts: {} },
    { ports: [port()], drafts: { input: "" } },
    { ports: [port()], drafts: { input: "valid", undeclared: "no" } },
    { ports: [port({ cardinality: "many" })], drafts: { input: '"not array"' } },
    { ports: [port({ cardinality: "many" })], drafts: { input: "[1]" } },
    { ports: [port({ valueType: "json" })], drafts: { input: "{broken" } },
    {
      ports: [port({ valueType: "artifact", mimeTypes: ["image/png"] })],
      drafts: { input: "asset-one" },
    },
    {
      ports: [port({ valueType: "json", jsonSchema: { type: "object", required: ["name"] } })],
      drafts: { input: "{}" },
    },
  ])("rejects input that violates the published declaration %#", async ({ ports, drafts }) => {
    await expect(parsePublishedPipelineInputs(ports, drafts, lookup)).rejects.toThrow();
  });
  it("omits untouched optional inputs", async () => {
    expect(await parsePublishedPipelineInputs([port({ required: false })], {}, lookup)).toEqual({});
  });
});
