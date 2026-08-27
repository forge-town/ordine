import type * as RefineCore from "@refinedev/core";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../../test/test-wrapper";
import { SchedulePageContent } from "./SchedulePageContent";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => vi.fn(),
}));

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof RefineCore>()),
  useCustom: () => ({
    query: { isLoading: false },
    result: { data: { occurrences: [], timeZone: "UTC", truncated: false } },
  }),
  useCustomMutation: () => ({ mutateAsync: vi.fn(), mutation: { isPending: false } }),
  useList: () => ({
    query: { isLoading: false, refetch: vi.fn() },
    result: { data: [] },
  }),
}));

describe("SchedulePageContent", () => {
  it("renders the empty state with a new-routine action", async () => {
    render(<SchedulePageContent />);

    expect(await screen.findByRole("heading", { name: "Schedule" })).toBeInTheDocument();
    expect(screen.getByTestId("schedule-new-routine")).toBeInTheDocument();
    expect(await screen.findByText("No routines yet")).toBeInTheDocument();
  });
});
