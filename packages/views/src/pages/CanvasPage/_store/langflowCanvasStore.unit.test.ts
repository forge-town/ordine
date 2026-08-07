import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Operation, Skill } from "@repo/schemas";
import { createCanvasPageStore } from "./canvasPageStore";
import type { PipelineNode } from "./canvasSlice";

const dataProviderMocks = vi.hoisted(() => ({
  create: vi.fn(),
  getList: vi.fn(),
}));

vi.mock("../../../lib/canvasDataProvider", () => ({
  getCanvasDataProvider: () => ({
    create: dataProviderMocks.create,
    getList: dataProviderMocks.getList,
  }),
}));

const fileNode = {
  id: "file-1",
  type: "file",
  position: { x: 0, y: 0 },
  data: {
    label: "Source File",
    nodeType: "file",
    filePath: "src/index.ts",
    language: "typescript",
  },
} as PipelineNode;

const skill = {
  id: "skill-error-handling",
  name: "error-handling",
  label: "Error Handling",
  description: "Use neverthrow for errors",
  category: "code-quality",
  tags: ["Neverthrow"],
} as Skill;

const skillOperation = {
  id: "op-skill-error-handling",
  name: "Error Handling",
  description: "Use neverthrow for errors",
  acceptedObjectTypes: ["file", "folder", "github-project", "prompt"],
  config: {
    executor: {
      type: "agent",
      agentMode: "skill",
      skillId: skill.id,
    },
    inputs: [],
    outputs: [],
  },
} as Operation;

describe("langflow canvas store state", () => {
  it("defaults to compact node cards and component panel state", () => {
    const store = createCanvasPageStore();

    expect(store.getState().nodeCardMode).toBe("compact");
    expect(store.getState().sidebarPanel).toBe("components");
    expect(store.getState().isWorkspaceSidebarOpen).toBe(false);
    expect(store.getState().canvasTool).toBe("hand");
  });

  it("switches between components and properties as canvas selection changes", () => {
    const store = createCanvasPageStore([fileNode]);

    store.getState().focusNode(fileNode.id);

    expect(store.getState().selectedNodeId).toBe(fileNode.id);
    expect(store.getState().sidebarPanel).toBe("properties");
    expect(store.getState().isPropertiesPanelOpen).toBe(true);

    store.getState().clearSelection();

    expect(store.getState().selectedNodeId).toBeNull();
    expect(store.getState().sidebarPanel).toBe("components");
    expect(store.getState().isPropertiesPanelOpen).toBe(false);
  });

  it("toggles compact and expanded node card mode", () => {
    const store = createCanvasPageStore();

    store.getState().toggleNodeCardMode();

    expect(store.getState().nodeCardMode).toBe("expanded");

    store.getState().toggleNodeCardMode();

    expect(store.getState().nodeCardMode).toBe("compact");
  });

  it("switches between hand and select canvas tools", () => {
    const store = createCanvasPageStore();

    store.getState().setCanvasTool("select");
    expect(store.getState().canvasTool).toBe("select");

    store.getState().setCanvasTool("hand");
    expect(store.getState().canvasTool).toBe("hand");
  });
});

describe("langflow skill operation creation", () => {
  beforeEach(() => {
    dataProviderMocks.create.mockReset();
    dataProviderMocks.getList.mockReset();
  });

  it("reuses an existing skill-backed operation when adding a skill node", async () => {
    dataProviderMocks.getList.mockResolvedValue({ data: [skillOperation], total: 1 });
    const store = createCanvasPageStore();
    store.setState({ screenToFlowPosition: (pos) => ({ x: pos.x / 2, y: pos.y / 2 }) });

    await store.getState().handleCreateSkillOperationNode(skill, { x: 800, y: 600 });

    expect(dataProviderMocks.create).not.toHaveBeenCalled();
    expect(store.getState().nodes).toEqual([
      expect.objectContaining({
        type: "operation",
        origin: [0.5, 0.5],
        position: { x: 400, y: 300 },
        data: expect.objectContaining({
          operationId: skillOperation.id,
          operationName: skillOperation.name,
        }),
      }),
    ]);
  });

  it("creates a backing operation before adding a new skill node", async () => {
    dataProviderMocks.getList.mockResolvedValue({ data: [], total: 0 });
    dataProviderMocks.create.mockResolvedValue({ data: skillOperation });
    const store = createCanvasPageStore();

    await store.getState().handleCreateSkillOperationNode(skill, { x: 100, y: 120 });

    expect(dataProviderMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "operations",
        variables: expect.objectContaining({
          id: "skill-operation-skill-error-handling",
          name: skill.label,
          config: expect.objectContaining({
            executor: expect.objectContaining({
              type: "agent",
              agentMode: "skill",
              skillId: skill.id,
            }),
          }),
        }),
      }),
    );
    expect(store.getState().nodes).toHaveLength(1);
  });
});
