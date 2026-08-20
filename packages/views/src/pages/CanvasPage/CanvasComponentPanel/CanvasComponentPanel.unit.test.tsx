import { render } from "../../../test/test-wrapper";
import type * as RefineCore from "@refinedev/core";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Operation, Skill } from "@repo/schemas";
import { describe, expect, it, vi } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store";
import {
  CANVAS_COMPONENT_DRAG_MIME,
  decodeCanvasComponentDragPayload,
} from "../utils/canvasComponentDragPayload";
import { CanvasComponentPanel } from "./CanvasComponentPanel";

const operations = [
  {
    id: "review-code",
    name: "Review Code",
    description: "Find correctness issues",
    config: {},
    acceptedObjectTypes: ["file"],
  },
] as Operation[];

const skills = [
  {
    id: "skill-error-handling",
    name: "error-handling",
    label: "Error Handling",
    description: "Use neverthrow",
    category: "code-quality",
    tags: ["Neverthrow"],
  },
] as Skill[];

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof RefineCore>()),
  useList: ({ resource }: { resource: string }) => ({
    result: {
      data: resource === "skills" ? skills : operations,
    },
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const renderPanel = () => {
  const store = createCanvasPageStore();
  store.setState({ screenToFlowPosition: (pos) => ({ x: pos.x, y: pos.y }) });

  render(
    <CanvasPageStoreContext.Provider value={store}>
      <CanvasComponentPanel getCreateNodeScreenPosition={() => ({ x: 400, y: 300 })} />
    </CanvasPageStoreContext.Provider>,
  );

  return store;
};

describe("CanvasComponentPanel", () => {
  it("toggles the panel through the current sidebar state", async () => {
    const user = userEvent.setup();
    const store = renderPanel();
    const toggle = screen.getByTestId("canvas-component-panel-toggle");

    expect(screen.getByTestId("canvas-component-panel")).toBeInTheDocument();

    await user.click(toggle);

    expect(store.getState().isSidebarOpen).toBe(false);
    expect(screen.queryByTestId("canvas-component-panel")).not.toBeInTheDocument();

    await user.click(toggle);

    expect(store.getState().isSidebarOpen).toBe(true);
    expect(store.getState().sidebarPanel).toBe("components");
    expect(screen.getByTestId("canvas-component-panel")).toBeInTheDocument();
  });

  it("keeps operation creation on the current develop handler", async () => {
    const user = userEvent.setup();
    const store = renderPanel();
    const handleCreateOperationNode = vi.fn();
    store.setState({ handleCreateOperationNode });

    await user.click(screen.getByRole("button", { name: /Review Code/i }));

    expect(handleCreateOperationNode).toHaveBeenCalledWith(operations[0], { x: 400, y: 300 });
  });

  it("renders a non-collapsible generic compound entry", async () => {
    const user = userEvent.setup();
    const store = renderPanel();
    const handleCreateObjectNode = vi.fn();
    store.setState({ handleCreateObjectNode });

    const compoundCategory = screen.getByTestId("canvas-component-category-compound");
    expect(compoundCategory).toBeInTheDocument();
    expect(compoundCategory).not.toHaveAttribute("aria-expanded");

    await user.click(screen.getByTestId("canvas-component-object-compound"));

    expect(handleCreateObjectNode).toHaveBeenCalledWith("compound", { x: 400, y: 300 });
  });

  it("renders collapsible component categories", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByRole("button", { name: /Input Objects category/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Operations category/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skills category/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Output category/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review Code/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Error Handling/i })).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-component-search-toggle")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Input Objects category/i })).toHaveClass(
      "px-1",
      "pb-1",
      "text-[9.5px]",
      "font-medium",
      "uppercase",
      "tracking-[0.1em]",
      "text-muted-foreground",
    );

    await user.click(screen.getByRole("button", { name: /Operations category/i }));

    expect(screen.queryByRole("button", { name: /Review Code/i })).not.toBeInTheDocument();
  });

  it("filters across categories and focuses search with slash", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.keyboard("/");

    const searchInput = screen.getByRole("textbox", { name: /Search components/i });
    expect(searchInput).toHaveFocus();

    await user.type(searchInput, "never");

    expect(screen.queryByRole("button", { name: /Review Code/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Error Handling/i })).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, "compound");

    expect(screen.getByTestId("canvas-component-object-compound")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Error Handling/i })).not.toBeInTheDocument();
  });

  it("serializes palette items for drag creation", () => {
    renderPanel();

    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      setData: vi.fn((type: string, value: string) => data.set(type, value)),
      setDragImage: vi.fn(),
    };

    fireEvent.dragStart(screen.getByRole("button", { name: /Review Code/i }), {
      dataTransfer,
    });

    expect(dataTransfer.effectAllowed).toBe("copy");
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      CANVAS_COMPONENT_DRAG_MIME,
      expect.any(String),
    );
    expect(JSON.parse(data.get(CANVAS_COMPONENT_DRAG_MIME) ?? "{}")).toMatchObject({
      kind: "operation",
      operation: { id: "review-code" },
    });
    expect(dataTransfer.setDragImage).toHaveBeenCalled();
  });

  it("serializes the generic Compound entry as an object payload", () => {
    renderPanel();

    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      setData: vi.fn((type: string, value: string) => data.set(type, value)),
      setDragImage: vi.fn(),
    };

    fireEvent.dragStart(screen.getByTestId("canvas-component-object-compound"), {
      dataTransfer,
    });

    expect(decodeCanvasComponentDragPayload(data.get(CANVAS_COMPONENT_DRAG_MIME) ?? "")).toEqual({
      kind: "object",
      type: "compound",
    });
  });
});
