import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useList, useOne, useUpdate } from "@refinedev/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasOperationPropertiesForm } from "./CanvasOperationPropertiesForm";

vi.mock("@refinedev/core", () => ({
  useList: vi.fn(),
  useOne: vi.fn(),
  useUpdate: vi.fn(),
}));

const updateOperation = vi.fn();

const mockPartialOperation = () => {
  vi.mocked(useOne).mockReturnValue({
    result: { id: "stress-extract" },
    query: { isLoading: false },
  } as never);
  vi.mocked(useList).mockReturnValue({
    result: { data: [] },
    query: { isLoading: false },
  } as never);
  vi.mocked(useUpdate).mockReturnValue({
    mutateAsync: updateOperation,
  } as never);
};

describe("CanvasOperationPropertiesForm", () => {
  beforeEach(() => {
    updateOperation.mockReset();
    updateOperation.mockResolvedValue({
      data: {
        id: "stress-extract",
        name: "Stress Extract",
        description: null,
        acceptedObjectTypes: ["file", "folder", "github-project"],
        config: { executor: { type: "script", command: "", language: "bash" } },
      },
    });
    mockPartialOperation();
  });

  it("uses safe defaults when an operation record only contains an id", async () => {
    render(<CanvasOperationPropertiesForm operationId="stress-extract" />);

    const nameInput = await screen.findByDisplayValue("stress-extract");
    fireEvent.change(nameInput, { target: { value: "Stress Extract" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(updateOperation).toHaveBeenCalledTimes(1);
    });
    expect(updateOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "stress-extract",
        values: expect.objectContaining({
          name: "Stress Extract",
          acceptedObjectTypes: ["file", "folder", "github-project"],
          config: { executor: { type: "script", command: "", language: "bash" } },
        }),
      }),
    );
  });
});
