import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("uses the same composed page treatment with or without supporting copy", () => {
    const { rerender } = render(<PageHeader title="Settings" />);

    expect(screen.getByRole("heading", { name: "Settings" })).toHaveClass("text-[21px]");

    rerender(
      <PageHeader
        eyebrow="Capabilities"
        sub="External tools available to agents."
        title="Connectors"
      />,
    );

    expect(screen.getByRole("heading", { name: "Connectors" })).toHaveClass("text-[21px]");
    expect(screen.getByText("Capabilities")).toBeInTheDocument();
    expect(screen.getByText("External tools available to agents.")).toBeInTheDocument();
  });

  it("keeps custom toolbar content compact", () => {
    render(
      <PageHeader title="Workspace">
        <span>Custom header</span>
      </PageHeader>,
    );

    expect(screen.getByText("Custom header").parentElement).toHaveClass("h-14");
    expect(screen.queryByRole("heading", { name: "Workspace" })).not.toBeInTheDocument();
  });
});
