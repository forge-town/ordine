import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StepBar } from "./StepBar";

describe("StepBar", () => {
  it("renders one segment per node status", () => {
    render(
      <StepBar
        steps={[
          { id: "input", status: "done" },
          { id: "agent", status: "running" },
          { id: "output", status: "idle" },
        ]}
      />,
    );

    expect(screen.getByLabelText("Job step progress").children).toHaveLength(3);
  });

  it("renders a stable empty segment when node statuses are missing", () => {
    render(<StepBar steps={[]} />);

    expect(screen.getByTitle("empty: unknown")).toBeInTheDocument();
  });
});
