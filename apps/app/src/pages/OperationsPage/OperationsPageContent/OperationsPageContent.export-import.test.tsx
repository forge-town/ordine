import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { OperationsPageContent } from "./OperationsPageContent";
import type { OperationEntity } from "@/models/daos/operationsDao";
import { createOperation } from "@/services/operationsService";
import { useToastStore } from "@/store/toastStore";

const mockUseLoaderData = vi.fn(() => [] as OperationEntity[]);

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useLoaderData: () => mockUseLoaderData(),
  Link: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/services/operationsService", () => ({
  createOperation: vi.fn(),
  updateOperation: vi.fn(),
  deleteOperation: vi.fn(),
}));

const mockOperation: OperationEntity = {
  id: "op-1",
  name: "Run ESLint",
  description: "Lint source files",
  config: '{"command":"eslint src/"}',
  acceptedObjectTypes: ["file", "folder"],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

describe("OperationsPageContent - export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLoaderData.mockReturnValue([mockOperation]);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an export button on each operation card", () => {
    render(<OperationsPageContent />);
    expect(screen.getByTitle("导出")).toBeInTheDocument();
  });

  it("clicking export creates an object URL from a JSON blob", () => {
    render(<OperationsPageContent />);
    fireEvent.click(screen.getByTitle("导出"));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });
});

describe("OperationsPageContent - import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLoaderData.mockReturnValue([]);
    vi.mocked(createOperation).mockResolvedValue({
      ...mockOperation,
      id: "op-imported",
      name: "Run ESLint",
    } as OperationEntity);
  });

  it("renders an import button in the header", () => {
    render(<OperationsPageContent />);
    expect(screen.getByRole("button", { name: /导入/i })).toBeInTheDocument();
  });

  it("importing a valid JSON file calls createOperation with parsed data", async () => {
    render(<OperationsPageContent />);
    const importBtn = screen.getByRole("button", { name: /导入/i });
    fireEvent.click(importBtn);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const jsonContent = JSON.stringify(mockOperation);
    const file = new File([jsonContent], "operation.json", {
      type: "application/json",
    });

    Object.defineProperty(fileInput, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(createOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Run ESLint",
          }),
        }),
      );
    });
  });

  it("imported operation appears in the list", async () => {
    render(<OperationsPageContent />);
    const importBtn = screen.getByRole("button", { name: /导入/i });
    fireEvent.click(importBtn);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File([JSON.stringify(mockOperation)], "op.json", {
      type: "application/json",
    });
    Object.defineProperty(fileInput, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText("Run ESLint")).toBeInTheDocument();
    });
  });
});

describe("OperationsPageContent - import validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLoaderData.mockReturnValue([]);
    useToastStore.setState({ toasts: [] });
  });

  it("shows an error toast when the file is not valid JSON", async () => {
    render(<OperationsPageContent />);
    const importBtn = screen.getByRole("button", { name: /导入/i });
    fireEvent.click(importBtn);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["not valid json {{{"], "bad.json", {
      type: "application/json",
    });
    Object.defineProperty(fileInput, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);

    await waitFor(() => {
      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.type === "error")).toBe(true);
    });
  });

  it("shows an error toast when 'name' field is missing from the JSON", async () => {
    render(<OperationsPageContent />);
    const importBtn = screen.getByRole("button", { name: /导入/i });
    fireEvent.click(importBtn);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const missingName = { category: "lint", config: "{}" };
    const file = new File([JSON.stringify(missingName)], "no-name.json", {
      type: "application/json",
    });
    Object.defineProperty(fileInput, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);

    await waitFor(() => {
      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.type === "error")).toBe(true);
    });
  });

  it("shows a success toast after a valid import", async () => {
    vi.mocked(createOperation).mockResolvedValue({
      ...mockOperation,
      id: "op-imported",
    } as OperationEntity);

    render(<OperationsPageContent />);
    const importBtn = screen.getByRole("button", { name: /导入/i });
    fireEvent.click(importBtn);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File([JSON.stringify(mockOperation)], "op.json", {
      type: "application/json",
    });
    Object.defineProperty(fileInput, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);

    await waitFor(() => {
      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.type === "success")).toBe(true);
    });
  });
});
