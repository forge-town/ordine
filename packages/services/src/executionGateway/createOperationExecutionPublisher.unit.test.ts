import { describe, expect, it, vi } from "vitest";
import { errAsync } from "neverthrow";
import { createOperationExecutionPublisher } from "./createOperationExecutionPublisher";
import { authoringFixture, gatewayFixture, requestId, failure } from "./gatewayTestFixture";

const fixture = () => {
  const transport = gatewayFixture();
  const authoring = authoringFixture();
  authoring.operations[0]!.config.inputs = [
    {
      id: "source",
      name: "Source",
      kind: "prompt",
      accepts: ["text/plain"],
      required: true,
      cardinality: "one",
    },
  ];
  const publisher = createOperationExecutionPublisher({
    gateway: transport.gateway,
    readOperations: async () => structuredClone(authoring.operations),
  });

  return { ...transport, authoring, publisher };
};
describe("standalone Operation publication", () => {
  it("publishes a persisted Operation whose optional description is SQL null", async () => {
    const test = fixture();
    const publisher = createOperationExecutionPublisher({
      gateway: test.gateway,
      readOperations: async () =>
        test.authoring.operations.map((operation) => ({
          ...operation,
          description: null,
          sourceSkillId: null,
        })),
    });
    const result = await publisher.publish({ operationId: "render" });
    expect(result.isOk(), JSON.stringify(result)).toBe(true);
    expect(result._unsafeUnwrap().operation.description).toBe("");
  });
  it("skips Agent configuration for Script and stops Agent publication when its configuration fails", async () => {
    const test = fixture();
    const failure = new Error("Required runtime missing");
    const publishConfiguration = vi.fn(() => errAsync(failure));
    const publisher = createOperationExecutionPublisher({
      gateway: test.gateway,
      readOperations: async () => test.authoring.operations,
      publishConfiguration,
    });
    const script = await publisher.publish({ operationId: "render" });
    expect(script.isOk()).toBe(true);
    expect(publishConfiguration).not.toHaveBeenCalled();
    test.authoring.operations[0]!.config.executor = {
      type: "agent",
      agentMode: "prompt",
      agent: "codex",
      prompt: "Explicit Agent",
    };
    const writes = test.calls.filter((call) => call.method === "PUT").length;
    const agent = await publisher.publish({
      operationId: "render",
      executionOverrides: { firstOutputTimeoutMs: 0 },
    });
    expect(agent.isErr() && agent.error).toBe(failure);
    expect(publishConfiguration).toHaveBeenCalledWith(expect.any(Array), {
      firstOutputTimeoutMs: 0,
    });
    expect(test.calls.filter((call) => call.method === "PUT")).toHaveLength(writes);
  });
  it("publishes explicit typed inputs and outputs and reuses identical revisions", async () => {
    const test = fixture();
    const first = await test.publisher.publish({ operationId: "render" });
    expect(first.isOk(), JSON.stringify(first)).toBe(true);
    expect(first._unsafeUnwrap().pipeline.graph.inputs).toEqual([
      { id: "source", valueType: "text", cardinality: "one", required: true, allowEmpty: false },
    ]);
    expect(first._unsafeUnwrap().pipeline.graph.outputs[0]!.source).toEqual({
      nodeId: "operation",
      portId: "result",
    });
    const second = await test.publisher.publish({ operationId: "render" });
    expect(second._unsafeUnwrap().pipeline.revision).toBe(1);
    expect(test.calls.filter((call) => call.method === "PUT")).toHaveLength(2);
  });
  it("recovers one request after a draft edit without preparing or executing twice", async () => {
    const test = fixture();
    const input = {
      operationId: "render",
      requestId,
      inputs: { source: [{ kind: "text" as const, value: "original" }] },
    };
    expect((await test.publisher.prepare(input)).isOk()).toBe(true);
    test.authoring.operations[0]!.config.executor!.command = "console.log('later edit')";
    expect((await test.publisher.prepare(input)).isOk()).toBe(true);
    expect(test.calls.filter((call) => call.method === "POST")).toHaveLength(1);
    expect(test.operations.get("render")?.revision).toBe(1);
  });
  it("stops on access errors and rejects unresolved legacy port IDs before publishing", async () => {
    const test = fixture();
    test.hooks.before = (call) => (call.path.includes("pipelines") ? failure(403) : undefined);
    expect((await test.publisher.publish({ operationId: "render" })).isErr()).toBe(true);
    expect(test.calls.filter((call) => call.method === "PUT")).toHaveLength(0);
    test.hooks.before = undefined;
    delete test.authoring.operations[0]!.config.inputs[0]!.id;
    expect((await test.publisher.publish({ operationId: "render" })).isErr()).toBe(true);
    expect(test.calls.filter((call) => call.method === "PUT")).toHaveLength(0);
  });
});
