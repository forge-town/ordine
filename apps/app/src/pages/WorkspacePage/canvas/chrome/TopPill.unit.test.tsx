import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import type { CanvasNode } from "../_store/canvasTypes";
import { TopPill } from "./TopPill";

const mutateMock = vi.fn();
const customMock = vi.fn();

vi.mock("@refinedev/core", () => ({ useUpdate: () => ({ mutate: mutateMock }) }));
vi.mock("@/integrations/refine/dataProvider", () => ({
  ResourceName: { pipelines: "pipelines" },
  dataProvider: { custom: (...args: unknown[]) => customMock(...args) },
}));
vi.mock("@repo/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuGroup: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));
vi.mock("@repo/ui/scroll-area", () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
vi.mock("@repo/ui/popover", () => ({
  Popover: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  PopoverContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  PopoverTrigger: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

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
  ({ children }: React.PropsWithChildren) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

describe("TopPill", () => {
  beforeEach(() => {
    customMock.mockReset();
    mutateMock.mockReset();
  });

  it("shows pipeline state and persists a renamed pipeline", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore({ nodes: [operationNode] });
    render(<TopPill pipeline={{ id: "pipeline-1", name: "Quiz pipeline", version: 2 }} />, {
      wrapper: makeWrapper(store),
    });

    expect(screen.getByTestId("canvas-v2-run")).toBeEnabled();
    await user.click(screen.getByTestId("canvas-v2-crumb-0"));
    const input = screen.getByTestId("canvas-v2-rename-input");
    await user.clear(input);
    await user.type(input, "Renamed pipeline{Enter}");

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pipeline-1", values: { name: "Renamed pipeline" } }),
    );
  });

  it("starts a runnable pipeline and exposes its running state", async () => {
    const user = userEvent.setup();
    customMock.mockResolvedValueOnce({ data: { jobId: "job-42" } });
    const store = createCanvasStore({ nodes: [operationNode] });
    render(<TopPill pipeline={{ id: "pipeline-1", name: "Quiz pipeline", version: 2 }} />, {
      wrapper: makeWrapper(store),
    });

    await user.click(screen.getByTestId("canvas-v2-run"));

    await waitFor(() => expect(store.getState().activeJobId).toBe("job-42"));
    expect(customMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        payload: { id: "pipeline-1" },
        url: "pipelines/run",
      }),
    );
    expect(screen.getByTestId("canvas-v2-stop")).toBeDisabled();
  });
});
