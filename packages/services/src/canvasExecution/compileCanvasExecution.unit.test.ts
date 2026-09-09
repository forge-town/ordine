import { describe, expect, it } from "vitest";
import {
  OperationSchema,
  PipelineSchema,
  PipelineDefinitionContentSchema,
  type PipelineData,
} from "@repo/schemas";
import { compileDefinitionGraph } from "@repo/pipeline-engine";
import {
  compileCanvasExecution,
  getCanvasExecutionInputs,
  getCanvasExecutionOperationIds,
} from "./compileCanvasExecution";

const fixture = () => ({
  pipeline: PipelineSchema.parse({
    id: "pipeline",
    name: "Prompt to report",
    description: "Pure authoring fixture",
    sharedContext: "Shared context",
    tags: [],
    timeoutMs: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    nodes: [
      {
        id: "prompt",
        type: "prompt",
        position: { x: 0, y: 20 },
        data: {
          nodeType: "prompt",
          label: "Source",
          prompt: "Input payload 🚀",
          valueType: "text",
        },
      },
      {
        id: "script",
        type: "operation",
        position: { x: 240, y: 20 },
        data: {
          nodeType: "operation",
          label: "Render",
          operationName: "Render",
          operationId: "render",
          status: "idle",
          checkpoint: true,
        },
      },
      {
        id: "report",
        type: "output-local-path",
        position: { x: 480, y: 20 },
        data: {
          nodeType: "output-local-path",
          label: "Report",
          storage: "artifact",
          localPath: "",
          outputFileName: "report.md",
        },
      },
    ],
    edges: [
      {
        id: "prompt-script",
        source: "prompt",
        target: "script",
        data: { handoff: { kind: "handoff", sourcePortId: "output", targetPortId: "source" } },
      },
      {
        id: "script-report",
        source: "script",
        target: "report",
        data: { handoff: { kind: "handoff", sourcePortId: "result", targetPortId: "input" } },
      },
    ],
  }),
  operations: [
    OperationSchema.parse({
      id: "render",
      name: "Render",
      description: "A script whose source must remain unchanged",
      config: {
        executor: {
          type: "script",
          language: "javascript",
          command: "console.log('# Report')",
          outputMode: "text",
        },
        inputs: [
          {
            id: "source",
            name: "Source",
            kind: "prompt",
            accepts: ["text/plain"],
            required: true,
            cardinality: "one",
          },
        ],
        outputs: [
          {
            id: "result",
            name: "Report",
            contentType: "markdown",
            produces: ["text/markdown"],
            required: true,
            cardinality: "one",
          },
        ],
      },
    }),
  ],
  operationRevisions: { render: 4, "output:report": 2 } as Record<string, number>,
});

const outputData = (pipeline: PipelineData) => {
  const data = pipeline.nodes.find((node) => node.id === "report")!.data;
  if (data.nodeType !== "output-local-path")
    throw new Error("Fixture report must be an output node");

  return data;
};

describe("compileCanvasExecution", () => {
  it("publishes an opened and selected React Flow draft without changing its execution content", () => {
    const input = fixture();
    const expected = compileCanvasExecution(input);
    input.pipeline.nodes.forEach((node) =>
      Object.assign(node, {
        measured: { width: 214, height: 56 },
        selected: true,
        dragging: false,
      }),
    );
    input.pipeline.edges.forEach((edge) => Object.assign(edge, { selected: true }));
    expect(compileCanvasExecution(input)).toEqual(expected);
    Object.assign(input.pipeline.nodes[0]!, { unexpectedExecutionSetting: true });
    expect(compileCanvasExecution(input).success).toBe(false);
  });
  it("compiles Prompt → Script → managed artifact into a valid pinned graph without executing or mutating the draft", () => {
    const input = fixture();
    const original = structuredClone(input);
    const result = compileCanvasExecution(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(PipelineDefinitionContentSchema.safeParse(result.definition).success).toBe(true);
    expect(compileDefinitionGraph(result.definition.graph, result.operations).isOk()).toBe(true);
    expect(getCanvasExecutionOperationIds(input.pipeline)).toEqual(["render", "output:report"]);
    expect(getCanvasExecutionInputs(input.pipeline)).toEqual({
      "input-prompt": [{ kind: "text", value: "Input payload 🚀" }],
    });
    expect(result.operations[0]).toMatchObject({
      id: "render",
      revision: 4,
      executor: { kind: "script", source: "console.log('# Report')", outputMode: "text" },
    });
    expect(result.operations[1]).toMatchObject({
      id: "output:report",
      revision: 2,
      executor: {
        kind: "builtin",
        name: "write_artifact",
        config: { name: "report.md", mimeType: "text/markdown" },
      },
      outputPorts: [{ id: "file", valueType: "artifact", mimeTypes: ["text/markdown"] }],
    });
    expect(result.definition.graph.nodes.map((node) => node.id)).toEqual(["script", "report"]);
    expect(result.definition.graph.nodes[0]!.checkpoint).toBe(true);
    expect(result.definition.graph.edges).toEqual([
      {
        id: "prompt-script",
        source: { kind: "input", portId: "input-prompt" },
        target: { nodeId: "script", portId: "source" },
        order: 0,
      },
      {
        id: "script-report",
        source: { kind: "node", nodeId: "script", portId: "result" },
        target: { nodeId: "report", portId: "input" },
        order: 0,
      },
    ]);
    expect(result.definition.graph.outputs[0]).toMatchObject({
      port: { valueType: "artifact" },
      source: { nodeId: "report", portId: "file" },
    });
    expect(result.definition.editor.nodePositions).toEqual({
      script: { x: 240, y: 20 },
      report: { x: 480, y: 20 },
    });
    expect(input).toEqual(original);
  });

  it.each(["text", "json"] as const)(
    "compiles direct %s Prompt → artifact without inventing an intermediate authoring Operation",
    (valueType) => {
      const input = fixture();
      input.pipeline.nodes = input.pipeline.nodes.filter((node) => node.id !== "script");
      const prompt = input.pipeline.nodes[0]!.data;
      if (prompt.nodeType !== "prompt") throw new Error("Fixture prompt missing");
      prompt.valueType = valueType;
      prompt.prompt = valueType === "json" ? '{"answer":42,"items":["one"]}' : "Direct text";
      input.pipeline.edges = [
        {
          id: "direct",
          source: "prompt",
          target: "report",
          data: {
            label: "",
            handoff: { kind: "handoff", sourcePortId: "output", targetPortId: "input" },
          },
        },
      ];
      input.operations = [];
      const result = compileCanvasExecution(input);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(compileDefinitionGraph(result.definition.graph, result.operations).isOk()).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]!.executor).toMatchObject({
        name: "write_artifact",
        config: { mimeType: valueType === "json" ? "application/json" : "text/plain" },
      });
      expect(result.definition.graph.edges[0]!.source).toEqual({
        kind: "input",
        portId: "input-prompt",
      });
      expect(getCanvasExecutionInputs(input.pipeline)["input-prompt"]).toEqual([
        {
          kind: valueType,
          value: valueType === "json" ? { answer: 42, items: ["one"] } : "Direct text",
        },
      ]);
    },
  );

  it.each([
    [
      "implicit Prompt handles",
      (input: ReturnType<typeof fixture>) => {
        delete input.pipeline.edges[0]!.data!.handoff;
        input.pipeline.edges[0]!.sourceHandle = "output";
        input.pipeline.edges[0]!.targetHandle = "source";
      },
    ],
    [
      "implicit output handles",
      (input: ReturnType<typeof fixture>) => {
        delete input.pipeline.edges[1]!.data!.handoff;
        input.pipeline.edges[1]!.sourceHandle = "result";
        input.pipeline.edges[1]!.targetHandle = "input";
      },
    ],
    [
      "unknown source port",
      (input: ReturnType<typeof fixture>) => {
        input.pipeline.edges[1]!.data!.handoff!.sourcePortId = "guess";
      },
    ],
    [
      "unknown input port",
      (input: ReturnType<typeof fixture>) => {
        input.pipeline.edges[0]!.data!.handoff!.targetPortId = "guess";
      },
    ],
    [
      "multiple file sources",
      (input: ReturnType<typeof fixture>) => {
        input.pipeline.edges.push({ ...structuredClone(input.pipeline.edges[1]!), id: "second" });
      },
    ],
    [
      "legacy local-path destination",
      (input: ReturnType<typeof fixture>) => {
        delete outputData(input.pipeline).storage;
        outputData(input.pipeline).localPath = "C:/old-output";
      },
    ],
    [
      "managed output with a local path",
      (input: ReturnType<typeof fixture>) => {
        outputData(input.pipeline).localPath = "C:/old-output";
      },
    ],
    [
      "path disguised as filename",
      (input: ReturnType<typeof fixture>) => {
        outputData(input.pipeline).outputFileName = "../report.md";
      },
    ],
    [
      "legacy write strategy",
      (input: ReturnType<typeof fixture>) => {
        Object.assign(outputData(input.pipeline), { outputMode: "append" });
      },
    ],
    [
      "unbound writer revision",
      (input: ReturnType<typeof fixture>) => {
        delete input.operationRevisions["output:report"];
      },
    ],
    [
      "inherited writer revision",
      (input: ReturnType<typeof fixture>) => {
        input.operationRevisions = Object.assign(Object.create({ "output:report": 2 }), {
          render: 4,
        });
      },
    ],
    [
      "invalid JSON Prompt",
      (input: ReturnType<typeof fixture>) => {
        Object.assign(input.pipeline.nodes[0]!.data, { valueType: "json", prompt: "{" });
      },
    ],
    [
      "JSON/text mismatch",
      (input: ReturnType<typeof fixture>) => {
        Object.assign(input.pipeline.nodes[0]!.data, {
          valueType: "json",
          prompt: '{"answer":42}',
        });
      },
    ],
    [
      "conditional file delivery",
      (input: ReturnType<typeof fixture>) => {
        Object.assign(input.pipeline.edges[1]!.data!, { condition: {} });
      },
    ],
  ])("rejects %s with diagnostics and no executable partial result", (_, change) => {
    const input = fixture();
    change(input);
    const result = compileCanvasExecution(input);
    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result).not.toHaveProperty("definition");
  });
});
