import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { RunRequestInputSchema, RunRequestReceiptSchema } from "./RunRequestSchema";
import { ExecutionJobStateSchema } from "./ExecutionJobStateSchema";
import { ExecutionPortValuesSchema, ExecutionValueSchema } from "./ExecutionValueSchema";

const request = {
  apiVersion: 2,
  requestId: "79a37f82-a1f7-4226-a057-aa5100a2a168",
  pipelineId: "pipeline-1",
  expectedRevision: 1,
  inputs: { source: [{ kind: "text", value: "source material" }] },
  executionOverrides: {},
  deliveryRequirements: [],
};

describe("execution contract", () => {
  it("preserves explicit zero timeout and empty text without adding a runtime to script requests", () => {
    const parsed = RunRequestInputSchema.parse({
      ...request,
      inputs: { source: [{ kind: "text", value: "" }] },
      executionOverrides: { firstOutputTimeoutMs: 0 },
    });
    expect(parsed.inputs.source).toEqual([{ kind: "text", value: "" }]);
    expect(parsed.executionOverrides).toEqual({ firstOutputTimeoutMs: 0 });
    expect(parsed.executionOverrides).not.toHaveProperty("runtimeConfigId");
  });

  it("preserves runtime-scoped model capabilities for later runtime validation", () => {
    const executionOverrides = {
      runtimeConfigId: "local-codex",
      model: "gpt-6-astra",
      reasoningEffort: "high",
      speed: "priority",
      firstOutputTimeoutMs: 120_000,
    };
    expect(
      RunRequestInputSchema.parse({ ...request, executionOverrides }).executionOverrides,
    ).toEqual(executionOverrides);
  });

  it.each([
    { apiVersion: 1 },
    { requestId: "old-call-id" },
    { expectedRevision: 0 },
    { callId: "old-call-id" },
    { inputPath: "C:/input.md" },
    { approved: true },
    { actor: "local-owner" },
  ])("rejects old protocol fields or caller-supplied authority: %j", (patch) => {
    expect(RunRequestInputSchema.safeParse({ ...request, ...patch }).success).toBe(false);
  });

  it.each([
    { firstOutputTimeoutSeconds: 120 },
    { firstOutputTimeoutMs: -1 },
    { firstOutputTimeoutMs: 0.5 },
    { firstOutputTimeoutMs: "120000" },
    { runtimeConfigId: null },
    { model: "" },
    { apiKey: "not-accepted" },
  ])(
    "does not coerce, discard, or accept unsupported execution fields: %j",
    (executionOverrides) => {
      expect(RunRequestInputSchema.safeParse({ ...request, executionOverrides }).success).toBe(
        false,
      );
    },
  );

  it("rejects duplicate delivery requirements rather than ambiguously applying the weakest one", () => {
    expect(
      RunRequestInputSchema.safeParse({
        ...request,
        deliveryRequirements: [
          { nodeId: "producer", portId: "report", minimumItems: 1 },
          { nodeId: "producer", portId: "report", minimumItems: 2 },
        ],
      }).success,
    ).toBe(false);
  });

  it("distinguishes awaiting approval from an accepted job", () => {
    const base = {
      apiVersion: 2,
      requestId: request.requestId,
      preparedRunId: "prepared-1",
    };
    const pending = {
      ...base,
      state: "awaiting_approval",
      approvalId: "approval-1",
      expiresAt: "2026-09-05T12:00:00.000Z",
    };
    expect(RunRequestReceiptSchema.safeParse(pending).success).toBe(true);
    expect(RunRequestReceiptSchema.safeParse({ ...pending, jobId: "job-1" }).success).toBe(false);
    expect(RunRequestReceiptSchema.safeParse({ ...base, state: "accepted" }).success).toBe(false);
    expect(
      RunRequestReceiptSchema.safeParse({
        ...base,
        state: "accepted",
        jobId: "job-1",
        acceptedAt: "2026-09-05T12:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it.each(["done", "expired", "completed", "skipped"])("rejects legacy job state %s", (state) => {
    expect(ExecutionJobStateSchema.safeParse(state).success).toBe(false);
  });

  it.each(["pausing", "cancelling", "waiting_for_input", "succeeded", "interrupted"])(
    "represents explicit state %s",
    (state) => expect(ExecutionJobStateSchema.parse(state)).toBe(state),
  );

  it("preserves two distinct artifact references on a many-value port", () => {
    const values = {
      files: [
        { kind: "artifact", artifactId: "artifact-one" },
        { kind: "artifact", artifactId: "artifact-two" },
      ],
    };
    expect(ExecutionPortValuesSchema.parse(values)).toEqual(values);
  });

  it("accepts structured JSON without converting it to joined text", () => {
    const value = { kind: "json", value: { count: 2, flags: [true, false], note: null } };
    expect(ExecutionValueSchema.parse(value)).toEqual(value);
  });

  it("rejects filesystem paths in artifact references and reserved map keys", () => {
    expect(
      ExecutionValueSchema.safeParse({ kind: "artifact", artifactId: "a", path: "C:/secret" })
        .success,
    ).toBe(false);
    expect(ExecutionPortValuesSchema.safeParse(JSON.parse('{"__proto__":[]}')).success).toBe(false);
    expect(ExecutionPortValuesSchema.safeParse({ constructor: [] }).success).toBe(false);
  });

  it("bounds inline values by UTF-8 bytes rather than only character count", () => {
    expect(
      ExecutionValueSchema.safeParse({ kind: "text", value: "中".repeat(100_000) }).success,
    ).toBe(false);
  });

  it("rejects cyclic or deeply nested JSON before the recursive JSON parser runs", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    expect(ExecutionValueSchema.safeParse({ kind: "json", value: cyclic }).success).toBe(false);
    const deep = Array.from({ length: 40 }).reduce<unknown>((value) => ({ child: value }), null);
    expect(ExecutionValueSchema.safeParse({ kind: "json", value: deep }).success).toBe(false);
  });

  it("rejects reserved nested JSON keys instead of silently omitting business input", () => {
    expect(
      ExecutionValueSchema.safeParse({
        kind: "json",
        value: JSON.parse('{"nested":{"__proto__":{"value":1}}}'),
      }).success,
    ).toBe(false);
  });

  it("publishes strict discoverable JSON Schema including typed input values", () => {
    const schema = z.toJSONSchema(RunRequestInputSchema);
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties?.["inputs"]).toMatchObject({
      type: "object",
      additionalProperties: { type: "array", items: { oneOf: expect.any(Array) } },
    });
  });
});
