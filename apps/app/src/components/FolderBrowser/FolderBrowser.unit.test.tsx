import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { FolderBrowser } from "./FolderBrowser";

const mockEntries = [
  { name: "Desktop", type: "directory", path: "/Users/test/Desktop" },
  { name: "Documents", type: "directory", path: "/Users/test/Documents" },
  { name: ".zshrc", type: "file", path: "/Users/test/.zshrc" },
];

const mockUseList = vi.fn();
vi.mock("@refinedev/core", () => ({
  useList: (...args: unknown[]) => mockUseList(...args),
  useCustom: () => ({ result: { data: null }, isLoading: false }),
}));

const makeQueryResult = (data: unknown[], overrides?: Record<string, unknown>) => ({
  query: {
    data: { data, total: data.length },
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  },
});

beforeEach(() => {
  vi.restoreAllMocks();
  mockUseList.mockReturnValue(makeQueryResult(mockEntries));
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

  it("displays directory entries (excluding files in folder mode)", async () => {
    render(<FolderBrowser open onOpenChange={handleOpenChange} onSelect={handleSelect} />);
    expect(screen.getByText("Desktop")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.queryByText(".zshrc")).not.toBeInTheDocument();
  });

  it("shows files in file mode", async () => {
    render(
      <FolderBrowser open mode="file" onOpenChange={handleOpenChange} onSelect={handleSelect} />
    );
    expect(screen.getByText("Desktop")).toBeInTheDocument();
    expect(screen.getByText(".zshrc")).toBeInTheDocument();
  });

  it("navigates into a folder on click", async () => {
    const user = userEvent.setup();
    const subEntries = [{ name: "测试", type: "directory", path: "/Users/test/Desktop/测试" }];

    mockUseList
      .mockReturnValueOnce(makeQueryResult(mockEntries))
      .mockReturnValueOnce(makeQueryResult(subEntries));

    const { rerender } = render(
      <FolderBrowser open onOpenChange={handleOpenChange} onSelect={handleSelect} />
    );

    await user.click(screen.getByText("Desktop"));

    rerender(<FolderBrowser open onOpenChange={handleOpenChange} onSelect={handleSelect} />);

    expect(mockUseList).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ field: "path", operator: "eq", value: "/Users/test/Desktop" }],
      })
    );
  });

  it("calls onSelect with the current path when confirmed", async () => {
    const user = userEvent.setup();
    const handleSelectSpy = vi.fn();
    const handleOpenChangeSpy = vi.fn();

    const subEntries = [{ name: "output", type: "directory", path: "/Users/test/Desktop/output" }];

    mockUseList
      .mockReturnValueOnce(makeQueryResult(mockEntries))
      .mockReturnValueOnce(makeQueryResult(subEntries));

    const { rerender } = render(
      <FolderBrowser open onOpenChange={handleOpenChangeSpy} onSelect={handleSelectSpy} />
    );

    await user.click(screen.getByText("Desktop"));

    rerender(<FolderBrowser open onOpenChange={handleOpenChangeSpy} onSelect={handleSelectSpy} />);

    await user.click(screen.getByText("选择此文件夹"));

    expect(handleSelectSpy).toHaveBeenCalledWith("/Users/test/Desktop");
    expect(handleOpenChangeSpy).toHaveBeenCalledWith(false);
  });

  it("shows loading state", async () => {
    mockUseList.mockReturnValue({
      query: {
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      },
    });

    render(<FolderBrowser open onOpenChange={handleOpenChange} onSelect={handleSelect} />);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("shows error message when query fails", async () => {
    mockUseList.mockReturnValue({
      query: {
        data: undefined,
        isLoading: false,
        isError: true,
        error: { message: "Path does not exist" },
      },
    });

    render(<FolderBrowser open onOpenChange={handleOpenChange} onSelect={handleSelect} />);
    expect(screen.getByText("Path does not exist")).toBeInTheDocument();
  });
});
