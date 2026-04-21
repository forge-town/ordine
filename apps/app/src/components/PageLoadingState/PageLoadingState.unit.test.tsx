import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/test-wrapper";
import { PageLoadingState } from "./PageLoadingState";

describe("PageLoadingState", () => {
  it("renders default loading copy", () => {
    render(<PageLoadingState />);

    expect(screen.getByTestId("page-loading-state")).toBeInTheDocument();
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("renders custom title and description", () => {
    render(<PageLoadingState description="Fetching records" title="Loading jobs" />);

    expect(screen.getByText("Loading jobs")).toBeInTheDocument();
    expect(screen.getByText("Fetching records")).toBeInTheDocument();
  });
});
