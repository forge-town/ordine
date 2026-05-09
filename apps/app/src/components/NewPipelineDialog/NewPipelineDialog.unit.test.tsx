import { render } from "@/test/test-wrapper";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NewPipelineDialog } from "./NewPipelineDialog";
import { SidebarStoreContext, createSidebarStore, type SidebarStore } from "@/store/sidebarStore";

const mockGenerateStructure = vi.fn();
const mockAnalyzeIntent = vi.fn();
const mockRunMutate = vi.fn();
const mockCreatePipelineMutate = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/integrations/trpc/client", () => ({
  trpcClient: {},
}));

vi.mock("@/integrations/refine/dataProvider", () => ({
  dataProvider: {
    create: (...args: unknown[]) => mockCreatePipelineMutate(...args),
    custom: (params: { url: string; payload: unknown }) => {
      if (params.url === "pipelines/analyzeIntent") return mockAnalyzeIntent(params.payload);
      if (params.url === "pipelines/generateStructure")
        return mockGenerateStructure(params.payload);
      if (params.url === "pipelines/run") return mockRunMutate(params.payload);

      return Promise.resolve({ data: {} });
    },
  },
  ResourceName: {
    pipelines: "pipelines",
  },
}));

vi.mock("@tanstack/react-router", () => ({}));

vi.mock("@/router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("@/lib/i18n", () => ({
  default: { t: (key: string) => key },
}));

vi.mock("@repo/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <h2 className={className}>{children}</h2>
  ),
  DialogDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  DialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@repo/ui/button", () => ({
  Button: ({ children, onClick: handleClick, disabled }: React.ComponentProps<"button">) => (
    <button disabled={disabled} onClick={handleClick}>
      {children}
    </button>
  ),
}));

vi.mock("@repo/ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}));

vi.mock("@repo/ui/textarea", () => ({
  Textarea: (props: React.ComponentProps<"textarea">) => <textarea {...props} />,
}));

vi.mock("@repo/ui/badge", () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span data-testid="badge">{children}</span>,
}));

vi.mock("@repo/ui/tooltip", () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipProvider: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@repo/ui/scroll-area", () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ScrollBar: () => null,
}));

vi.mock("lucide-react", () => ({
  AlertCircle: () => <span data-testid="alert-circle-icon" />,
  AlertTriangle: () => <span data-testid="alert-icon" />,
  ArrowLeft: () => <span data-testid="arrow-left-icon" />,
  ArrowRight: () => <span data-testid="arrow-right-icon" />,
  CheckCircle2: () => <span data-testid="check-icon" />,
  ExternalLink: () => <span data-testid="external-link-icon" />,
  Loader2: () => <span data-testid="loader" />,
  Play: () => <span data-testid="play-icon" />,
  Plus: () => <span data-testid="plus-icon" />,
}));

const createWrapper = (store: SidebarStore) => {
  return ({ children }: React.PropsWithChildren) => (
    <SidebarStoreContext.Provider value={store}>{children}</SidebarStoreContext.Provider>
  );
};

describe("NewPipelineDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreatePipelineMutate.mockResolvedValue({ data: { id: "pipe-1" } });
    mockGenerateStructure.mockResolvedValue({ data: { nodes: [], edges: [] } });
    mockAnalyzeIntent.mockResolvedValue({
      data: { matchedOperations: [], unmatchedSteps: [] },
    });
    mockRunMutate.mockResolvedValue({ data: {} });
  });

  it("does not render when dialog is closed", () => {
    const store = createSidebarStore();
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("renders form when dialog is open", () => {
    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("common.create")).toBeInTheDocument();
  });

  it("skips analysis and creates directly when description is empty", async () => {
    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    const createButton = screen.getByText("common.create");
    await userEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreatePipelineMutate).toHaveBeenCalled();
    });
    expect(mockAnalyzeIntent).not.toHaveBeenCalled();
    expect(mockGenerateStructure).not.toHaveBeenCalled();
  });

  it("calls analyzeIntent when description is provided", async () => {
    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    mockAnalyzeIntent.mockResolvedValue({
      data: {
        matchedOperations: [{ operationId: "op-1", operationName: "lint-code", reason: "Matches" }],
        unmatchedSteps: [],
      },
    });

    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    const textarea = screen.getByPlaceholderText("newPipelineDialog.descriptionPlaceholder");
    await userEvent.type(textarea, "Build a CI pipeline");

    const createButton = screen.getByText("common.create");
    await userEvent.click(createButton);

    await waitFor(() => {
      expect(mockAnalyzeIntent).toHaveBeenCalledWith({
        name: "pipelines.createNew",
        description: "Build a CI pipeline",
      });
    });
  });

  it("shows success state after creation", async () => {
    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    mockCreatePipelineMutate.mockResolvedValue({ data: { id: "pipe-new" } });

    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    const createButton = screen.getByText("common.create");
    await userEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.pipelineReady")).toBeInTheDocument();
    });
    expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    expect(screen.getByText("pipe-new")).toBeInTheDocument();
    expect(screen.getByText("newPipelineDialog.openInCanvas")).toBeInTheDocument();
    expect(screen.getByText("newPipelineDialog.runNow")).toBeInTheDocument();
    expect(screen.getByText("newPipelineDialog.createAnother")).toBeInTheDocument();
  });

  it("shows analysis results with matched operations", async () => {
    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    mockAnalyzeIntent.mockResolvedValue({
      data: {
        matchedOperations: [
          { operationId: "op-1", operationName: "lint-code", reason: "Linting match" },
        ],
        unmatchedSteps: [{ step: "Generate report", reason: "No operation" }],
      },
    });

    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    const textarea = screen.getByPlaceholderText("newPipelineDialog.descriptionPlaceholder");
    await userEvent.type(textarea, "Lint and report");
    await userEvent.click(screen.getByText("common.create"));

    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.analysisTitle")).toBeInTheDocument();
    });
    expect(screen.getByText("lint-code")).toBeInTheDocument();
    expect(screen.getByText("Linting match")).toBeInTheDocument();
    expect(screen.getByText("Generate report")).toBeInTheDocument();
    expect(screen.getByText("No operation")).toBeInTheDocument();
  });

  it("allows going back to form from analysis", async () => {
    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });

    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    const textarea = screen.getByPlaceholderText("newPipelineDialog.descriptionPlaceholder");
    await userEvent.type(textarea, "Something");
    await userEvent.click(screen.getByText("common.create"));

    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.backToEdit")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("newPipelineDialog.backToEdit"));

    expect(screen.getByText("common.create")).toBeInTheDocument();
  });

  it("proceeds to generation from analysis", async () => {
    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });

    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    const textarea = screen.getByPlaceholderText("newPipelineDialog.descriptionPlaceholder");
    await userEvent.type(textarea, "Build pipeline");
    await userEvent.click(screen.getByText("common.create"));

    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.proceedWithGeneration")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("newPipelineDialog.proceedWithGeneration"));

    await waitFor(() => {
      expect(mockGenerateStructure).toHaveBeenCalled();
    });
  });

  it("navigates to canvas when Open in Canvas is clicked", async () => {
    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    mockCreatePipelineMutate.mockResolvedValue({ data: { id: "pipe-nav" } });

    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    await userEvent.click(screen.getByText("common.create"));
    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.openInCanvas")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("newPipelineDialog.openInCanvas"));

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/canvas", search: { id: "pipe-nav" } });
  });

  it("runs pipeline and navigates when Run Now is clicked", async () => {
    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    mockCreatePipelineMutate.mockResolvedValue({ data: { id: "pipe-run" } });

    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    await userEvent.click(screen.getByText("common.create"));
    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.runNow")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("newPipelineDialog.runNow"));

    expect(mockRunMutate).toHaveBeenCalledWith({ id: "pipe-run" });
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/canvas", search: { id: "pipe-run" } });
  });

  it("resets to form when Create Another is clicked", async () => {
    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });

    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    await userEvent.click(screen.getByText("common.create"));
    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.createAnother")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("newPipelineDialog.createAnother"));

    expect(screen.getByText("common.create")).toBeInTheDocument();
  });
});
