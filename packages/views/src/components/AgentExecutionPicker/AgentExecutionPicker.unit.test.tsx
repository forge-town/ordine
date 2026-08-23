import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AgentRuntimeCatalogEntry } from "@repo/schemas";
import { render } from "../../test/test-wrapper";
import { AgentExecutionPicker } from "./AgentExecutionPicker";

const catalogEntry = (
  overrides: Partial<AgentRuntimeCatalogEntry> = {},
): AgentRuntimeCatalogEntry => ({
  runtime: "codex",
  displayName: "Codex Local",
  runtimeConfigId: "local-codex",
  availability: "launchable",
  binaryName: "codex",
  path: "C:\\tools\\codex.exe",
  version: "codex-cli 1.2.3",
  authenticationStatus: "authenticated",
  authenticationMessage: null,
  diagnostics: [],
  models: [
    {
      id: "gpt-5.6",
      displayName: "GPT-5.6",
      reasoningEfforts: [{ value: "medium" }, { value: "high" }],
      speeds: [{ value: "standard" }, { value: "priority" }],
    },
  ],
  modelsSource: "live",
  supportsCustomModel: true,
  compatibility: {
    runtime: "codex",
    displayName: "Codex",
    supportLevel: "supported",
    binaries: ["codex"],
    versionArgs: ["--version"],
    streamFormat: "codex-jsonl",
    capabilities: {
      textStreaming: "message",
      thinking: true,
      toolEvents: true,
      usage: true,
      cancellation: "signal",
      resume: "cli",
      mcpInjection: "config",
      imageInput: true,
    },
  },
  ...overrides,
});

describe("AgentExecutionPicker", () => {
  it("renders a compact model action for the Canvas toolbar", () => {
    render(
      <AgentExecutionPicker
        catalog={[catalogEntry()]}
        choice={{ runtimeConfigId: "local-codex", model: "gpt-5.6" }}
        triggerVariant="button"
        onChange={vi.fn()}
        onRuntimeChange={vi.fn()}
      />,
    );

    const trigger = screen.getByTestId("agent-execution-picker-trigger");
    expect(trigger).toHaveTextContent("Model");
    expect(trigger).not.toHaveTextContent("Codex Local");
    expect(trigger).not.toHaveTextContent("GPT-5.6");
    expect(trigger).toHaveClass("rounded-full", "shadow-pill", "ring-1");
  });

  it("keeps experimental CLIs visible but unavailable for formal runs", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleRuntimeChange = vi.fn();
    render(
      <AgentExecutionPicker
        catalog={[
          catalogEntry(),
          catalogEntry({
            runtime: "pi-agent",
            displayName: "Pi Agent",
            runtimeConfigId: null,
            compatibility: {
              ...catalogEntry().compatibility,
              runtime: "pi-agent",
              supportLevel: "experimental",
            },
          }),
        ]}
        choice={{ runtimeConfigId: "local-codex", model: "gpt-5.6" }}
        onChange={handleChange}
        onRuntimeChange={handleRuntimeChange}
      />,
    );

    await user.click(screen.getByTestId("agent-execution-picker-trigger"));

    expect(screen.getByTestId("agent-execution-runtime-codex")).toBeEnabled();
    expect(screen.getByTestId("agent-execution-runtime-pi-agent")).toBeDisabled();
    expect(screen.getByText("Experimental")).toBeInTheDocument();
  });

  it("searches the live catalog and accepts a custom model ID", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleRuntimeChange = vi.fn();
    render(
      <AgentExecutionPicker
        catalog={[catalogEntry()]}
        choice={{ runtimeConfigId: "local-codex", model: "gpt-5.6" }}
        onChange={handleChange}
        onRuntimeChange={handleRuntimeChange}
      />,
    );

    await user.click(screen.getByTestId("agent-execution-picker-trigger"));
    await user.click(screen.getByTestId("agent-execution-model-trigger"));
    await user.type(screen.getByTestId("agent-execution-model-search"), "gpt-custom-local");
    await user.click(screen.getByTestId("agent-execution-custom-model"));

    expect(handleChange).toHaveBeenCalledWith({
      runtimeConfigId: "local-codex",
      model: "gpt-custom-local",
    });
    await waitFor(() =>
      expect(screen.queryByTestId("agent-execution-model-search")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("agent-execution-model-trigger"));
    await waitFor(() => expect(screen.getByTestId("agent-execution-model-search")).toHaveFocus());
  });
});
