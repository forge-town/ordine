import { render, screen } from "@testing-library/react";
import { Circle } from "lucide-react";
import { describe, expect, it } from "vitest";
import { PageState } from "./PageState";

describe("PageState", () => {
  it("renders a consistent empty or recovery state", () => {
    render(
      <PageState
        action={<button type="button">Retry</button>}
        description="Try the request again."
        icon={<Circle />}
        title="Nothing here"
      />,
    );

    expect(screen.getByTestId("page-state")).toHaveClass("bg-surface-2/35", "ring-border");
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
