import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { SkillToOperationDialog } from "./SkillToOperationDialog";

const handleClose = vi.fn();
const mockCreateMutateAsync = vi.fn();
const mockNavigate = vi.fn();

const draftResultData = {
  name: "Service Layer",
  description: "Create Service following tRPC + Service + DAO architecture.",
  sourceSkillId: "skill-003",
  config: {
    executor: { type: "agent", agentMode: "skill", skillId: "skill-003" },
    inputs: [],
    outputs: [],
  },
  acceptedObjectTypes: ["file", "folder", "project", "prompt"],
};

const mockUseOne = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@refinedev/core", () => ({
  useCreate: () => ({ mutateAsync: mockCreateMutateAsync }),
  useOne: (...args: unknown[]) => mockUseOne(...args),
}));

vi.mock("@/store/toastStore", () => ({
  createToastStore: () => ({ getState: () => ({ addToast: () => {} }), setState: () => {}, subscribe: () => () => {} }),
  toastStore: { getState: () => ({ addToast: () => {} }) },
}));

describe("SkillToOperationDialog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCreateMutateAsync.mockResolvedValue({ data: { id: "op-new-1" } });
    mockUseOne.mockReturnValue({
      result: draftResultData,
      query: { isLoading: false },
    });
  });

  it("does not render content when open=false", () => {
    render(
      <SkillToOperationDialog open={false} skillId={null} onClose={handleClose} />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders dialog with prefilled form when open=true and skillId is set", async () => {
    render(
      <SkillToOperationDialog open skillId="skill-003" onClose={handleClose} />,
    );
    await waitFor(() => {
      expect(screen.getByDisplayValue("Service Layer")).toBeInTheDocument();
    });
  });

  it("calls onClose when cancel button is clicked", async () => {
    render(
      <SkillToOperationDialog open skillId="skill-003" onClose={handleClose} />,
    );
    await waitFor(() => {
      expect(screen.getByDisplayValue("Service Layer")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /取消|cancel/i }));
    expect(handleClose).toHaveBeenCalled();
  });

  it("shows loading skeleton when draft is loading", () => {
    mockUseOne.mockReturnValue({
      result: undefined,
      query: { isLoading: true },
    });
    render(
      <SkillToOperationDialog open skillId="skill-003" onClose={handleClose} />,
    );
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("calls createOperation on successful submit", async () => {
    render(
      <SkillToOperationDialog open skillId="skill-003" onClose={handleClose} />,
    );
    await waitFor(() => {
      expect(screen.getByDisplayValue("Service Layer")).toBeInTheDocument();
    });
    // Find and click the submit button (type="submit")
    const form = document.querySelector("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);
    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalled();
    });
  });
});
