import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { HomePage } from "./HomePage";

const mockUseList = vi.fn();
const { mockUseSidebarStore } = vi.hoisted(() => ({
  mockUseSidebarStore: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useList: (...args: unknown[]) => mockUseList(...args),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number; name?: string }) =>
      key === "home.localAgentCount" ? `${values?.name} +${values?.count}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => undefined },
}));

vi.mock("@/lib/i18n", () => ({
  default: { t: (key: string) => key },
}));

vi.mock("@/store/sidebarStore", () => ({
  useSidebarStore: () => mockUseSidebarStore(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/PipelineCreationWorkspace", () => ({
  PipelineCreationWorkspace: ({
    presentation,
    runtimeConfigured,
    runtimeId,
    runtimeLabel,
    runtimeOptions,
    onRuntimeChange: handleRuntimeChange,
  }: {
    presentation: string;
    runtimeConfigured?: boolean;
    runtimeId?: string;
    runtimeLabel?: string;
    runtimeOptions?: Array<{ id: string; name: string }>;
    onRuntimeChange?: (runtimeId: string) => void;
  }) => {
    const handleRuntimeSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) =>
      handleRuntimeChange?.(event.target.value);

    return (
      <div
        data-connected={runtimeConfigured}
        data-presentation={presentation}
        data-runtime={runtimeLabel}
        data-runtime-id={runtimeId}
        data-testid="pipeline-creation-workspace"
      >
        {runtimeOptions?.length && runtimeId ? (
          <select
            aria-label="home.selectLocalAgent"
            value={runtimeId}
            onChange={handleRuntimeSelectChange}
          >
            {runtimeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    );
  },
}));

const localRuntime: AgentRuntimeConfig = {
  id: "runtime-codex",
  name: "Codex",
  type: "codex",
  connection: { mode: "local" },
};

const hermesRuntime: AgentRuntimeConfig = {
  id: "local-hermes",
  name: "Hermes",
  type: "hermes",
  connection: { mode: "local" },
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
  });

  it("renders the conversation-first workspace with the configured local Agent", () => {
    mockUseList.mockReturnValue({
      result: { data: [localRuntime] },
      query: { isLoading: false },
    });

    renderHomePage();

    expect(screen.getByText("home.heading")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "home.manageLocalAgents" })).toHaveAttribute(
      "href",
      "/local-agents",
    );
    expect(screen.getByRole("combobox", { name: "home.selectLocalAgent" })).toHaveTextContent(
      "Codex",
    );
    expect(screen.getByTestId("pipeline-creation-workspace")).toHaveAttribute(
      "data-presentation",
      "home",
    );
    expect(screen.getByTestId("pipeline-creation-workspace")).toHaveAttribute(
      "data-runtime",
      "Codex",
    );
    expect(screen.getByTestId("pipeline-creation-workspace")).toHaveAttribute(
      "data-connected",
      "true",
    );
  });

  it("keeps the connect-Agent path visible when no local runtime is configured", () => {
    mockUseList.mockReturnValue({
      result: { data: [] },
      query: { isLoading: false },
    });

    renderHomePage();

    expect(screen.getAllByText("home.connectLocalAgent")).toHaveLength(1);
    expect(screen.getByTestId("pipeline-creation-workspace")).toHaveAttribute(
      "data-connected",
      "false",
    );
  });

  it("allows the selected local Agent to be changed before planning", async () => {
    mockUseList.mockReturnValue({
      result: { data: [localRuntime, hermesRuntime] },
      query: { isLoading: false },
    });

    renderHomePage();
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "home.selectLocalAgent" }),
      "local-hermes",
    );

    expect(screen.getByTestId("pipeline-creation-workspace")).toHaveAttribute(
      "data-runtime-id",
      "local-hermes",
    );
    expect(screen.getByTestId("pipeline-creation-workspace")).toHaveAttribute(
      "data-runtime",
      "Hermes +1",
    );
  });

  it("starts a fresh workspace when the new-Pipeline action is triggered again", () => {
    mockUseList.mockReturnValue({
      result: { data: [localRuntime] },
      query: { isLoading: false },
    });
    const { store } = renderHomePage();
    const firstWorkspace = screen.getByTestId("pipeline-creation-workspace");

    act(() => store.getState().handleNewPipelineWorkspaceReset());

    expect(screen.getByTestId("pipeline-creation-workspace")).not.toBe(firstWorkspace);
  });

  it("shows a retryable error when runtime discovery fails", () => {
    const refetch = vi.fn();
    mockUseList.mockReturnValue({
      result: { data: [] },
      query: { isError: true, isLoading: false, refetch },
    });

    renderHomePage();

    expect(screen.getByRole("alert")).toHaveTextContent("home.runtimeLoadFailed");
    screen.getByRole("button", { name: "common.retry" }).click();
    expect(refetch).toHaveBeenCalledOnce();
  });
});
