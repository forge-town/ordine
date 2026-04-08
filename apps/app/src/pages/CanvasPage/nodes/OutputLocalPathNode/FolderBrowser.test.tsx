import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { FolderBrowser } from "./FolderBrowser";

const mockEntries = [
  { name: "Desktop", type: "directory", path: "/Users/test/Desktop" },
  { name: "Documents", type: "directory", path: "/Users/test/Documents" },
  { name: ".zshrc", type: "file", path: "/Users/test/.zshrc" },
];

beforeEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockEntries),
  });
});

const handleOpenChange = vi.fn();
const handleSelect = vi.fn();

describe("FolderBrowser", () => {
  it("renders dialog with title when open", async () => {
    render(<FolderBrowser open onOpenChange={handleOpenChange} onSelect={handleSelect} />);
    await waitFor(() => {
      expect(screen.getByText("选择文件夹")).toBeInTheDocument();
    });
  });

  it("fetches and displays directory entries on open", async () => {
    render(<FolderBrowser open onOpenChange={handleOpenChange} onSelect={handleSelect} />);
    await waitFor(() => {
      expect(screen.getByText("Desktop")).toBeInTheDocument();
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
  });

  it("only shows directories, not files", async () => {
    render(<FolderBrowser open onOpenChange={handleOpenChange} onSelect={handleSelect} />);
    await waitFor(() => {
      expect(screen.getByText("Desktop")).toBeInTheDocument();
    });
    expect(screen.queryByText(".zshrc")).not.toBeInTheDocument();
  });

  it("navigates into a folder on click", async () => {
    const user = userEvent.setup();
    const subEntries = [{ name: "测试", type: "directory", path: "/Users/test/Desktop/测试" }];

    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEntries),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(subEntries),
      });

    render(<FolderBrowser open onOpenChange={handleOpenChange} onSelect={handleSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Desktop")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Desktop"));

    await waitFor(() => {
      expect(screen.getByText("测试")).toBeInTheDocument();
    });
  });

  it("calls onSelect with the current path when confirmed", async () => {
    const user = userEvent.setup();
    const handleSelectSpy = vi.fn();
    const handleOpenChangeSpy = vi.fn();

    const subEntries = [{ name: "output", type: "directory", path: "/Users/test/Desktop/output" }];

    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEntries),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(subEntries),
      });

    render(<FolderBrowser open onOpenChange={handleOpenChangeSpy} onSelect={handleSelectSpy} />);

    await waitFor(() => {
      expect(screen.getByText("Desktop")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Desktop"));

    await waitFor(() => {
      expect(screen.getByText("output")).toBeInTheDocument();
    });

    await user.click(screen.getByText("选择此文件夹"));

    expect(handleSelectSpy).toHaveBeenCalledWith("/Users/test/Desktop");
    expect(handleOpenChangeSpy).toHaveBeenCalledWith(false);
  });

  it("shows error message when fetch fails", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Path does not exist" }),
    });

    render(<FolderBrowser open onOpenChange={handleOpenChange} onSelect={handleSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Path does not exist")).toBeInTheDocument();
    });
  });
});
