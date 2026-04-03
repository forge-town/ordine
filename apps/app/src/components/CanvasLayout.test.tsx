import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { CanvasLayout } from "./CanvasLayout";
import { useToastStore } from "@/hooks/useToastStore";

vi.mock("@repo/ui/toast", () => ({
  Toast: ({ title, description }: { title: string; description?: string }) => (
    <div data-testid="toast">
      <span>{title}</span>
      {description && <span>{description}</span>}
    </div>
  ),
}));

describe("CanvasLayout", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it("renders children", () => {
    render(
      <CanvasLayout>
        <div data-testid="child">content</div>
      </CanvasLayout>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders toast notifications added to the store", () => {
    render(
      <CanvasLayout>
        <div />
      </CanvasLayout>,
    );

    act(() => {
      useToastStore.getState().addToast({
        type: "success",
        title: "保存成功",
        description: "Pipeline 已保存",
      });
    });

    expect(screen.getByText("保存成功")).toBeInTheDocument();
  });

  it("renders error toast notifications", () => {
    render(
      <CanvasLayout>
        <div />
      </CanvasLayout>,
    );

    act(() => {
      useToastStore.getState().addToast({
        type: "error",
        title: "保存失败",
        description: "请稍后重试",
      });
    });

    expect(screen.getByText("保存失败")).toBeInTheDocument();
  });
});
