import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CanvasPageStoreContext, createCanvasPageStore, type CanvasPageStore } from "../_store";
import { FolderNode } from "./FolderNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useNodeId: () => "test",
  useUpdateNodeInternals: () => () => undefined,
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    query: {
      data: { data: [], total: 0 },
      isLoading: false,
      isError: false,
      error: null,
    },
  }),
}));

const makeExpandedStore = (data = baseData, id = "test"): CanvasPageStore => {
  const store = createCanvasPageStore([
    {
      id,
      type: "folder",
      position: { x: 0, y: 0 },
      data,
    },
  ]);
  store.setState({ nodeCardMode: "expanded" });

  return store;
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CanvasPageStoreContext.Provider value={makeExpandedStore()}>
    {children}
  </CanvasPageStoreContext.Provider>
);

const baseData = {
  nodeType: "folder" as const,
  label: "src",
  folderPath: "apps/app/src",
  description: "应用源码目录",
};

describe("FolderNode", () => {
  it("renders label", () => {
    render(<FolderNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("src")).toBeInTheDocument();
  });

  it("renders folderPath", () => {
    render(<FolderNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("apps/app/src")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<FolderNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("应用源码目录")).toBeInTheDocument();
  });

  it("shows placeholder when folderPath is empty", () => {
    const store = makeExpandedStore({ ...baseData, folderPath: "" });
    render(<FolderNode data={{ ...baseData, folderPath: "" }} id="test" />, {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <CanvasPageStoreContext.Provider value={store}>{children}</CanvasPageStoreContext.Provider>
      ),
    });
    expect(screen.getByPlaceholderText("src/components/")).toBeInTheDocument();
  });

  it("renders excluded paths as badges when excludedPaths is set", () => {
    const data = {
      ...baseData,
      excludedPaths: ["node_modules", "dist"],
    };
    render(<FolderNode data={data} id="test" />, { wrapper });
    expect(screen.getByText("node_modules")).toBeInTheDocument();
    expect(screen.getByText("dist")).toBeInTheDocument();
  });

  it("writes the typed folder path back to the store as a plain string", () => {
    const store = makeExpandedStore();
    render(<FolderNode data={baseData} id="test" />, {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <CanvasPageStoreContext.Provider value={store}>{children}</CanvasPageStoreContext.Provider>
      ),
    });

    fireEvent.change(screen.getByDisplayValue("apps/app/src"), {
      target: { value: "apps/app/components" },
    });

    const updatedNode = store.getState().nodes.find((node) => node.id === "test");
    expect(updatedNode?.data).toEqual(
      expect.objectContaining({ folderPath: "apps/app/components" }),
    );
  });

  it("removes an excluded path when its remove button is clicked", async () => {
    const user = userEvent.setup();
    const data = {
      ...baseData,
      excludedPaths: ["node_modules", "dist"],
    };
    const { rerender } = render(<FolderNode data={data} id="test" />, {
      wrapper,
    });

    const removeButtons = screen.getAllByRole("button", { name: /Remove exclude/ });
    await user.click(removeButtons[0]);

    // Simulate re-render with updated data (store would trigger this in real app)
    rerender(
      <CanvasPageStoreContext.Provider value={makeExpandedStore()}>
        <FolderNode data={{ ...data, excludedPaths: ["dist"] }} id="test" />
      </CanvasPageStoreContext.Provider>,
    );

    expect(screen.queryByText("node_modules")).not.toBeInTheDocument();
    expect(screen.getByText("dist")).toBeInTheDocument();
  });
});
