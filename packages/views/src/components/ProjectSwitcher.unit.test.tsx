import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as RefineCore from "@refinedev/core";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@repo/ui/sidebar";
import { createSidebarStore, SidebarStoreContext } from "../store/sidebarStore";
import { ProjectSwitcher } from "./ProjectSwitcher";

const refetch = vi.fn();
const createProject = vi.fn();
const projects = [
  {
    id: "project-1",
    name: "Alpha",
    description: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "project-2",
    name: "Beta",
    description: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof RefineCore>()),
  useList: () => ({
    result: { data: projects, total: projects.length },
    query: { isLoading: false, refetch },
  }),
  useCreate: () => ({ mutateAsync: createProject, mutation: { isPending: false } }),
}));

const renderSwitcher = () => {
  const store = createSidebarStore();
  render(
    <SidebarStoreContext.Provider value={store}>
      <SidebarProvider>
        <ProjectSwitcher />
      </SidebarProvider>
    </SidebarStoreContext.Provider>,
  );

  return store;
};

describe("ProjectSwitcher", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    refetch.mockReset();
    createProject.mockReset();
  });

  it("inherits the sidebar header padding so its icon aligns with navigation items", () => {
    renderSwitcher();

    const trigger = screen.getByRole("button", { name: "项目: 所有项目" });

    expect(trigger.parentElement).toHaveClass("py-2");
    expect(trigger.parentElement).not.toHaveClass("px-2");
  });

  it("shows all projects by default and lets the user switch the project filter", async () => {
    const store = renderSwitcher();

    await waitFor(() => expect(store.getState().currentProjectId).toBeNull());
    expect(screen.getByText("所有项目")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "项目: 所有项目" }));
    fireEvent.click(await screen.findByText("Beta"));

    expect(store.getState().currentProjectId).toBe("project-2");
    expect(localStorage.getItem("ordine.sidebar.currentProjectId")).toBe("project-2");

    fireEvent.click(screen.getByRole("button", { name: "项目: Beta" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "所有项目" }));

    expect(store.getState().currentProjectId).toBeNull();
    expect(localStorage.getItem("ordine.sidebar.currentProjectId")).toBeNull();
  });

  it("creates and selects a project through the dialog", async () => {
    createProject.mockResolvedValue({ data: { ...projects[0], id: "project-3", name: "Gamma" } });
    const store = renderSwitcher();

    fireEvent.click(screen.getByRole("button", { name: "项目: 所有项目" }));
    fireEvent.click(await screen.findByText("新建项目"));
    fireEvent.change(screen.getByRole("textbox", { name: "项目名称" }), {
      target: { value: "Gamma" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));

    await waitFor(() => expect(createProject).toHaveBeenCalled());
    expect(createProject).toHaveBeenCalledWith({
      resource: "projects",
      values: { name: "Gamma", description: "" },
    });
    await waitFor(() => expect(store.getState().currentProjectId).toBe("project-3"));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });
});
