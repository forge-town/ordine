import { describe, expect, it, vi } from "vitest";
import { createCanvasExecutionPublisher } from "./createCanvasExecutionPublisher";
import { ExecutionGatewayError } from "./createExecutionGateway";
import { okAsync } from "neverthrow";
import {
  authoringFixture,
  failure,
  gatewayFixture,
  receipt,
  requestId,
} from "./gatewayTestFixture";

const fixture = () => {
  const transport = gatewayFixture();
  const authoring = authoringFixture();
  const readPipeline = vi.fn(async () => structuredClone(authoring.pipeline));
  const readOperations = vi.fn(async () => structuredClone(authoring.operations));
  const publisher = createCanvasExecutionPublisher({
    gateway: transport.gateway,
    readPipeline,
    readOperations,
  });

  return { ...transport, authoring, publisher, readPipeline, readOperations };
};

describe("canvas execution publisher", () => {
  it("rejects undeclared input overrides before submitting and explains the input boundary", async () => {
    const test = fixture();
    const result = await test.publisher.prepare({
      pipelineId: "pipeline",
      requestId,
      inputs: { wrong: [{ kind: "text", value: "meeting" }] },
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("Unknown Pipeline input ports: wrong");
      expect(result.error.message).toContain("Omit inputs to use saved Prompt values");
    }
    expect(test.calls.some((call) => call.method === "POST")).toBe(false);
  });
  it("publishes Agent configuration at the explicit boundary but never requires it for Script", async () => {
    const test = fixture();
    const publishConfiguration = vi.fn(() => okAsync(undefined));
    const publisher = createCanvasExecutionPublisher({
      gateway: test.gateway,
      readPipeline: test.readPipeline,
      readOperations: test.readOperations,
      publishConfiguration,
    });
    const script = await publisher.publish({ pipelineId: "pipeline" });
    expect(script.isOk()).toBe(true);
    expect(publishConfiguration).not.toHaveBeenCalled();
    test.authoring.operations[0]!.config.executor = {
      type: "agent",
      agentMode: "prompt",
      agent: "codex",
      prompt: "Use the saved runtime",
      model: "operation-model",
    };
    const agent = await publisher.publish({
      pipelineId: "pipeline",
      executionOverrides: { firstOutputTimeoutMs: 0 },
    });
    expect(agent.isOk()).toBe(true);
    expect(publishConfiguration).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          executor: expect.objectContaining({ kind: "agent" }),
          executionDefaults: { model: "operation-model" },
        }),
      ]),
      { firstOutputTimeoutMs: 0 },
      [{}],
    );
  });
  it("normalizes only a database null sourceSkillId and retains other unsupported fields for rejection", async () => {
    const test = fixture();
    Object.assign(test.authoring.operations[0]!, { sourceSkillId: null });
    expect((await test.publisher.publish({ pipelineId: "pipeline" })).isOk()).toBe(true);
    Object.assign(test.authoring.operations[0]!, { unknownExecutionPolicy: "must-not-disappear" });
    test.calls.splice(0);
    expect((await test.publisher.publish({ pipelineId: "pipeline" })).isErr()).toBe(true);
    expect(test.calls.some((call) => call.method === "PUT")).toBe(false);
  });

  it("does not discard a populated sourceSkillId", async () => {
    const test = fixture();
    test.authoring.operations[0]!.sourceSkillId = "skill-to-preserve";
    const result = await test.publisher.publish({ pipelineId: "pipeline" });
    expect(result.isErr() && result.error.message).toContain("sourceSkillId");
    expect(test.calls.some((call) => call.method === "PUT")).toBe(false);
  });
  it("returns a persisted receipt without rereading or republishing a changed authoring draft", async () => {
    const test = fixture();
    test.receipts.set(requestId, receipt());
    const result = await test.publisher.prepare({ pipelineId: "pipeline", requestId });
    expect(result.isOk()).toBe(true);
    expect(test.readPipeline).not.toHaveBeenCalled();
    expect(test.readOperations).not.toHaveBeenCalled();
    expect(test.calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("coalesces repeated prepare calls into one publication and submission", async () => {
    const test = fixture();
    const input = { pipelineId: "pipeline", requestId };
    const results = await Promise.all([
      test.publisher.prepare(input),
      test.publisher.prepare(input),
    ]);
    expect(results.every((result) => result.isOk())).toBe(true);
    expect(test.readPipeline).toHaveBeenCalledTimes(1);
    expect(test.calls.filter((call) => call.method === "POST")).toHaveLength(1);
    expect(test.pipelines.get("pipeline")?.revision).toBe(1);
    test.authoring.pipeline.description = "Changed after submission";
    expect((await test.publisher.prepare(input)).isOk()).toBe(true);
    expect(test.readPipeline).toHaveBeenCalledTimes(1);
    expect(test.pipelines.get("pipeline")?.revision).toBe(1);
  });

  it("does not republish after a lost POST when a later explicit retry finds 404", async () => {
    const test = fixture();
    test.hooks.before = (call) => {
      if (call.method === "POST") throw new Error("request lost before arrival");

      return undefined;
    };
    const input = { pipelineId: "pipeline", requestId };
    expect((await test.publisher.prepare(input)).isErr()).toBe(true);
    const firstBody = structuredClone(test.calls.find((call) => call.method === "POST")!.body);
    test.authoring.operations[0]!.config.executor!.command = "console.log('changed source')";
    test.hooks.before = undefined;
    expect((await test.publisher.prepare(input)).isOk()).toBe(true);
    expect(test.readPipeline).toHaveBeenCalledTimes(1);
    expect(test.calls.filter((call) => call.method === "POST").at(-1)!.body).toEqual(firstBody);
    expect(test.pipelines.get("pipeline")?.revision).toBe(1);
  });

  it("compares semantic content independently of JSON object key order", async () => {
    const test = fixture();
    expect((await test.publisher.publish({ pipelineId: "pipeline" })).isOk()).toBe(true);
    const writer = test.operations.get("output:report")!;
    if (writer.executor.kind !== "builtin") throw new Error("Expected a managed writer");
    writer.executor.config = Object.fromEntries(Object.entries(writer.executor.config).reverse());
    const pipeline = test.pipelines.get("pipeline")!;
    pipeline.editor.nodePositions = Object.fromEntries(
      Object.entries(pipeline.editor.nodePositions).reverse(),
    );
    test.calls.splice(0);
    expect((await test.publisher.publish({ pipelineId: "pipeline" })).isOk()).toBe(true);
    expect(test.calls.some((call) => call.method === "PUT")).toBe(false);
    expect(test.pipelines.get("pipeline")?.revision).toBe(1);
  });

  it.each(["operations", "pipelines"])(
    "propagates %s CAS conflicts without submitting",
    async (resource) => {
      const test = fixture();
      test.hooks.before = (call) =>
        call.method === "PUT" && call.path.includes(`/${resource}/`) ? failure(409) : undefined;
      const result = await test.publisher.prepare({ pipelineId: "pipeline", requestId });
      expect(
        result.isErr() && result.error instanceof ExecutionGatewayError && result.error.statusCode,
      ).toBe(409);
      expect(test.calls.some((call) => call.method === "POST")).toBe(false);
    },
  );

  it.each([401, 500])("does not publish when receipt lookup returns %s", async (status) => {
    const test = fixture();
    test.hooks.before = () => failure(status);
    const result = await test.publisher.prepare({ pipelineId: "pipeline", requestId });
    expect(result.isErr()).toBe(true);
    expect(test.readPipeline).not.toHaveBeenCalled();
    expect(test.calls).toHaveLength(1);
  });

  it("rejects stale expected revision and implicit inputs before any write", async () => {
    const test = fixture();
    expect(
      (
        await test.publisher.prepare({
          pipelineId: "pipeline",
          requestId,
          inputPath: "/guess",
        } as never)
      ).isErr(),
    ).toBe(true);
    expect(test.calls).toHaveLength(0);
    expect(
      (
        await test.publisher.prepare({ pipelineId: "pipeline", requestId, expectedRevision: 9 })
      ).isErr(),
    ).toBe(true);
    expect(test.calls.some((call) => call.method !== "GET")).toBe(false);
  });

  it("rejects changed explicit arguments for an already prepared requestId", async () => {
    const test = fixture();
    expect((await test.publisher.prepare({ pipelineId: "pipeline", requestId })).isOk()).toBe(true);
    const result = await test.publisher.prepare({
      pipelineId: "pipeline",
      requestId,
      executionOverrides: { model: "different" },
    });
    expect(result.isErr()).toBe(true);
    expect(test.calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });
});
