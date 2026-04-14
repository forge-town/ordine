import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { FolderTreePreview } from "./FolderTreePreview";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const mockEntries = [
  { name: "node_modules", type: "directory", path: "/project/node_modules" },
  { name: "src", type: "directory", path: "/project/src" },
  { name: "dist", type: "directory", path: "/project/dist" },
  { name: "package.json", type: "file", path: "/project/package.json" },
];

const handleExcludeNoop = () => {};

describe("FolderTreePreview", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockEntries),
    });
  });

  it("fetches and displays directory entries", async () => {
    render(
      <FolderTreePreview excludedPaths={[]} folderPath="/project" onExclude={handleExcludeNoop} />
    );

    await waitFor(() => {
      expect(screen.getByText("node_modules")).toBeInTheDocument();
    });

    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.getByText("dist")).toBeInTheDocument();
    expect(screen.getByText("package.json")).toBeInTheDocument();
  });

  it("shows excluded entries with strikethrough style", async () => {
    render(
      <FolderTreePreview
        excludedPaths={["node_modules"]}
        folderPath="/project"
        onExclude={handleExcludeNoop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("node_modules")).toBeInTheDocument();
    });

    const excludedItem = screen.getByText("node_modules");
    expect(excludedItem.closest("[data-excluded]")).toHaveAttribute("data-excluded", "true");
  });

  it("calls onExclude when exclude button is clicked on a non-excluded entry", async () => {
    const user = userEvent.setup();
    const handleExclude = vi.fn();

    render(
      <FolderTreePreview excludedPaths={[]} folderPath="/project" onExclude={handleExclude} />
    );

    await waitFor(() => {
      expect(screen.getByText("node_modules")).toBeInTheDocument();
    });

    const excludeButtons = screen.getAllByRole("button", { name: /排除/ });
    await user.click(excludeButtons[0]);

    expect(handleExclude).toHaveBeenCalledWith("node_modules");
  });

  it("does not render when folderPath is empty", () => {
    const { container } = render(
      <FolderTreePreview excludedPaths={[]} folderPath="" onExclude={handleExcludeNoop} />
    );

    expect(container.firstChild).toBeNull();
  });
});
