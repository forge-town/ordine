import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "../../test/test-wrapper";
import { LocalAgentCard } from "./LocalAgentCard";

describe("LocalAgentCard", () => {
  it("shows runtime capabilities and links to its configuration", () => {
    render(
      <LocalAgentCard
        runtime={{
          id: "runtime-codex",
          name: "Codex Local",
          type: "codex",
          connection: { mode: "local" },
        }}
      />,
    );

    expect(screen.getByText("Codex Local")).toBeInTheDocument();
    expect(screen.getByText("File edit")).toBeInTheDocument();
    expect(screen.getByText("Configured only")).toBeInTheDocument();
    expect(screen.getByText("Path not recorded yet; re-scan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Configure/ })).toHaveAttribute(
      "href",
      "/runtimes/runtime-codex",
    );
  });

  it("shows the executable and detection state instead of claiming a live connection", () => {
    render(
      <LocalAgentCard
        runtime={{
          id: "local-codex",
          name: "Codex Local",
          type: "codex",
          connection: {
            mode: "local",
            binaryName: "codex",
            path: "C:\\tools\\codex.exe",
            version: "codex-cli 1.2.3",
          },
        }}
      />,
    );

    expect(screen.getByText("Detected")).toBeInTheDocument();
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
    expect(screen.getByText("C:\\tools\\codex.exe")).toBeInTheDocument();
    expect(screen.getByText("codex-cli 1.2.3")).toBeInTheDocument();
  });
});
