import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/test-wrapper";
import { PageLoadingState } from "./PageLoadingState";

describe("PageLoadingState", () => {
  it("renders default loading state", () => {
    render(<PageLoadingState />);

    expect(screen.getByTestId("page-loading-state")).toBeInTheDocument();
  });

  it("renders grid variant", () => {
    render(<PageLoadingState variant="grid" />);

    expect(screen.getByTestId("page-loading-state")).toBeInTheDocument();
  });
});
