import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import type { CanvasNode } from "../_store/canvasTypes";
import { TopPill } from "./TopPill";

vi.mock("@repo/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({
    children,
    ...props
  }: React.ComponentProps<"button"> & { children: React.ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ComponentProps<"button"> & { children: React.ReactNode }) => (
    <button type="button" disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

const mutateMock = vi.fn();
const customMock = vi.fn();

vi.mock("@refinedev/core", () => ({
  useUpdate: () => ({ mutate: mutateMock }),
}));

vi.mock("@/integrations/refine/dataProvider", () => ({
  ResourceName: { pipelines: "pipelines" },
  dataProvider: {
    custom: (...args: unknown[]) => customMock(...args),
  },
}));

const pipeline = { id: "pipeline-1", name: "Quiz pipeline", version: 2 };

const operationNode: CanvasNode = {
  data: {
    config: {},
    label: "Parse",
    nodeType: "operation",
    operationId: "op-1",
    operationName: "Parse",
    status: "idle",
  },
  id: "node-op",
  position: { x: 0, y: 0 },
  type: "operation",
};

const makeWrapper =
  (store: CanvasStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

describe("TopPill", () => {
  beforeEach(() => {
    mutateMock.mockReset();
    customMock.mockReset();
  });

  it("disables Run when there is no operation node", () => {
    const store = createCanvasStore();
    render(<TopPill pipeline={pipeline} />, { wrapper: makeWrapper(store) });

    expect(screen.getByTestId("canvas-v2-run")).toBeDisabled();
  });

  it("starts a run and records the job id", async () => {
    const user = userEvent.setup();
    customMock.mockResolvedValue({ data: { jobId: "job-42" } });
    const store = createCanvasStore({ nodes: [operationNode] });
    render(<TopPill pipeline={pipeline} />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("canvas-v2-run"));

    await waitFor(() => {
      expect(store.getState().activeJobId).toBe("job-42");
    });
    expect(customMock).toHaveBeenCalledWith(
      expect.objectContaining({ method: "post", url: "pipelines/run" }),
    );
    expect(screen.getByTestId("canvas-v2-stop")).toBeDisabled();
  });

  it("renames the pipeline from the breadcrumb", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    render(<TopPill pipeline={pipeline} />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("canvas-v2-crumb-0"));
    const input = screen.getByTestId("canvas-v2-rename-input");
    await user.clear(input);
    await user.type(input, "Renamed pipeline{Enter}");

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pipeline-1",
        values: { name: "Renamed pipeline" },
      }),
    );
  });

  it("saves the graph as a new version", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    render(<TopPill pipeline={pipeline} />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("canvas-v2-version-menu-trigger"));
    await user.click(screen.getByTestId("canvas-v2-version-save-as-new"));

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pipeline-1",
        values: expect.objectContaining({ version: 3 }),
      }),
      expect.anything(),
    );
  });
});
