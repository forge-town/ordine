import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HarnessCanvasStoreProvider } from "../_store";
import { HarnessCanvasHeader } from "./HarnessCanvasHeader";

vi.mock("@/services/pipelinesService", () => ({
  updatePipeline: vi.fn(),
}));

const wrapper = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider pipeline={null}>{children}</HarnessCanvasStoreProvider>
);

describe("HarnessCanvasHeader", () => {
  it("renders pipeline name placeholder", () => {
    render(<HarnessCanvasHeader />, { wrapper });
    expect(screen.getByText("未保存的 Pipeline")).toBeInTheDocument();
  });
});
