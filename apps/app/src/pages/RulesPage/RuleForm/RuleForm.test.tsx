import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RuleForm } from "./RuleForm";

describe("RuleForm", () => {
  it("renders name input", () => {
    render(<RuleForm onCancel={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByPlaceholderText("规则名称 *")).toBeTruthy();
  });

  it("renders cancel button", () => {
    render(<RuleForm onCancel={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText("取消")).toBeTruthy();
  });

  it("renders save button", () => {
    render(<RuleForm onCancel={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText("保存")).toBeTruthy();
  });

  it("renders with initial values", () => {
    render(
      <RuleForm
        initial={{
          name: "Test Rule",
          description: "desc",
          category: "lint",
          severity: "error",
          pattern: "",
          tags: "",
        }}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText("规则名称 *") as HTMLInputElement;
    expect(input.value).toBe("Test Rule");
  });
});
