import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { AgentRuntimeCatalogEntry } from "@repo/schemas";
import { render } from "../../test/test-wrapper";
import { LocalAgentCard } from "./LocalAgentCard";

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
  models: [{ id: "gpt-5.6", displayName: "GPT-5.6" }],
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

describe("LocalAgentCard", () => {
  it("separates detection, launchability, auth, and model evidence", () => {
    render(<LocalAgentCard entry={catalogEntry()} />);

    expect(screen.getByText("Codex Local")).toBeInTheDocument();
    expect(screen.getByText("Launchable")).toBeInTheDocument();
    expect(screen.getByText("authenticated · models live")).toBeInTheDocument();
    expect(screen.getByText("C:\\tools\\codex.exe")).toBeInTheDocument();
    expect(screen.getByText("GPT-5.6")).toBeInTheDocument();
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
  });

  it("starts a real connection test only for a supported configured runtime", () => {
    const handleConnectionTest = vi.fn();
    render(<LocalAgentCard entry={catalogEntry()} onConnectionTest={handleConnectionTest} />);

    screen.getByRole("button", { name: "Connection test" }).click();
    expect(handleConnectionTest).toHaveBeenCalledWith("local-codex");
    expect(screen.getByRole("button", { name: /Configure/ })).toHaveAttribute(
      "href",
      "/runtimes/local-codex",
    );
  });

  it("shows experimental entries without presenting them as formal execution choices", () => {
    const handleConnectionTest = vi.fn();
    render(
      <LocalAgentCard
        entry={catalogEntry({
          runtime: "pi-agent",
          displayName: "Pi Agent",
          runtimeConfigId: null,
          availability: "detected",
          compatibility: {
            ...catalogEntry().compatibility,
            runtime: "pi-agent",
            supportLevel: "experimental",
          },
        })}
        onConnectionTest={handleConnectionTest}
      />,
    );

    expect(screen.getByText("experimental")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connection test" })).not.toBeInTheDocument();
  });
});
