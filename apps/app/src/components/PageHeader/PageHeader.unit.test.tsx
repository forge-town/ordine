import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { PageHeader } from "./PageHeader";
import { render } from "@/test/test-wrapper";

describe("PageHeader", () => {
  it("renders the composed header API", () => {
    render(
      <PageHeader
        actions={<button type="button">Run</button>}
        badge={<span>Beta</span>}
        eyebrow="Ordinctor"
        sub="Compose and monitor agent workflows"
        title="Pipelines"
      />,
    );

    expect(screen.getByText("Ordinctor")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pipelines" })).toBeInTheDocument();
    expect(screen.getByText("Compose and monitor agent workflows")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
  });

  it("keeps the legacy custom children branch", () => {
    render(
      <PageHeader title="Legacy">
        <span>Custom header</span>
      </PageHeader>,
    );

    expect(screen.getByText("Custom header")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Legacy" })).not.toBeInTheDocument();
  });
});
