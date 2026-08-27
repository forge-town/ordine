import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import type { AgentExecutionChoice, AgentRuntimeCatalogEntry } from "@repo/schemas";
import { HomePage } from "./HomePage";

const {
  mockPersistChoice,
  mockRefetch,
  mockSelectRuntime,
  mockUseAgentExecutionChoice,
  mockUseSidebarStore,
} = vi.hoisted(() => ({
  mockPersistChoice: vi.fn(),
  mockRefetch: vi.fn(),
  mockSelectRuntime: vi.fn(),
  mockUseAgentExecutionChoice: vi.fn(),
  mockUseSidebarStore: vi.fn(),
}));

vi.mock("../../components/AgentExecutionPicker", () => ({
  useAgentExecutionChoice: () => mockUseAgentExecutionChoice(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => undefined },
}));

vi.mock("../../store/sidebarStore", () => ({
  useSidebarStore: () => mockUseSidebarStore(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("../../components/PipelineCreationWorkspace", () => ({
  PipelineCreationWorkspace: ({
    presentation,
    runtimeConfigured,
    runtimeId,
    runtimeLabel,
    executionCatalog,
    executionChoice,
    onExecutionRuntimeChange: handleExecutionRuntimeChange,
  }: {
    presentation: string;
    runtimeConfigured?: boolean;
    runtimeId?: string;
    runtimeLabel?: string;
    executionCatalog?: AgentRuntimeCatalogEntry[];
    executionChoice?: AgentExecutionChoice | null;
    onExecutionRuntimeChange?: (runtimeConfigId: string) => void;
  }) => {
    const handleRuntimeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      handleExecutionRuntimeChange?.(event.target.value);
    };

    return (
      <div
        data-connected={runtimeConfigured}
        data-presentation={presentation}
        data-runtime={runtimeLabel}
        data-runtime-id={runtimeId}
        data-testid="pipeline-creation-workspace"
      >
        {executionCatalog?.length && executionChoice ? (
          <select
            aria-label="home.selectLocalAgent"
            value={executionChoice.runtimeConfigId}
            onChange={handleRuntimeChange}
          >
            {executionCatalog.flatMap((entry) =>
              entry.runtimeConfigId
                ? [
                    <option key={entry.runtimeConfigId} value={entry.runtimeConfigId}>
                      {entry.displayName}
                    </option>,
                  ]
                : [],
            )}
          </select>
        ) : null}
      </div>
    );
  },
}));

const catalogEntry = (
  runtime: "codex" | "opencode",
  runtimeConfigId: string,
): AgentRuntimeCatalogEntry => ({
  runtime,
  displayName: runtime === "codex" ? "Codex" : "OpenCode",
  runtimeConfigId,
  availability: "launchable",
  binaryName: runtime,
  path: `C:\\bin\\${runtime}.exe`,
  version: "1.0.0",
  authenticationStatus: "authenticated",
  authenticationMessage: null,
  diagnostics: [],
  models: [],
  modelsSource: "live",
  supportsCustomModel: true,
  compatibility: {
    runtime,
    displayName: runtime,
    supportLevel: "supported",
    binaries: [runtime],
    versionArgs: ["--version"],
    streamFormat: runtime === "codex" ? "codex-jsonl" : "json-event-stream",
    capabilities: {
      textStreaming: "delta",
      thinking: true,
      toolEvents: true,
      usage: true,
      cancellation: "signal",
      resume: "cli",
      mcpInjection: "config",
      imageInput: false,
    },
  },
});

const codex = catalogEntry("codex", "runtime-codex");
const opencode = catalogEntry("opencode", "runtime-opencode");

const setExecutionState = ({
  catalog = [codex],
  choice = { runtimeConfigId: "runtime-codex" },
  isError = false,
  isLoading = false,
}: {
  catalog?: AgentRuntimeCatalogEntry[];
  choice?: AgentExecutionChoice | null;
  isError?: boolean;
  isLoading?: boolean;
} = {}) => {
  mockUseAgentExecutionChoice.mockReturnValue({
    catalog,
    catalogQuery: { isError, isLoading, refetch: mockRefetch },
    choice,
    isLoading,
    persistChoice: mockPersistChoice,
    selectRuntime: mockSelectRuntime,
  });
};

const renderHomePage = () => {
  const store = createStore<{
    newPipelineWorkspaceVersion: number;
    handleNewPipelineWorkspaceReset: () => void;
  }>((set) => ({
    newPipelineWorkspaceVersion: 0,
    handleNewPipelineWorkspaceReset: () =>
      set((state) => ({
        newPipelineWorkspaceVersion: state.newPipelineWorkspaceVersion + 1,
      })),
  }));
  mockUseSidebarStore.mockReturnValue(store);
  const result = render(<HomePage />);

  return { ...result, store };
};

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setExecutionState();
  });

  it("renders the conversation-first workspace with the configured local Agent", () => {
    renderHomePage();

    expect(screen.getByText("home.heading")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "home.selectLocalAgent" })).toHaveTextContent(
      "Codex",
    );
    expect(screen.getByTestId("pipeline-creation-workspace")).toHaveAttribute(
      "data-connected",
      "true",
    );
  });

  it("keeps the connect-Agent path visible when no supported runtime is configured", () => {
    setExecutionState({ catalog: [], choice: null });
    renderHomePage();

    expect(screen.getByTestId("pipeline-creation-workspace")).toHaveAttribute(
      "data-connected",
      "false",
    );
  });

  it("routes a runtime change through the persisted execution preference", async () => {
    setExecutionState({ catalog: [codex, opencode] });
    renderHomePage();
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "home.selectLocalAgent" }),
      "runtime-opencode",
    );

    expect(mockSelectRuntime).toHaveBeenCalledWith("runtime-opencode");
  });

  it("starts a fresh workspace when the new-Pipeline action is triggered again", () => {
    const { store } = renderHomePage();
    const firstWorkspace = screen.getByTestId("pipeline-creation-workspace");

    act(() => store.getState().handleNewPipelineWorkspaceReset());

    expect(screen.getByTestId("pipeline-creation-workspace")).not.toBe(firstWorkspace);
  });

  it("shows a retryable error when runtime discovery fails", () => {
    setExecutionState({ catalog: [], choice: null, isError: true });
    renderHomePage();

    expect(screen.getByRole("alert")).toHaveTextContent("home.runtimeLoadFailed");
    screen.getByRole("button", { name: "common.retry" }).click();
    expect(mockRefetch).toHaveBeenCalledOnce();
  });
});
