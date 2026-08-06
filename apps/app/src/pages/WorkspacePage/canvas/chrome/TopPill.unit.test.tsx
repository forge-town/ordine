import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import type { CanvasNode } from "../_store/canvasTypes";
import { TopPill } from "./TopPill";

const mutateMock = vi.fn();
const customMock = vi.fn();
const getOneMock = vi.fn();
const useOneMock = vi.fn();

vi.mock("@refinedev/core", () => ({
  useOne: (...args: unknown[]) => useOneMock(...args),
  useUpdate: () => ({ mutate: mutateMock }),
}));
vi.mock("@/integrations/refine/dataProvider", () => ({
  ResourceName: { jobs: "jobs", pipelines: "pipelines" },
  dataProvider: {
    custom: (...args: unknown[]) => customMock(...args),
    getOne: (...args: unknown[]) => getOneMock(...args),
  },
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
    getOneMock.mockReset();
    mutateMock.mockReset();
    useOneMock.mockReset();
    useOneMock.mockReturnValue({ query: {} });
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

  it("starts and cancels a runnable pipeline", async () => {
    const user = userEvent.setup();
    customMock.mockResolvedValueOnce({ data: { jobId: "job-42" } });
    customMock.mockResolvedValueOnce({ data: { cancelled: true, jobId: "job-42" } });
    getOneMock.mockResolvedValueOnce({
      data: {
        id: "job-42",
        nodeStatuses: null,
        status: "cancelled",
      },
    });
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
    await user.click(screen.getByTestId("canvas-v2-stop"));

    await waitFor(() => expect(store.getState().activeJobId).toBeNull());
    expect(customMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payload: { jobId: "job-42" },
        url: "pipelines/cancel",
      }),
    );
  });

  it("ignores a stale polling response after a newer run starts", async () => {
    const deferred = {
      resolve: null as
        | null
        | ((value: { data: { id: string; nodeStatuses: null; status: string } }) => void),
    };
    getOneMock.mockReturnValueOnce(
      new Promise((resolve) => {
        deferred.resolve = resolve;
      }),
    );
    const store = createCanvasStore({ nodes: [operationNode] });
    render(<TopPill pipeline={{ id: "pipeline-1", name: "Quiz pipeline", version: 2 }} />, {
      wrapper: makeWrapper(store),
    });

    store.getState().beginRun("job-a");
    await waitFor(() =>
      expect(useOneMock).toHaveBeenLastCalledWith(expect.objectContaining({ id: "job-a" })),
    );
    const options = useOneMock.mock.lastCall?.[0] as {
      queryOptions: { queryFn: () => Promise<unknown> };
    };
    const poll = options.queryOptions.queryFn();
    store.getState().beginRun("job-b");
    deferred.resolve?.({ data: { id: "job-a", nodeStatuses: null, status: "cancelled" } });
    await poll;

    expect(store.getState().activeJobId).toBe("job-b");
  });
});
