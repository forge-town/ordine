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
    expect(screen.getByRole("button", { name: /Configure/ })).toHaveAttribute(
      "href",
      "/runtimes/runtime-codex",
    );
  });
});
