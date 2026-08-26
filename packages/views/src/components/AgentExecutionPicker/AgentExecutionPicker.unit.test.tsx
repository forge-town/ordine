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

  it("keeps launchable CLIs disabled when Agent Control has not accepted them", async () => {
    const user = userEvent.setup();
    render(
      <AgentExecutionPicker
        catalog={[catalogEntry()]}
        choice={{ runtimeConfigId: "local-codex", model: "gpt-5.6" }}
        runtimeDisabledReasons={{ "local-codex": "Control probe failed" }}
        onChange={vi.fn()}
        onRuntimeChange={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("agent-execution-picker-trigger"));

    expect(screen.getByTestId("agent-execution-runtime-codex")).toBeDisabled();
    expect(screen.getByTestId("agent-execution-runtime-codex")).toHaveAttribute(
      "title",
      "Control probe failed",
    );
    expect(screen.getByText("Control mode not accepted")).toBeInTheDocument();
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

  it("lets slow models customize or disable the first-output timeout", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <AgentExecutionPicker
        catalog={[catalogEntry()]}
        choice={{
          runtimeConfigId: "local-codex",
          model: "gpt-5.6",
          firstOutputTimeoutSeconds: 45,
        }}
        onChange={handleChange}
        onRuntimeChange={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("agent-execution-picker-trigger"));
    const input = screen.getByLabelText("First output timeout");
    await user.clear(input);
    await user.type(input, "180");
    await user.tab();

    expect(handleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ firstOutputTimeoutSeconds: 180 }),
    );

    if (!screen.queryByTestId("agent-execution-picker-popover")) {
      await user.click(screen.getByTestId("agent-execution-picker-trigger"));
    }
    const reopenedInput = screen.getByLabelText("First output timeout");
    await user.clear(reopenedInput);
    await user.type(reopenedInput, "0");
    await user.tab();
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ firstOutputTimeoutSeconds: 0 }),
    );
  });
});
