import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchPipelineDialog } from "./SearchPipelineDialog";

const navigate = vi.fn();
const pipelines = [
  {
    id: "pipeline-1",
    name: "Release notes",
    description: "Create a changelog from merged pull requests",
  },
  {
    id: "pipeline-2",
    name: "Issue triage",
    description: "Classify new issues",
  },
];

const searchStore = vi.hoisted(() => {
  type SearchState = {
    handleSearchButtonClick: () => void;
    handleSearchDialogOpenChange: (open: boolean) => void;
    searchOpen: boolean;
  };
  const listeners = new Set<() => void>();
  const store = {
    state: {} as SearchState,
    getInitialState: () => store.state,
    getState: () => store.state,
    setState: (patch: Partial<SearchState>) => {
      store.state = { ...store.state, ...patch };
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
  };
  store.state = {
    handleSearchButtonClick: () => store.setState({ searchOpen: true }),
    handleSearchDialogOpenChange: (searchOpen) => store.setState({ searchOpen }),
    searchOpen: false,
  };

  return store;
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({ result: { data: pipelines } }),
}));

vi.mock("../store/sidebarStore", () => ({
  useSidebarStore: () => searchStore,
}));

beforeEach(() => {
  navigate.mockReset();
  searchStore.setState({ searchOpen: false });
});

describe("SearchPipelineDialog", () => {
  it("opens with Cmd+K and filters pipelines", async () => {
    const user = userEvent.setup();
    render(<SearchPipelineDialog />);

    fireEvent.keyDown(document, { code: "KeyK", ctrlKey: true, key: "k" });
    const input = await screen.findByRole("textbox");
    await user.type(input, "triage");

    expect(screen.getByText("Issue triage")).toBeInTheDocument();
    expect(screen.queryByText("Release notes")).not.toBeInTheDocument();
  });

  it("navigates to the selected pipeline canvas", async () => {
    const user = userEvent.setup();
    searchStore.setState({ searchOpen: true });
    render(<SearchPipelineDialog />);

    await user.click(screen.getByRole("button", { name: /Release notes/ }));

    expect(navigate).toHaveBeenCalledWith({
      search: { id: "pipeline-1" },
      to: "/canvas",
    });
    expect(searchStore.getState().searchOpen).toBe(false);
  });
});
