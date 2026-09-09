import { describe, expect, it } from "vitest";
import { PipelineDefinitionSchema } from "./PipelineDefinitionSchema";
import { OperationRevisionSchema } from "./OperationRevisionSchema";
import { PreparedRunSchema } from "./PreparedRunSchema";
import {
  EXECUTION_TIMEOUT_DEFAULTS,
  ResolvedNodeExecutionSchema,
} from "./ResolvedNodeExecutionSchema";
import { ExecutionArtifactSchema } from "./ExecutionArtifactSchema";

const port = (id: string) => ({ id, valueType: "text", cardinality: "one" });
const operation = OperationRevisionSchema.parse({
  apiVersion: 2,
  id: "identity",
  revision: 1,
  name: "Identity",
  inputPorts: [port("in")],
  outputPorts: [port("out")],
  executor: { kind: "builtin", name: "identity" },
});
const pipeline = PipelineDefinitionSchema.parse({
  apiVersion: 2,
  id: "pipeline-1",
  revision: 1,
  name: "Identity",
  graph: {
    schemaVersion: 2,
    inputs: [port("source")],
    nodes: [{ id: "node-1", operation: { operationId: "identity", revision: 1 } }],
    edges: [
      {
        id: "edge-1",
        source: { kind: "input", portId: "source" },
        target: { nodeId: "node-1", portId: "in" },
        order: 0,
      },
    ],
    outputs: [{ port: port("result"), source: { nodeId: "node-1", portId: "out" } }],
  },
});
const resolved = ResolvedNodeExecutionSchema.parse({
  executorKind: "builtin",
  timeouts: EXECUTION_TIMEOUT_DEFAULTS,
  origins: {
    firstOutputTimeoutMs: "policy",
    inactivityTimeoutMs: "policy",
    activeRunTimeoutMs: "policy",
    waitingTimeoutMs: "policy",
  },
});
const prepared = () => ({
  apiVersion: 2,
  id: "prepared-1",
  subjectId: "owner",
  workspaceId: "local",
  createdAt: "2026-09-05T12:00:00Z",
  pipeline: structuredClone(pipeline),
  operations: [structuredClone(operation)],
  resolvedNodes: { "node-1": structuredClone(resolved) },
  inputs: { source: [{ kind: "text", value: "hello" }] },
  deliveryRequirements: [],
  risk: { requiresApproval: false, reasons: [] },
  contentHash: "a".repeat(64),
});

describe("PreparedRun relationships", () => {
  it("rejects different active or waiting budgets within one Job", () => {
    const value = prepared();
    value.pipeline.graph.nodes.push({ ...value.pipeline.graph.nodes[0]!, id: "node-2" });
    const resolvedNodes = { ...value.resolvedNodes, "node-2": structuredClone(resolved) };
    expect(PreparedRunSchema.safeParse({ ...value, resolvedNodes }).success).toBe(true);
    resolvedNodes["node-2"].timeouts.waitingTimeoutMs = 100;
    expect(PreparedRunSchema.safeParse({ ...value, resolvedNodes }).success).toBe(false);
  });
  it("pins script executable and fingerprint together without Agent options", () => {
    const value = {
      executorKind: "script",
      timeouts: EXECUTION_TIMEOUT_DEFAULTS,
      origins: {},
      executablePath: "C:/node.exe",
      executableSha256: "a".repeat(64),
    };
    expect(ResolvedNodeExecutionSchema.safeParse(value).success).toBe(true);
    expect(
      ResolvedNodeExecutionSchema.safeParse({ ...value, executableSha256: undefined }).success,
    ).toBe(false);
    expect(ResolvedNodeExecutionSchema.safeParse({ ...value, model: "model-a" }).success).toBe(
      false,
    );
    expect(
      ResolvedNodeExecutionSchema.safeParse({ ...value, executorKind: "builtin" }).success,
    ).toBe(false);
  });
  it("retains an exact Operation revision and resolved configuration", () => {
    const parsed = PreparedRunSchema.parse(prepared());
    expect(parsed.operations[0]?.revision).toBe(1);
    expect(parsed.resolvedNodes["node-1"]?.executorKind).toBe("builtin");
  });
  it("rejects replacing a referenced revision with latest", () => {
    const value = prepared();
    value.operations[0]!.revision = 2;
    expect(PreparedRunSchema.safeParse(value).success).toBe(false);
  });
  it("rejects duplicate and unrelated revisions", () => {
    const value = prepared();
    value.operations.push({ ...operation });
    expect(PreparedRunSchema.safeParse(value).success).toBe(false);
    value.operations[1] = { ...operation, id: "unrelated" };
    expect(PreparedRunSchema.safeParse(value).success).toBe(false);
  });
  it("requires every node to have exactly its resolved execution", () => {
    expect(PreparedRunSchema.safeParse({ ...prepared(), resolvedNodes: {} }).success).toBe(false);
    expect(
      PreparedRunSchema.safeParse({
        ...prepared(),
        resolvedNodes: { "node-1": resolved, unknown: resolved },
      }).success,
    ).toBe(false);
    expect(
      PreparedRunSchema.safeParse({
        ...prepared(),
        resolvedNodes: { "node-1": { ...resolved, executorKind: "script" } },
      }).success,
    ).toBe(false);
  });
  it("rejects unknown inputs, secret fields, and inconsistent approval flags", () => {
    expect(PreparedRunSchema.safeParse({ ...prepared(), inputs: { unknown: [] } }).success).toBe(
      false,
    );
    expect(PreparedRunSchema.safeParse({ ...prepared(), apiKey: "secret" }).success).toBe(false);
    expect(
      PreparedRunSchema.safeParse({
        ...prepared(),
        risk: { requiresApproval: false, reasons: ["script execution"] },
      }).success,
    ).toBe(false);
  });
  it("validates editor references separately from runtime grouping", () => {
    expect(
      PipelineDefinitionSchema.safeParse({
        ...pipeline,
        editor: { schemaVersion: 2, groups: [{ id: "g", label: "Group", nodeIds: ["unknown"] }] },
      }).success,
    ).toBe(false);
    expect(
      PipelineDefinitionSchema.safeParse({
        ...pipeline,
        editor: { schemaVersion: 2, nodePositions: { unknown: { x: 0, y: 0 } } },
      }).success,
    ).toBe(false);
    expect(
      PipelineDefinitionSchema.safeParse({
        ...pipeline,
        editor: { schemaVersion: 2, groups: [{ id: "g", label: "Group", nodeIds: ["node-1"] }] },
      }).success,
    ).toBe(true);
  });
  it("keeps job deadlines out of node and Operation overrides", () => {
    expect(
      OperationRevisionSchema.safeParse({
        ...operation,
        executionDefaults: { waitingTimeoutMs: 1 },
      }).success,
    ).toBe(false);
    const value = prepared();
    value.pipeline.graph.nodes[0]!.executionOverrides = { activeRunTimeoutMs: 1 } as never;
    expect(PreparedRunSchema.safeParse(value).success).toBe(false);
  });
});

describe("execution artifact metadata", () => {
  const artifact = {
    artifactId: "a-1",
    jobId: "j-1",
    nodeId: "n-1",
    portId: "report",
    attemptId: "attempt-1",
    name: "报告.json",
    mimeType: "application/json",
    sizeBytes: 3,
    sha256: "a".repeat(64),
    state: "published",
    createdAt: "2026-09-05T12:00:00Z",
  };
  it("exposes identity and content verification without a filesystem path", () => {
    expect(ExecutionArtifactSchema.parse(artifact).name).toBe("报告.json");
    expect(ExecutionArtifactSchema.safeParse({ ...artifact, path: "C:/secret" }).success).toBe(
      false,
    );
    expect(
      ExecutionArtifactSchema.safeParse({ ...artifact, storageKey: "jobs/private" }).success,
    ).toBe(false);
  });
  it.each([
    "../report.json",
    "C:report.json",
    "CON.txt",
    "report:stream",
    "file.",
    " file.txt",
    "folder\\file.txt",
  ])("rejects unsafe filename %s", (name) => {
    expect(ExecutionArtifactSchema.safeParse({ ...artifact, name }).success).toBe(false);
  });
});
