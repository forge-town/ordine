import { describe, expect, it, vi } from "vitest";
import { ok, err, type Result } from "neverthrow";
import {
  PreparedRunSchema,
  OperationRevisionSchema,
  ExecutionPortDefinitionSchema,
  EXECUTION_TIMEOUT_DEFAULTS,
  type ExecutionPortValues,
  type ExecutionJsonObject,
  type PreparedRun,
  type RuntimeEdge,
  type OperationRevision,
  type ExecutionPortDefinition,
  type ExecutionError,
} from "@repo/schemas";
import { compileGraph } from "./compileGraph";
import { evaluateExecutionCondition } from "./conditions";
import { validatePortValues } from "./validatePortValues";
import { executePreparedRun, type ExecutePreparedRunOptions } from "./executePreparedRun";

const port = (id: string, options: Partial<ExecutionPortDefinition> = {}) =>
  ExecutionPortDefinitionSchema.parse({ id, valueType: "text", cardinality: "one", ...options });
const operation = (
  id: string,
  inputPorts: ExecutionPortDefinition[] = [],
  outputPorts = [port("out")],
  executor?: OperationRevision["executor"],
) =>
  OperationRevisionSchema.parse({
    apiVersion: 2,
    id,
    revision: 1,
    name: id,
    inputPorts,
    outputPorts,
    executor: executor ?? { kind: "agent", instruction: "test", allowedTools: [] },
  });
const textValue = (value: string) => ({ kind: "text" as const, value });
const isError = (result: Result<unknown, unknown>) => result.isErr();
const isSuccess = (result: Result<unknown, unknown>) => result.isOk();
const fault = (code = "BROKEN", retryable = false): ExecutionError => ({
  code,
  message: code,
  retryable,
  stage: "execution",
});
const edge = (
  id: string,
  source: string,
  target: string,
  sourcePort = "out",
  targetPort = "in",
  order = 0,
): RuntimeEdge => ({
  id,
  source: { kind: "node", nodeId: source, portId: sourcePort },
  target: { nodeId: target, portId: targetPort },
  order,
});
const prepared = (operations = [operation("a")], edges: RuntimeEdge[] = []): PreparedRun =>
  PreparedRunSchema.parse({
    apiVersion: 2,
    id: "prepared",
    subjectId: "subject",
    workspaceId: "workspace",
    createdAt: "2026-09-05T00:00:00Z",
    operations,
    pipeline: {
      apiVersion: 2,
      id: "pipeline",
      revision: 1,
      name: "test",
      graph: {
        schemaVersion: 2,
        inputs: [],
        nodes: operations.map((op) => ({
          id: op.id,
          operation: { operationId: op.id, revision: op.revision },
        })),
        edges,
        outputs: [
          {
            port: port("result"),
            source: {
              nodeId: operations.at(-1)!.id,
              portId: operations.at(-1)!.outputPorts[0]!.id,
            },
          },
        ],
      },
    },
    resolvedNodes: Object.fromEntries(
      operations.map((op) => [
        op.id,
        {
          executorKind: op.executor.kind,
          ...(op.executor.kind === "agent"
            ? {
                runtimeConfigId: "runtime",
                agent: "codex",
                executablePath: "C:/fake/codex.exe",
                model: "test",
              }
            : {}),
          timeouts: EXECUTION_TIMEOUT_DEFAULTS,
          origins: {},
        },
      ]),
    ),
    inputs: {},
    deliveryRequirements: [],
    credentialRefs: [],
    risk: { requiresApproval: false, reasons: [] },
    contentHash: "a".repeat(64),
  });
const getArtifact: ExecutePreparedRunOptions["getArtifact"] = async (artifactId) =>
  ok({ artifactId, mimeType: "text/plain", sizeBytes: 3, sha256: "a".repeat(64) });
const options = (
  run = prepared(),
  overrides: Partial<ExecutePreparedRunOptions> = {},
): ExecutePreparedRunOptions => ({
  prepared: run,
  jobId: "job",
  signal: new AbortController().signal,
  executeOperation: async () => ok({ out: [textValue("ok")] }),
  getArtifact,
  onAttemptStart: async () => ok(undefined),
  onAttemptEnd: async () => ok(undefined),
  ...overrides,
});
const codeOf = (result: Awaited<ReturnType<typeof executePreparedRun>>) =>
  result.isErr() ? result.error.code : "OK";

describe("prepared graph validation", () => {
  it("rejects missing pins and unknown ports", () => {
    const value = prepared();
    value.operations = [];
    expect(compileGraph(value).isErr()).toBe(true);
    const bad = prepared(
      [operation("a"), operation("b", [port("in")])],
      [edge("ab", "a", "b", "missing")],
    );
    expect(compileGraph(bad).isErr()).toBe(true);
  });
  it("rejects unbound required inputs, mismatched types, many-to-one and multiple one bindings", () => {
    expect(compileGraph(prepared([operation("a", [port("in")])])).isErr()).toBe(true);
    expect(
      compileGraph(
        prepared(
          [operation("a", [], [port("out", { valueType: "json" })]), operation("b", [port("in")])],
          [edge("ab", "a", "b")],
        ),
      ).isErr(),
    ).toBe(true);
    expect(
      compileGraph(
        prepared(
          [
            operation("a", [], [port("out", { cardinality: "many" })]),
            operation("b", [port("in")]),
          ],
          [edge("ab", "a", "b")],
        ),
      ).isErr(),
    ).toBe(true);
    expect(
      compileGraph(
        prepared(
          [operation("a"), operation("b"), operation("c", [port("in")])],
          [edge("ac", "a", "c"), edge("bc", "b", "c")],
        ),
      ).isErr(),
    ).toBe(true);
  });
  it("rejects invalid output declarations, condition types and loop references", () => {
    const value = prepared();
    value.pipeline.graph.outputs[0]!.port.valueType = "json";
    expect(compileGraph(value).isErr()).toBe(true);
    const condition = prepared(
      [
        operation("a", [], [port("out", { valueType: "json" })]),
        operation("b", [port("in", { valueType: "json" })], [port("out")]),
      ],
      [
        {
          ...edge("ab", "a", "b"),
          condition: { operator: "contains", expected: "x", negate: false },
        },
      ],
    );
    expect(compileGraph(condition).isErr()).toBe(true);
    const loop = prepared();
    loop.pipeline.graph.nodes[0]!.loop = {
      maxIterations: 2,
      until: { portId: "missing", condition: { operator: "non_empty", negate: false } },
      feedback: [],
    };
    expect(compileGraph(loop).isErr()).toBe(true);
  });
  it("rejects script retries without declared idempotency and unknown builtin config", () => {
    const value = prepared([
      operation("a", [], [port("out")], {
        kind: "script",
        language: "javascript",
        source: "1",
        outputMode: "text",
      }),
    ]);
    value.pipeline.graph.nodes[0]!.retry.maxAttempts = 2;
    expect(compileGraph(value).isErr()).toBe(true);
    const builtin = prepared([
      operation("a", [], [port("out")], {
        kind: "builtin",
        name: "identity",
        config: { ignored: true },
      }),
    ]);
    expect(compileGraph(builtin).isErr()).toBe(true);
  });
});

describe("port value validation", () => {
  it("rejects unknown, absent required, wrong cardinality/type and empty values", async () => {
    const cases: ExecutionPortValues[] = [
      { other: [textValue("x")] },
      {},
      { in: [] },
      { in: [textValue("a"), textValue("b")] },
      { in: [{ kind: "json", value: 1 }] },
      { in: [textValue("")] },
    ];
    for (const values of cases)
      expect(isError(await validatePortValues([port("in")], values, getArtifact))).toBe(true);
    expect(
      isSuccess(
        await validatePortValues(
          [port("in", { allowEmpty: true })],
          { in: [textValue("")] },
          getArtifact,
        ),
      ),
    ).toBe(true);
    expect(
      isSuccess(await validatePortValues([port("in", { required: false })], {}, getArtifact)),
    ).toBe(true);
  });
  it("validates MIME wildcards, registry identity and zero-byte artifacts", async () => {
    const values = { in: [{ kind: "artifact" as const, artifactId: "artifact" }] };
    for (const mime of ["text/plain", "text/*", "*/*"])
      expect(
        isSuccess(
          await validatePortValues(
            [port("in", { valueType: "artifact", mimeTypes: [mime] })],
            values,
            getArtifact,
          ),
        ),
      ).toBe(true);
    for (const mime of ["image/*", "*/plain", "text/p*", "text/plain; charset=utf-8"])
      expect(
        isError(
          await validatePortValues(
            [port("in", { valueType: "artifact", mimeTypes: [mime] })],
            values,
            getArtifact,
          ),
        ),
      ).toBe(true);
    expect(
      isError(
        await validatePortValues([port("in", { valueType: "artifact" })], values, async () =>
          ok({ artifactId: "other", mimeType: "text/plain", sizeBytes: 0, sha256: "a".repeat(64) }),
        ),
      ),
    ).toBe(true);
    expect(
      isError(
        await validatePortValues([port("in", { valueType: "artifact" })], values, async () =>
          ok({
            artifactId: "artifact",
            mimeType: "text/plain",
            sizeBytes: 0,
            sha256: "a".repeat(64),
          }),
        ),
      ),
    ).toBe(true);
  });
  it("enforces JSON required/additionalProperties and preserves validated data", async () => {
    const jsonSchema = {
      type: "object",
      properties: { name: { type: "string", minLength: 1 } },
      required: ["name"],
      additionalProperties: false,
    };
    const ports = [port("in", { valueType: "json", jsonSchema })];
    const cases: ExecutionJsonObject[] = [{ wrong: 1 }, { name: "yes", extra: true }, { name: "" }];
    for (const value of cases)
      expect(
        isError(await validatePortValues(ports, { in: [{ kind: "json", value }] }, getArtifact)),
      ).toBe(true);
    const values = { in: [{ kind: "json" as const, value: { name: "yes", extra: true } }] };
    const allowed = await validatePortValues(
      [
        port("in", {
          valueType: "json",
          jsonSchema: { ...jsonSchema, additionalProperties: true },
        }),
      ],
      values,
      getArtifact,
    );
    expect(allowed.isOk() && allowed.value).toBe(values);
  });
  it("rejects unsupported JSON schemas and composes enum with other constraints", async () => {
    const cases: ExecutionJsonObject[] = [
      { $ref: "#/bad" },
      { type: "string", pattern: ".*" },
      { type: ["string", "null"] },
      { type: "array", items: [] },
    ];
    for (const jsonSchema of cases)
      expect(
        isError(
          await validatePortValues(
            [port("in", { valueType: "json", jsonSchema })],
            { in: [{ kind: "json", value: "x" }] },
            getArtifact,
          ),
        ),
      ).toBe(true);
    expect(
      isError(
        await validatePortValues(
          [
            port("in", {
              valueType: "json",
              jsonSchema: { type: "number", minimum: 2, enum: [1, 2] },
            }),
          ],
          { in: [{ kind: "json", value: 1 }] },
          getArtifact,
        ),
      ),
    ).toBe(true);
  });
});

describe("additional execution boundaries", () => {
  it("preflights graph-input bindings independently of runtime input presence", async () => {
    const run = prepared([operation("a", [port("in")])]);
    run.pipeline.graph.inputs = [port("source")];
    run.pipeline.graph.edges = [
      {
        id: "seed",
        source: { kind: "input", portId: "source" },
        target: { nodeId: "a", portId: "in" },
        order: 0,
      },
    ];
    expect(compileGraph(run).isOk()).toBe(true);
    expect(codeOf(await executePreparedRun(options(run)))).toBe("PORT_REQUIRED");
  });
  it("preflights the frozen builtin configuration and port contracts", () => {
    const definitions: OperationRevision[] = [
      operation("identity", [port("in", { required: false })], [port("out")], {
        kind: "builtin",
        name: "identity",
        config: {},
      }),
      operation("merge", [port("in", { required: false, cardinality: "many" })], [port("out")], {
        kind: "builtin",
        name: "merge_text",
        config: { separator: "\n" },
      }),
      operation(
        "write",
        [port("in", { required: false })],
        [port("out", { valueType: "artifact" })],
        {
          kind: "builtin",
          name: "write_artifact",
          config: { name: "result.txt", mimeType: "text/plain" },
        },
      ),
      operation("read", [port("in", { required: false, valueType: "artifact" })], [port("out")], {
        kind: "builtin",
        name: "read_artifact",
        config: {},
      }),
    ];
    for (const definition of definitions) {
      const run = prepared([definition]);
      run.pipeline.graph.outputs[0]!.port = { ...definition.outputPorts[0]!, id: "result" };
      expect(compileGraph(run).isOk()).toBe(true);
    }
    const run = prepared();
    run.operations[0]!.executor = {
      kind: "builtin",
      name: "materialize_file",
      config: { assetId: "file" },
    };
    run.operations[0]!.outputPorts = [port("out", { valueType: "artifact" })];
    run.pipeline.graph.outputs[0]!.port.valueType = "artifact";
    run.resolvedNodes.a = {
      executorKind: "builtin",
      timeouts: EXECUTION_TIMEOUT_DEFAULTS,
      origins: {},
    };
    run.inputArtifacts = [
      {
        artifactId: "file",
        name: "file.txt",
        mimeType: "text/plain",
        sizeBytes: 3,
        sha256: "a".repeat(64),
        source: { kind: "input_asset" },
      },
    ];
    expect(compileGraph(run).isOk()).toBe(true);
    run.operations[0]!.executor.config = { path: "C:/arbitrary/file" };
    expect(compileGraph(run).isErr()).toBe(true);
  });
  it("checks typed conditions without treating zero/false JSON as empty", async () => {
    for (const value of [0, false]) {
      const result = await evaluateExecutionCondition(
        { operator: "non_empty", negate: false },
        [{ kind: "json", value }],
        getArtifact,
      );
      expect(result.isOk() && result.value).toBe(true);
    }
    const equal = await evaluateExecutionCondition(
      { operator: "equals", expected: { kind: "json", value: { a: 1, b: 2 } }, negate: false },
      [{ kind: "json", value: { b: 2, a: 1 } }],
      getArtifact,
    );
    expect(equal.isOk() && equal.value).toBe(true);
    const contains = await evaluateExecutionCondition(
      { operator: "contains", expected: "hello", negate: true },
      [textValue("hello world")],
      getArtifact,
    );
    expect(contains.isOk() && contains.value).toBe(false);
    const emptyArtifact = await evaluateExecutionCondition(
      { operator: "non_empty", negate: false },
      [{ kind: "artifact", artifactId: "file" }],
      async (artifactId) =>
        ok({ artifactId, mimeType: "text/plain", sizeBytes: 0, sha256: "a".repeat(64) }),
    );
    expect(emptyArtifact.isOk() && emptyArtifact.value).toBe(false);
  });
  it("independently enforces required presence and additionalProperties=false", async () => {
    const missing = await validatePortValues(
      [
        port("in", {
          valueType: "json",
          allowEmpty: true,
          jsonSchema: {
            type: "object",
            properties: { required: {} },
            required: ["required"],
            additionalProperties: true,
          },
        }),
      ],
      { in: [{ kind: "json", value: {} }] },
      getArtifact,
    );
    expect(missing.isErr() && missing.error.code).toBe("JSON_VALUE_INVALID");
    const extra = await validatePortValues(
      [
        port("in", {
          valueType: "json",
          jsonSchema: {
            type: "object",
            properties: { field: { type: "string" } },
            additionalProperties: false,
          },
        }),
      ],
      { in: [{ kind: "json", value: { field: "ok", extra: true } }] },
      getArtifact,
    );
    expect(extra.isErr() && extra.error.code).toBe("JSON_VALUE_INVALID");
  });
  it("validates nested JSON arrays, bounds, unicode lengths, enum and const together", async () => {
    const jsonSchema = {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: {
        type: "object",
        properties: {
          n: { type: "integer", minimum: 1, maximum: 2 },
          s: { type: "string", minLength: 1, maxLength: 1 },
        },
        required: ["n", "s"],
        additionalProperties: false,
      },
      const: [{ n: 1, s: "😀" }],
    };
    const valid = await validatePortValues(
      [port("in", { valueType: "json", jsonSchema })],
      { in: [{ kind: "json", value: [{ n: 1, s: "😀" }] }] },
      getArtifact,
    );
    expect(valid.isOk()).toBe(true);
    const invalid = await validatePortValues(
      [port("in", { valueType: "json", jsonSchema })],
      { in: [{ kind: "json", value: [{ n: 2, s: "x" }] }] },
      getArtifact,
    );
    expect(invalid.isErr()).toBe(true);
  });
  it("rejects changed frozen input artifact metadata before dispatch", async () => {
    const run = prepared([operation("a", [port("in", { valueType: "artifact" })])]);
    run.pipeline.graph.inputs = [port("source", { valueType: "artifact" })];
    run.pipeline.graph.edges = [
      {
        id: "seed",
        source: { kind: "input", portId: "source" },
        target: { nodeId: "a", portId: "in" },
        order: 0,
      },
    ];
    run.inputs = { source: [{ kind: "artifact", artifactId: "file" }] };
    run.inputArtifacts = [
      {
        artifactId: "file",
        name: "file.txt",
        mimeType: "text/plain",
        sizeBytes: 3,
        sha256: "b".repeat(64),
        source: { kind: "input_asset" },
      },
    ];
    const executor = vi.fn(options().executeOperation);
    const result = await executePreparedRun(options(run, { executeOperation: executor }));
    expect(codeOf(result)).toBe("INPUT_ARTIFACT_CHANGED");
    expect(executor).not.toHaveBeenCalled();
  });
  it("propagates in-flight parent cancellation to every running attempt and its end callback", async () => {
    const parent = new AbortController();
    const ended: string[] = [];
    const result = await executePreparedRun(
      options(prepared([operation("a"), operation("b")]), {
        signal: parent.signal,
        executeOperation: async ({ signal }) => {
          await new Promise<void>((resolve) => {
            signal.addEventListener("abort", () => resolve(), { once: true });
            setTimeout(() => parent.abort(), 2);
          });

          return ok({ out: [textValue("stale")] });
        },
        onAttemptEnd: async (_context, outcome) => {
          ended.push(outcome.isErr() ? outcome.error.code : "OK");

          return ok(undefined);
        },
      }),
    );
    expect(codeOf(result)).toBe("CANCELLED");
    expect(ended).toEqual(["CANCELLED", "CANCELLED"]);
  });
  it("aborts siblings before a slow onAttemptEnd callback completes", async () => {
    const calls: string[] = [];
    const endOrder: string[] = [];
    const result = await executePreparedRun(
      options(prepared([operation("a"), operation("b"), operation("c")]), {
        executeOperation: async ({ node, signal }) => {
          calls.push(node.id);
          if (node.id === "a") return err(fault());
          await new Promise<void>((resolve) => {
            if (signal.aborted) resolve();
            else signal.addEventListener("abort", () => resolve(), { once: true });
          });
          endOrder.push("sibling-aborted");

          return err(fault("SIBLING_ABORTED"));
        },
        onAttemptEnd: async ({ node }) => {
          if (node.id === "a") {
            await new Promise((resolve) => setTimeout(resolve, 5));
            endOrder.push("failure-persisted");
          }

          return ok(undefined);
        },
      }),
    );
    expect(codeOf(result)).toBe("BROKEN");
    expect(calls).toEqual(["a", "b"]);
    expect(endOrder).toEqual(["sibling-aborted", "failure-persisted"]);
  });
  it("does not hide an onAttemptEnd persistence failure behind an executor failure", async () => {
    const result = await executePreparedRun(
      options(prepared(), {
        executeOperation: async () => err(fault()),
        onAttemptEnd: async () => err(fault("DB_DOWN")),
      }),
    );
    expect(codeOf(result)).toBe("CALLBACK_FAILED");
  });
  it("resets retry numbering per loop iteration and accepts only a satisfied until", async () => {
    const run = prepared([operation("a", [port("in", { required: false })])]);
    run.pipeline.graph.nodes[0]!.loop = {
      maxIterations: 2,
      feedback: [{ sourcePort: "out", targetPort: "in" }],
      until: {
        portId: "out",
        condition: { operator: "equals", expected: textValue("done"), negate: false },
      },
    };
    run.pipeline.graph.nodes[0]!.retry = { maxAttempts: 2, retryableCodes: ["TRANSIENT"] };
    const attempts: number[][] = [];
    const result = await executePreparedRun(
      options(run, {
        executeOperation: async ({ iteration, attemptNumber }) => {
          attempts.push([iteration, attemptNumber]);

          return attemptNumber === 1
            ? err(fault("TRANSIENT", true))
            : ok({ out: [textValue(iteration === 2 ? "done" : "again")] });
        },
      }),
    );
    expect(codeOf(result)).toBe("OK");
    expect(attempts).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ]);
  });
  it("does not publish a prior loop iteration after a best-effort failure", async () => {
    const run = prepared();
    const node = run.pipeline.graph.nodes[0]!;
    node.failurePolicy = "best_effort";
    node.loop = {
      maxIterations: 2,
      feedback: [],
      until: {
        portId: "out",
        condition: { operator: "equals", expected: textValue("done"), negate: false },
      },
    };
    const result = await executePreparedRun(
      options(run, {
        executeOperation: async ({ iteration }) =>
          iteration === 1 ? ok({ out: [textValue("old")] }) : err(fault()),
      }),
    );
    expect(codeOf(result)).toBe("PORT_REQUIRED");
  });
  it("validates each attempt output and never retries validation failures", async () => {
    const run = prepared();
    run.pipeline.graph.nodes[0]!.retry = { maxAttempts: 3, retryableCodes: ["PORT_TYPE_MISMATCH"] };
    const executor = vi.fn<ExecutePreparedRunOptions["executeOperation"]>(async () =>
      ok({ out: [{ kind: "json", value: false }] }),
    );
    const result = await executePreparedRun(options(run, { executeOperation: executor }));
    expect(codeOf(result)).toBe("PORT_TYPE_MISMATCH");
    expect(executor).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid concurrency and colliding attempt identifiers", async () => {
    expect(codeOf(await executePreparedRun(options(prepared(), { maxConcurrency: 0 })))).toBe(
      "CONCURRENCY_INVALID",
    );
    const run = prepared();
    run.pipeline.graph.nodes[0]!.retry = { maxAttempts: 2, retryableCodes: ["TRANSIENT"] };
    expect(
      codeOf(
        await executePreparedRun(
          options(run, {
            attemptIdFactory: () => "00000000-0000-4000-8000-000000000000",
            executeOperation: async () => err(fault("TRANSIENT", true)),
          }),
        ),
      ),
    ).toBe("ATTEMPT_ID_INVALID");
  });
});

describe("bounded prepared execution", () => {
  it("routes two artifact references through distinct real port values in stable edge order", async () => {
    const artifact = (id: string) => port(id, { valueType: "artifact" });
    const run = prepared(
      [
        operation("a", [], [artifact("first"), artifact("second")]),
        operation("b", [artifact("left"), artifact("right")], [port("out")]),
      ],
      [edge("right", "a", "b", "second", "right", 0), edge("left", "a", "b", "first", "left", 1)],
    );
    const executeOperation = vi.fn<ExecutePreparedRunOptions["executeOperation"]>(
      async ({ node, inputs }) =>
        node.id === "a"
          ? ok({
              first: [{ kind: "artifact", artifactId: "file-a" }],
              second: [{ kind: "artifact", artifactId: "file-b" }],
            })
          : ok({ out: [textValue(JSON.stringify(inputs))] }),
    );
    const result = await executePreparedRun(options(run, { executeOperation }));
    expect(result.isOk()).toBe(true);
    expect(executeOperation.mock.calls[1]![0].inputs).toEqual({
      right: [{ kind: "artifact", artifactId: "file-b" }],
      left: [{ kind: "artifact", artifactId: "file-a" }],
    });
  });
  it("orders many-port contributions by edge order regardless of completion order", async () => {
    const run = prepared(
      [operation("a"), operation("b"), operation("c", [port("in", { cardinality: "many" })])],
      [edge("ac", "a", "c", "out", "in", 2), edge("bc", "b", "c", "out", "in", 1)],
    );
    const result = await executePreparedRun(
      options(run, {
        executeOperation: async ({ node, inputs }) =>
          ok({ out: [textValue(node.id === "c" ? JSON.stringify(inputs.in) : node.id)] }),
      }),
    );
    expect(result.isOk() && result.value.outputs.result).toEqual([
      textValue(JSON.stringify([textValue("b"), textValue("a")])),
    ]);
  });
  it("enforces default parallelism of two and stable dispatch", async () => {
    const run = prepared([operation("a"), operation("b"), operation("c")]);
    const concurrency = { active: 0, peak: 0 };
    const order: string[] = [];
    const result = await executePreparedRun(
      options(run, {
        executeOperation: async ({ node }) => {
          concurrency.active++;
          concurrency.peak = Math.max(concurrency.peak, concurrency.active);
          order.push(node.id);
          await new Promise((resolve) => setTimeout(resolve, 3));
          concurrency.active--;

          return ok({ out: [textValue(node.id)] });
        },
      }),
    );
    expect(codeOf(result)).toBe("OK");
    expect(concurrency.peak).toBe(2);
    expect(order).toEqual(["a", "b", "c"]);
  });
  it("skips a node whose conditions are all inactive and rejects a missing required final output", async () => {
    const run = prepared(
      [operation("a"), operation("b", [port("in")])],
      [
        {
          ...edge("ab", "a", "b"),
          condition: { operator: "equals", expected: textValue("different"), negate: false },
        },
      ],
    );
    const executor = vi.fn(options().executeOperation);
    expect(codeOf(await executePreparedRun(options(run, { executeOperation: executor })))).toBe(
      "PORT_REQUIRED",
    );
    expect(executor).toHaveBeenCalledTimes(1);
  });
  it("aborts running siblings on hard failure, waits for convergence, and stops dispatch", async () => {
    const run = prepared([operation("a"), operation("b"), operation("c")]);
    const state = { siblingEnded: false };
    const calls: string[] = [];
    const result = await executePreparedRun(
      options(run, {
        executeOperation: async ({ node, signal }) => {
          calls.push(node.id);
          if (node.id === "a") {
            await new Promise((resolve) => setTimeout(resolve, 2));

            return err(fault());
          }
          await new Promise<void>((resolve) => {
            if (signal.aborted) resolve();
            else signal.addEventListener("abort", () => resolve(), { once: true });
          });
          state.siblingEnded = true;

          return err(fault("CANCELLED"));
        },
      }),
    );
    expect(codeOf(result)).toBe("BROKEN");
    expect(state.siblingEnded).toBe(true);
    expect(calls).toEqual(["a", "b"]);
  });
  it("records best-effort warnings without publishing failed outputs", async () => {
    const run = prepared([operation("a"), operation("b")]);
    run.pipeline.graph.nodes[0]!.failurePolicy = "best_effort";
    const result = await executePreparedRun(
      options(run, {
        executeOperation: async ({ node }) =>
          node.id === "a" ? err(fault()) : ok({ out: [textValue("yes")] }),
      }),
    );
    expect(result.isOk() ? result.value.warnings.length : -1).toBe(1);
  });
  it("propagates parent cancellation and never dispatches an already cancelled run", async () => {
    const controller = new AbortController();
    const executeOperation = vi.fn(options().executeOperation);
    controller.abort();
    expect(
      codeOf(
        await executePreparedRun(
          options(prepared(), { signal: controller.signal, executeOperation }),
        ),
      ),
    ).toBe("CANCELLED");
    expect(executeOperation).not.toHaveBeenCalled();
  });
  it("retries only explicitly retryable allowlisted failures with fresh attempts", async () => {
    const run = prepared();
    run.pipeline.graph.nodes[0]!.retry = { maxAttempts: 2, retryableCodes: ["TRANSIENT"] };
    const attempts: string[] = [];
    const numbers: number[] = [];
    const result = await executePreparedRun(
      options(run, {
        executeOperation: async ({ attemptId, attemptNumber }) => {
          attempts.push(attemptId);
          numbers.push(attemptNumber);

          return attemptNumber === 1
            ? err(fault("TRANSIENT", true))
            : ok({ out: [textValue("yes")] });
        },
      }),
    );
    expect(codeOf(result)).toBe("OK");
    expect(new Set(attempts).size).toBe(2);
    expect(numbers).toEqual([1, 2]);
    const executor = vi.fn<ExecutePreparedRunOptions["executeOperation"]>(async () =>
      err({ ...fault("TRANSIENT", true), stage: "authentication" }),
    );
    await executePreparedRun(options(run, { executeOperation: executor }));
    expect(executor).toHaveBeenCalledTimes(1);
  });
  it("uses explicit loop feedback and rejects an unmet loop limit", async () => {
    const run = prepared([operation("a", [port("in", { required: false })])]);
    run.pipeline.graph.nodes[0]!.loop = {
      maxIterations: 2,
      feedback: [{ sourcePort: "out", targetPort: "in" }],
      until: {
        portId: "out",
        condition: { operator: "equals", expected: textValue("done"), negate: false },
      },
    };
    const executor = vi.fn<ExecutePreparedRunOptions["executeOperation"]>(async () =>
      ok({ out: [textValue("again")] }),
    );
    expect(codeOf(await executePreparedRun(options(run, { executeOperation: executor })))).toBe(
      "LOOP_LIMIT_REACHED",
    );
    expect(executor.mock.calls[1]![0]).toMatchObject({
      iteration: 2,
      inputs: { in: [textValue("again")] },
    });
  });
  it("requires a checkpoint handler and awaits acknowledgement before execution", async () => {
    const run = prepared();
    run.pipeline.graph.nodes[0]!.checkpoint = true;
    expect(codeOf(await executePreparedRun(options(run)))).toBe("CHECKPOINT_HANDLER_REQUIRED");
    const events: string[] = [];
    expect(
      codeOf(
        await executePreparedRun(
          options(run, {
            waitForCheckpoint: async () => {
              events.push("checkpoint");

              return ok(undefined);
            },
            executeOperation: async () => {
              events.push("execute");

              return ok({ out: [textValue("yes")] });
            },
          }),
        ),
      ),
    ).toBe("OK");
    expect(events).toEqual(["checkpoint", "execute"]);
  });
  it("does not swallow attempt persistence failures or thrown executor errors", async () => {
    const executor = vi.fn(options().executeOperation);
    const result = await executePreparedRun(
      options(prepared(), {
        executeOperation: executor,
        onAttemptStart: async () => err(fault("DB_DOWN")),
      }),
    );
    expect(result.isErr()).toBe(true);
    expect(executor).not.toHaveBeenCalled();
    expect(
      isError(
        await executePreparedRun(
          options(prepared(), {
            onAttemptEnd: async () => {
              throw new Error("db");
            },
          }),
        ),
      ),
    ).toBe(true);
    expect(
      isError(
        await executePreparedRun(
          options(prepared(), {
            executeOperation: async () => {
              throw new Error("executor");
            },
          }),
        ),
      ),
    ).toBe(true);
  });
});
