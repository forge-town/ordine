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
  acceptedObjectTypes: ["file", "folder", "github-project", "prompt"],
};

const singleStepAnalysis = {
  skillType: "single-step",
  steps: [
    {
      name: "Service Layer",
      description: "Create Service following tRPC + Service + DAO architecture.",
      suggestedOutputs: [],
    },
  ],
  rationale: "Single atomic task",
};

const multiStepAnalysis = {
  skillType: "multi-step",
  steps: [
    {
      name: "Define Schema",
      description: "Define Zod schema for the feature.",
      suggestedOutputs: [{ name: "schema.ts", contentType: "text" }],
    },
    {
      name: "Implement DAO",
      description: "Create DAO layer with Drizzle ORM.",
      suggestedOutputs: [{ name: "dao.ts", contentType: "text" }],
    },
  ],
  rationale: "Multi-phase feature implementation",
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
  createToastStore: () => ({
    getState: () => ({ addToast: () => {} }),
    setState: () => {},
    subscribe: () => () => {},
  }),
  toastStore: { getState: () => ({ addToast: () => {} }) },
  ToastStoreContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
  },
}));

describe("SkillToOperationDialog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCreateMutateAsync.mockResolvedValue({ data: { id: "op-new-1" } });
    mockUseOne.mockImplementation((opts: { resource: string }) => {
      if (opts.resource === "skillAnalyses") {
        return { result: singleStepAnalysis, query: { isLoading: false } };
      }

      return { result: draftResultData, query: { isLoading: false } };
    });
  });

  it("does not render content when open=false", () => {
    render(<SkillToOperationDialog open={false} skillId={null} onClose={handleClose} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders dialog with prefilled form when open=true and skillId is set", async () => {
    render(<SkillToOperationDialog open skillId="skill-003" onClose={handleClose} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Service Layer")).toBeInTheDocument();
    });
  });

  it("calls onClose when cancel button is clicked", async () => {
    render(<SkillToOperationDialog open skillId="skill-003" onClose={handleClose} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Service Layer")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /取消|cancel/i }));
    expect(handleClose).toHaveBeenCalled();
  });

  it("shows loading skeleton when draft is loading", () => {
    mockUseOne.mockImplementation((opts: { resource: string }) => {
      if (opts.resource === "skillAnalyses") {
        return { result: singleStepAnalysis, query: { isLoading: false } };
      }

      return { result: undefined, query: { isLoading: true } };
    });
    render(<SkillToOperationDialog open skillId="skill-003" onClose={handleClose} />);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("calls createOperation on successful submit", async () => {
    render(<SkillToOperationDialog open skillId="skill-003" onClose={handleClose} />);
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

  describe("multi-step skill", () => {
    beforeEach(() => {
      mockUseOne.mockImplementation((opts: { resource: string }) => {
        if (opts.resource === "skillAnalyses") {
          return { result: multiStepAnalysis, query: { isLoading: false } };
        }

        return { result: draftResultData, query: { isLoading: false } };
      });
    });

    it("renders step list editor for multi-step analysis", async () => {
      render(<SkillToOperationDialog open skillId="skill-003" onClose={handleClose} />);
      await waitFor(() => {
        expect(screen.getByText(/step\s*1/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/step\s*2/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue("Define Schema")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Implement DAO")).toBeInTheDocument();
    });

    it("calls createOperation multiple times on save as operations", async () => {
      render(<SkillToOperationDialog open skillId="skill-003" onClose={handleClose} />);
      await waitFor(() => {
        expect(screen.getByText(/step\s*1/i)).toBeInTheDocument();
      });

      const saveBtn = screen.getByText(/skills.createOperation.saveAsOperations/i);
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledTimes(2);
      });

      const firstCall = mockCreateMutateAsync.mock.calls[0][0];
      expect(firstCall.values.name).toBe("Define Schema");
      expect(firstCall.values.sourceSkillId).toBe("skill-003");

      const secondCall = mockCreateMutateAsync.mock.calls[1][0];
      expect(secondCall.values.name).toBe("Implement DAO");
    });

    it("calls createPipeline on generate pipeline draft", async () => {
      render(<SkillToOperationDialog open skillId="skill-003" onClose={handleClose} />);
      await waitFor(() => {
        expect(screen.getByText(/step\s*1/i)).toBeInTheDocument();
      });

      const pipelineBtn = screen.getByText(/skills.createOperation.generatePipeline/i);
      fireEvent.click(pipelineBtn);

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalled();
      });

      // createPipeline uses the same useCreate hook
      const calls = mockCreateMutateAsync.mock.calls;
      const pipelineCall = calls.find((call) => call[0].resource === "pipelines");
      expect(pipelineCall).toBeTruthy();
      expect(pipelineCall![0].values.nodes).toHaveLength(2);
      expect(pipelineCall![0].values.edges).toHaveLength(1);
      expect(pipelineCall![0].values.pendingOperations).toHaveLength(2);
    });
  });

  describe("analysis failure fallback", () => {
    beforeEach(() => {
      mockUseOne.mockImplementation((opts: { resource: string }) => {
        if (opts.resource === "skillAnalyses") {
          return { result: undefined, query: { isLoading: false } };
        }

        return { result: draftResultData, query: { isLoading: false } };
      });
    });

    it("falls back to single-step form when analysis returns no result", async () => {
      render(<SkillToOperationDialog open skillId="skill-003" onClose={handleClose} />);
      await waitFor(() => {
        expect(screen.getByDisplayValue("Service Layer")).toBeInTheDocument();
      });
    });
  });
});
