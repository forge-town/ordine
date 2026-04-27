import { render } from "@/test/test-wrapper";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Operation } from "@repo/schemas";
import { OperationsPageContent } from "./OperationsPageContent";

const mockOps = vi.fn<() => Operation[]>(() => []);
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLoaderData: () => mockOps(),
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/services/operationsService", () => ({
  createOperation: vi.fn(),
  updateOperation: vi.fn(),
  deleteOperation: vi.fn(),
}));

import { createStore } from "zustand";
const testStore = createStore<Record<string, unknown>>((set) => ({
  searchQuery: "",
  sortBy: "default",
  sortOpen: false,
  importing: false,
  handleSetSearchQuery: (q: string) => set({ searchQuery: q }),
  handleSetSortBy: (s: string) => set({ sortBy: s }),
  handleSetSortOpen: (o: boolean) => set({ sortOpen: o }),
  handleToggleSortOpen: () => set((state) => ({ sortOpen: !state.sortOpen })),
  handleSetImporting: (i: boolean) => set({ importing: i }),
}));
vi.mock("../_store", () => ({
  useOperationsPageStore: () => testStore,
}));

vi.mock("@refinedev/core", () => ({
  useList: () => {
    const d = mockOps();

    return {
      result: { data: d, total: d.length },
      data: { data: d, total: d.length },
      isLoading: false,
      isError: false,
    };
  },
  useDelete: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCreate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useUpdate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCustomMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInvalidate: () => vi.fn(),
  useOne: () => ({ result: null, isLoading: false }),
}));

const makeOp = (overrides: Partial<Operation> & { id: string; name: string }): Operation => ({
  description: null,
  config: { inputs: [], outputs: [] },
  acceptedObjectTypes: ["file"],
  meta: { createdAt: new Date(), updatedAt: new Date() },
  ...overrides,
});

describe("OperationsPageContent", () => {
  beforeEach(() => {
    testStore.setState({ searchQuery: "", sortBy: "default", sortOpen: false, importing: false });
    mockOps.mockReturnValue([]);
    mockNavigate.mockClear();
  });

  describe("displays all operations", () => {
    const ops = [
      makeOp({ id: "op1", name: "Alpha Op" }),
      makeOp({ id: "op2", name: "Beta Op" }),
      makeOp({ id: "op3", name: "Gamma Op" }),
    ];

    it("shows all ops in the list", () => {
      mockOps.mockReturnValue(ops);
      render(<OperationsPageContent />);
      expect(screen.getByText("Alpha Op")).toBeInTheDocument();
      expect(screen.getByText("Beta Op")).toBeInTheDocument();
      expect(screen.getByText("Gamma Op")).toBeInTheDocument();
    });
  });

  describe("search", () => {
    const ops = [
      makeOp({ id: "op1", name: "Constitution Plan", description: "Set up project principles" }),
      makeOp({ id: "op2", name: "Run ESLint", description: "Lint the source code" }),
      makeOp({ id: "op3", name: "Deploy Build" }),
    ];

    beforeEach(() => {
      mockOps.mockReturnValue(ops);
    });

    it("renders a search input", () => {
      render(<OperationsPageContent />);
      expect(screen.getByPlaceholderText(/搜索/i)).toBeInTheDocument();
    });

    it("shows all ops when search is empty", () => {
      render(<OperationsPageContent />);
      expect(screen.getByText("Constitution Plan")).toBeInTheDocument();
      expect(screen.getByText("Run ESLint")).toBeInTheDocument();
      expect(screen.getByText("Deploy Build")).toBeInTheDocument();
    });

    it("filters by name (case-insensitive)", async () => {
      const user = userEvent.setup();
      render(<OperationsPageContent />);
      await user.type(screen.getByPlaceholderText(/搜索/i), "eslint");
      expect(screen.getByText("Run ESLint")).toBeInTheDocument();
      expect(screen.queryByText("Constitution Plan")).not.toBeInTheDocument();
      expect(screen.queryByText("Deploy Build")).not.toBeInTheDocument();
    });

    it("filters by description (case-insensitive)", async () => {
      const user = userEvent.setup();
      render(<OperationsPageContent />);
      await user.type(screen.getByPlaceholderText(/搜索/i), "principles");
      expect(screen.getByText("Constitution Plan")).toBeInTheDocument();
      expect(screen.queryByText("Run ESLint")).not.toBeInTheDocument();
    });

    it("shows empty message when no ops match search", async () => {
      const user = userEvent.setup();
      render(<OperationsPageContent />);
      await user.type(screen.getByPlaceholderText(/搜索/i), "zzznomatch");
      expect(screen.getByText("不存在")).toBeInTheDocument();
    });

    it("clears search and shows all ops again", async () => {
      const user = userEvent.setup();
      render(<OperationsPageContent />);
      const input = screen.getByPlaceholderText(/搜索/i);
      await user.type(input, "eslint");
      await user.clear(input);
      expect(screen.getByText("Constitution Plan")).toBeInTheDocument();
      expect(screen.getByText("Run ESLint")).toBeInTheDocument();
      expect(screen.getByText("Deploy Build")).toBeInTheDocument();
    });
  });

  describe("sort", () => {
    const ops = [
      makeOp({
        id: "op3",
        name: "Zebra Task",
        meta: { createdAt: new Date(1000), updatedAt: new Date(1000) },
      }),
      makeOp({
        id: "op1",
        name: "Alpha Task",
        meta: { createdAt: new Date(3000), updatedAt: new Date(3000) },
      }),
      makeOp({
        id: "op2",
        name: "Mango Task",
        meta: { createdAt: new Date(2000), updatedAt: new Date(2000) },
      }),
    ];

    const getCardNames = () => screen.getAllByText(/Task$/).map((el) => el.textContent ?? "");

    beforeEach(() => {
      mockOps.mockReturnValue(ops);
    });

    it("default order preserves insertion order", () => {
      render(<OperationsPageContent />);
      expect(getCardNames()).toEqual(["Zebra Task", "Alpha Task", "Mango Task"]);
    });

    it("sort by name ascending (A → Z)", () => {
      testStore.setState({ sortBy: "name-asc" });
      render(<OperationsPageContent />);
      expect(getCardNames()).toEqual(["Alpha Task", "Mango Task", "Zebra Task"]);
    });

    it("sort by name descending (Z → A)", () => {
      testStore.setState({ sortBy: "name-desc" });
      render(<OperationsPageContent />);
      expect(getCardNames()).toEqual(["Zebra Task", "Mango Task", "Alpha Task"]);
    });

    it("sort by newest first (createdAt desc)", () => {
      testStore.setState({ sortBy: "date-desc" });
      render(<OperationsPageContent />);
      expect(getCardNames()).toEqual(["Alpha Task", "Mango Task", "Zebra Task"]);
    });

    it("sort by oldest first (createdAt asc)", () => {
      testStore.setState({ sortBy: "date-asc" });
      render(<OperationsPageContent />);
      expect(getCardNames()).toEqual(["Zebra Task", "Mango Task", "Alpha Task"]);
    });
  });

  describe("edit navigation", () => {
    const existingOp = makeOp({ id: "op-1", name: "Lint Check", description: "Runs ESLint" });

    beforeEach(() => {
      mockOps.mockReturnValue([existingOp]);
    });

    // TODO: base-ui Menu.Portal does not render in JSDOM; test edit flow in OperationCard unit tests
    it.skip("clicking edit button navigates to /operations/$operationId/edit", async () => {
      const { container } = render(<OperationsPageContent />);
      const menuTrigger = container.querySelector(
        '[data-slot="dropdown-menu-trigger"]'
      ) as HTMLElement;
      await userEvent.click(menuTrigger);
      const editItem = await screen.findByText("common.edit");
      await userEvent.click(editItem);
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/operations/$operationId/edit",
        params: { operationId: "op-1" },
      });
    });

    // TODO: base-ui Menu.Portal does not render in JSDOM; test edit flow in OperationCard unit tests
    it.skip("clicking edit button does NOT show an inline form", async () => {
      const { container, queryByText } = render(<OperationsPageContent />);
      const menuTrigger = container.querySelector(
        '[data-slot="dropdown-menu-trigger"]'
      ) as HTMLElement;
      await userEvent.click(menuTrigger);
      const editItem = await screen.findByText("common.edit");
      await userEvent.click(editItem);
      expect(queryByText("编辑 Operation", { selector: "h2" })).not.toBeInTheDocument();
    });
  });

  describe("create navigation", () => {
    it("navigates to /operations/new when 新建 Operation is clicked", () => {
      render(<OperationsPageContent />);
      const buttons = screen.getAllByText("新建 Operation");
      fireEvent.click(buttons[0]);
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/operations/new" });
    });

    it("does NOT open the inline form after clicking 新建 Operation", () => {
      render(<OperationsPageContent />);
      const buttons = screen.getAllByText("新建 Operation");
      fireEvent.click(buttons[0]);
      expect(screen.queryByText("新建 Operation", { selector: "h2" })).not.toBeInTheDocument();
    });
  });

  describe("no native select elements", () => {
    it("does not render a native <select> for the sort control", () => {
      const { container } = render(<OperationsPageContent />);
      expect(container.querySelector('select[aria-label="排序"]')).toBeNull();
      expect(container.querySelector("select#sort-select")).toBeNull();
    });
  });
});
