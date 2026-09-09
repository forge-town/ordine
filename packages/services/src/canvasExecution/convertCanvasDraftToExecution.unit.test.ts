import { describe, expect, it } from "vitest";
import {
  OperationSchema,
  PipelineSchema,
  PipelineDefinitionContentSchema,
  OperationExecutorConfigSchema,
  AssignedOperationExecutorConfigSchema,
} from "@repo/schemas";
import { convertCanvasDraftToExecution } from "./convertCanvasDraftToExecution";

const fixture = () => {
  const operations = ["producer", "consumer"].map((id) =>
    OperationSchema.parse({
      id,
      name: id,
      config: {
        executor: { type: "agent", agentMode: "prompt", prompt: "Return the requested value." },
        inputs:
          id === "consumer"
            ? [
                {
                  id: "input",
                  name: "Input",
                  kind: "prompt",
                  required: true,
                  accepts: ["text/plain"],
                },
              ]
            : [],
        outputs: [
          { id: "output", name: "Output", contentType: "text", cardinality: "one", required: true },
        ],
      },
    }),
  );
  const pipeline = PipelineSchema.parse({
    id: "pipeline",
    name: "Draft",
    description: "Description",
    sharedContext: "Context",
    tags: [],
    timeoutMs: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    nodes: operations.map((operation, index) => ({
      id: `node-${index}`,
      type: "operation",
      position: { x: index * 200, y: 40 },
      data: {
        nodeType: "operation",
        label: operation.name,
        operationId: operation.id,
        operationName: operation.name,
        status: "idle",
        checkpoint: true,
      },
    })),
    edges: [
      {
        id: "edge",
        source: "node-0",
        target: "node-1",
        data: {
          label: "",
          handoff: { kind: "handoff", sourcePortId: "output", targetPortId: "input" },
        },
      },
    ],
  });

  return { pipeline, operations, operationRevisions: { producer: 3, consumer: 8 } };
};

describe("convertCanvasDraftToExecution", () => {
  it("preserves explicit node routing and timeout zero without filling absent fields", () => {
    const input = fixture();
    const node = input.pipeline.nodes[0]!;
    if (node.data.nodeType !== "operation") throw new Error("Expected Operation node");
    node.data.executionOverrides = {
      runtimeConfigId: "saved-codex",
      model: "chosen-model",
      firstOutputTimeoutMs: 0,
    };
    const converted = convertCanvasDraftToExecution(input);
    expect(converted.success).toBe(true);
    if (!converted.success) return;
    expect(converted.definition.graph.nodes[0]!.executionOverrides).toEqual(
      node.data.executionOverrides,
    );
    expect(converted.definition.graph.nodes[1]!.executionOverrides).toEqual({});
    expect(converted.operations[0]!.executionDefaults).toEqual({});
  });

  it.each(["text", "json", "manifest"] as const)(
    "preserves explicit Script %s mode through authoring schema and conversion",
    (outputMode) => {
      const input = fixture();
      const executor = {
        type: "script" as const,
        language: "javascript" as const,
        command: "console.log('value')",
        outputMode,
        assignmentReason: "User selected output mode",
      };
      input.operations[0]!.config.executor = OperationExecutorConfigSchema.parse(executor);
      expect(AssignedOperationExecutorConfigSchema.parse(executor)).toMatchObject({ outputMode });
      if (outputMode === "json") {
        input.operations[0]!.config.outputs[0]!.contentType = "json";
        input.operations[1]!.config.inputs[0]!.accepts = ["application/json"];
      }
      const result = convertCanvasDraftToExecution(input);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.operations[0]!.executor).toEqual({
        kind: "script",
        language: "javascript",
        source: executor.command,
        outputMode,
      });
    },
  );

  it("does not assign outputMode when parsing legacy Script configuration", () => {
    const executor = OperationExecutorConfigSchema.parse({
      type: "script",
      language: "bash",
      command: "echo hello",
    });
    expect(executor).not.toHaveProperty("outputMode");
  });

  it("accepts the explicit codex family and rejects another family", () => {
    const input = fixture();
    input.operations[0]!.config.executor!.agent = "codex";
    expect(convertCanvasDraftToExecution(input).success).toBe(true);
    input.operations[0]!.config.executor!.agent = "claude-code";
    const result = convertCanvasDraftToExecution(input);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.path.includes("agent"))).toBe(true);
  });

  it.each([
    ["markdown", "text/markdown"],
    ["html", "text/html"],
    ["csv", "text/csv"],
    ["yaml", "application/yaml"],
    ["xml", "application/xml"],
  ] as const)("maps %s to text while validating its produced MIME", (contentType, mime) => {
    const input = fixture();
    input.operations[0]!.config.outputs[0]!.contentType = contentType;
    input.operations[0]!.config.outputs[0]!.produces = [mime];
    const result = convertCanvasDraftToExecution(input);
    expect(result.success && result.operations[0]!.outputPorts[0]!.valueType).toBe("text");
    input.operations[0]!.config.outputs[0]!.produces = ["application/octet-stream"];
    const invalid = convertCanvasDraftToExecution(input);
    expect(invalid.success).toBe(false);
    expect(invalid.diagnostics.some((diagnostic) => diagnostic.path.includes("produces"))).toBe(
      true,
    );
  });

  it("refuses to drop output template references", () => {
    const input = fixture();
    input.operations[0]!.config.outputs[0]!.templateIds = ["template-1"];
    const result = convertCanvasDraftToExecution(input);
    expect(result.success).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.path.includes("templateIds") && diagnostic.message.includes("materialization"),
      ),
    ).toBe(true);
  });

  it("rejects unordered fan-in even for many-valued ports", () => {
    const input = fixture();
    input.operations[0]!.config.outputs[0]!.cardinality = "many";
    input.operations[1]!.config.inputs[0]!.cardinality = "many";
    input.pipeline.nodes.push({ ...structuredClone(input.pipeline.nodes[0]!), id: "node-2" });
    input.pipeline.edges.push({
      ...structuredClone(input.pipeline.edges[0]!),
      id: "edge-2",
      source: "node-2",
    });
    const result = convertCanvasDraftToExecution(input);
    expect(result.success).toBe(false);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.message.includes("explicit order")),
    ).toBe(true);
  });

  it("rejects loop controls and locates the affected node", () => {
    const input = fixture();
    Object.assign(input.pipeline.nodes[0]!.data, { loopEnabled: true, maxLoopCount: 3 });
    const result = convertCanvasDraftToExecution(input);
    expect(result.success).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.nodeId === "node-0" && diagnostic.path.includes("loopEnabled"),
      ),
    ).toBe(true);
  });

  it("preserves pinned revisions, explicit ports, checkpoints and editor positions without mutating the draft", () => {
    const input = fixture();
    const before = structuredClone(input);
    const result = convertCanvasDraftToExecution(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(PipelineDefinitionContentSchema.safeParse(result.definition).success).toBe(true);
    expect(result.operations.map((operation) => operation.revision)).toEqual([3, 8]);
    expect(result.definition.graph.nodes[1]).toMatchObject({
      operation: { operationId: "consumer", revision: 8 },
      checkpoint: true,
    });
    expect(result.definition.graph.edges[0]).toMatchObject({
      source: { kind: "node", nodeId: "node-0", portId: "output" },
      target: { nodeId: "node-1", portId: "input" },
      order: 0,
    });
    expect(result.operations[1]?.inputPorts[0]?.cardinality).toBe("one");
    expect(result.definition.editor.nodePositions["node-1"]).toEqual({ x: 200, y: 40 });
    expect(result.definition.graph.outputs).toEqual([]);
    expect(input).toEqual(before);
  });

  it("converts explicit JSON input and output contracts", () => {
    const input = fixture();
    input.operations.forEach((operation) => {
      operation.config.outputs[0]!.contentType = "json";
    });
    input.operations[1]!.config.inputs[0]!.accepts = ["application/json"];
    const result = convertCanvasDraftToExecution(input);
    expect(result.success && result.operations[1]?.inputPorts[0]?.valueType).toBe("json");
  });

  it.each([
    [
      "missing revision",
      (input: ReturnType<typeof fixture>) => {
        delete (input.operationRevisions as Record<string, number>).producer;
      },
    ],
    [
      "unstable port",
      (input: ReturnType<typeof fixture>) => {
        delete input.operations[0]!.config.outputs[0]!.id;
      },
    ],
    [
      "UI-only handles",
      (input: ReturnType<typeof fixture>) => {
        delete input.pipeline.edges[0]!.data!.handoff;
        input.pipeline.edges[0]!.sourceHandle = "output";
        input.pipeline.edges[0]!.targetHandle = "input";
      },
    ],
    [
      "unknown port",
      (input: ReturnType<typeof fixture>) => {
        input.pipeline.edges[0]!.data!.handoff!.targetPortId = "missing";
      },
    ],
    [
      "script output mode absent",
      (input: ReturnType<typeof fixture>) => {
        input.operations[0]!.config.executor = {
          type: "script",
          language: "javascript",
          command: "console.log('text')",
        };
      },
    ],
    [
      "path input",
      (input: ReturnType<typeof fixture>) => {
        input.operations[1]!.config.inputs[0]!.kind = "file";
      },
    ],
    [
      "compound nesting",
      (input: ReturnType<typeof fixture>) => {
        input.pipeline.nodes[0]!.parentId = "compound";
      },
    ],
    [
      "pipeline timeout",
      (input: ReturnType<typeof fixture>) => {
        input.pipeline.timeoutMs = 1000;
      },
    ],
    [
      "type mismatch",
      (input: ReturnType<typeof fixture>) => {
        input.operations[0]!.config.outputs[0]!.contentType = "json";
      },
    ],
    [
      "unbound required input",
      (input: ReturnType<typeof fixture>) => {
        input.pipeline.edges = [];
      },
    ],
    [
      "cycle",
      (input: ReturnType<typeof fixture>) => {
        input.pipeline.edges[0]!.target = "node-0";
      },
    ],
  ])("rejects %s without a partial executable definition", (_, change) => {
    const input = fixture();
    change(input);
    const result = convertCanvasDraftToExecution(input);
    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result).not.toHaveProperty("definition");
    expect(result.diagnostics[0]?.path.length).toBeGreaterThan(0);
  });

  it.each(["condition", "transform", "qualityGate", "dataContract", "unknownExecutionField"])(
    "rejects edge semantics %s instead of stripping them",
    (field) => {
      const input = fixture();
      Object.assign(input.pipeline.edges[0]!.data!, { [field]: {} });
      const result = convertCanvasDraftToExecution(input);
      expect(result.success).toBe(false);
      expect(result.diagnostics.some((diagnostic) => diagnostic.path.includes(field))).toBe(true);
    },
  );
});
