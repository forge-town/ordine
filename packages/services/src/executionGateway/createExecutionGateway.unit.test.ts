import { describe, expect, it } from "vitest";
import { OperationRevisionSchema } from "@repo/schemas";
import { ExecutionGatewayError } from "./createExecutionGateway";
import { failure, gatewayFixture, json, receipt, requestId } from "./gatewayTestFixture";

describe("execution gateway request recovery", () => {
  it("does not recreate the per-request Operation pipeline when the same request is repeated", async () => {
    const fixture = gatewayFixture();
    fixture.operations.set(
      "operation",
      OperationRevisionSchema.parse({
        apiVersion: 2,
        id: "operation",
        revision: 3,
        name: "Operation",
        executor: {
          kind: "script",
          language: "javascript",
          source: "console.log('done')",
          outputMode: "text",
        },
        inputPorts: [],
        outputPorts: [{ id: "result", valueType: "text", cardinality: "one" }],
      }),
    );
    const input = { requestId, operationId: "operation", inputs: {} };
    const first = await fixture.gateway.submitOperation(input);
    const repeated = await fixture.gateway.submitOperation(input);
    expect(first.isOk() && repeated.isOk()).toBe(true);
    expect(fixture.calls.filter((call) => call.method === "PUT")).toHaveLength(1);
    expect(fixture.calls.filter((call) => call.method === "POST")).toHaveLength(1);
    expect(fixture.pipelines.get(`operation-${requestId}`)?.revision).toBe(1);
  });
  it("uses the explicit saved revision and coalesces simultaneous submission calls", async () => {
    const fixture = gatewayFixture();
    const input = { requestId, pipelineId: "pipeline", expectedRevision: 7, inputs: {} };
    const results = await Promise.all([
      fixture.gateway.submitPipeline(input),
      fixture.gateway.submitPipeline(input),
    ]);
    expect(results.every((result) => result.isOk())).toBe(true);
    expect(fixture.calls.filter((call) => call.method === "POST")).toHaveLength(1);
    expect(fixture.calls.some((call) => call.path.includes("/pipelines/"))).toBe(false);
    expect(fixture.calls.at(-1)!.body).toMatchObject({ expectedRevision: 7 });
  });

  it("recovers a receipt from a prior process without reading heads or posting", async () => {
    const fixture = gatewayFixture();
    fixture.receipts.set(requestId, receipt());
    const result = await fixture.gateway.submitPipeline({ requestId, pipelineId: "pipeline" });
    expect(result.isOk()).toBe(true);
    expect(fixture.calls).toHaveLength(1);
  });

  it("recovers a lost POST response and never submits a second job", async () => {
    const fixture = gatewayFixture();
    fixture.hooks.afterPost = () => {
      throw new Error("lost response");
    };
    const input = { requestId, pipelineId: "pipeline", expectedRevision: 2, inputs: {} };
    expect((await fixture.gateway.submitPipeline(input)).isErr()).toBe(true);
    expect((await fixture.gateway.submitPipeline(input)).isOk()).toBe(true);
    expect(fixture.calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("allows an explicit retry after confirmed 404 using the frozen original body", async () => {
    const fixture = gatewayFixture();
    fixture.hooks.before = (call) => {
      if (call.method === "POST") throw new Error("request did not arrive");

      return undefined;
    };
    const input = { requestId, pipelineId: "pipeline", expectedRevision: 2, inputs: {} };
    expect((await fixture.gateway.submitPipeline(input)).isErr()).toBe(true);
    fixture.hooks.before = undefined;
    expect((await fixture.gateway.submitPipeline(input)).isOk()).toBe(true);
    const posts = fixture.calls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[1]!.body).toEqual(posts[0]!.body);
  });

  it.each([401, 409, 500])("does not treat HTTP %s as missing", async (status) => {
    const fixture = gatewayFixture();
    fixture.hooks.before = () => failure(status);
    const result = await fixture.gateway.submitPipeline({
      requestId,
      pipelineId: "pipeline",
      expectedRevision: 1,
    });
    expect(
      result.isErr() && result.error instanceof ExecutionGatewayError && result.error.statusCode,
    ).toBe(status);
    expect(fixture.calls).toHaveLength(1);
  });

  it("preserves the status of a non-JSON HTTP failure", async () => {
    const fixture = gatewayFixture();
    fixture.hooks.before = () => new Response("upstream unavailable", { status: 502 });
    const result = await fixture.gateway.getPipeline("pipeline");
    expect(
      result.isErr() && result.error instanceof ExecutionGatewayError && result.error.statusCode,
    ).toBe(502);
  });

  it("rejects implicit path arguments before any network call", async () => {
    const fixture = gatewayFixture();
    const result = await fixture.gateway.submitPipeline({
      requestId,
      pipelineId: "pipeline",
      inputPath: "/guessed",
    } as never);
    expect(result.isErr()).toBe(true);
    expect(fixture.calls).toHaveLength(0);
  });

  it("requires explicit values for an Operation's required ports before publishing its wrapper", async () => {
    const fixture = gatewayFixture();
    fixture.operations.set(
      "operation",
      OperationRevisionSchema.parse({
        apiVersion: 2,
        id: "operation",
        revision: 1,
        name: "Operation",
        executor: { kind: "agent", instruction: "Use input" },
        inputPorts: [{ id: "source", valueType: "text", cardinality: "one", required: true }],
        outputPorts: [],
      }),
    );
    const result = await fixture.gateway.submitOperation({ requestId, operationId: "operation" });
    expect(result.isErr()).toBe(true);
    expect(fixture.calls.some((call) => call.method === "PUT" || call.method === "POST")).toBe(
      false,
    );
  });

  it("returns the validated v2 job result", async () => {
    const fixture = gatewayFixture();
    fixture.hooks.before = (call) =>
      call.path === "/api/v2/jobs/job/result"
        ? json({ jobId: "job", state: "succeeded", outputs: {}, artifacts: [], warnings: [] })
        : undefined;
    const result = await fixture.gateway.getJobResult("job");
    expect(result.isOk() && result.value.state).toBe("succeeded");
  });
});
