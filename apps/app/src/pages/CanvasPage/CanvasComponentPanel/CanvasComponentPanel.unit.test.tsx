import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Operation, Skill } from "@repo/schemas";
import { describe, expect, it, vi } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store";
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

vi.mock("@refinedev/core", () => ({
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
  it("renders collapsible component categories", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByRole("button", { name: /Input Objects category/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Operations category/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skills category/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Output category/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review Code/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Error Handling/i })).toBeInTheDocument();

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
  });
});
