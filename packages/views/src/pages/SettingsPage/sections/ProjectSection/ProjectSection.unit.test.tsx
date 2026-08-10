import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSidebarStore, SidebarStoreContext } from "../../../../store/sidebarStore";
import { ProjectSection } from "./ProjectSection";

const { updateProject } = vi.hoisted(() => ({
  updateProject: vi.fn(),
}));

const projects = [
  {
    id: "project-1",
    name: "Alpha",
    description: "First project",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "project-2",
    name: "Beta",
    description: "Second project",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

vi.mock("@refinedev/core", () => ({
  useList: () => ({ result: { data: projects, total: projects.length } }),
  useUpdate: () => ({ mutate: updateProject }),
}));

const renderProjectSection = (currentProjectId: string | null) => {
  const store = createSidebarStore();
  store.getState().setCurrentProjectId(currentProjectId);

  render(
    <SidebarStoreContext.Provider value={store}>
      <ProjectSection />
    </SidebarStoreContext.Provider>,
  );
};

describe("ProjectSection", () => {
  beforeEach(() => {
    localStorage.clear();
    updateProject.mockReset();
  });

  it("does not fall back to the first project when all projects are selected", () => {
    renderProjectSection(null);

    expect(screen.getByText("还没有选中项目 — 先在侧栏创建一个。")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-project-name")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-project-save")).not.toBeInTheDocument();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it("updates only the explicitly selected project", () => {
    renderProjectSection("project-2");

    fireEvent.change(screen.getByTestId("settings-project-name"), {
      target: { value: "Beta updated" },
    });
    fireEvent.click(screen.getByTestId("settings-project-save"));

    expect(updateProject).toHaveBeenCalledWith(
      {
        errorNotification: false,
        id: "project-2",
        resource: "projects",
        successNotification: false,
        values: { description: "Second project", name: "Beta updated" },
      },
      { onError: expect.any(Function), onSuccess: expect.any(Function) },
    );
  });
});
