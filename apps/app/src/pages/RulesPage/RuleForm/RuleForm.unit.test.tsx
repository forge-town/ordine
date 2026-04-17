import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RuleForm } from "./RuleForm";

describe("RuleForm", () => {
  it("renders name input", () => {
    const handleCancel = vi.fn();
    const handleSave = vi.fn();
    render(<RuleForm onCancel={handleCancel} onSave={handleSave} />);
    expect(screen.getByPlaceholderText("规则名称 *")).toBeTruthy();
  });

  it("renders cancel button", () => {
    const handleCancel = vi.fn();
    const handleSave = vi.fn();
    render(<RuleForm onCancel={handleCancel} onSave={handleSave} />);
    expect(screen.getByText("取消")).toBeTruthy();
  });

  it("renders save button", () => {
    const handleCancel = vi.fn();
    const handleSave = vi.fn();
    render(<RuleForm onCancel={handleCancel} onSave={handleSave} />);
    expect(screen.getByText("保存")).toBeTruthy();
  });

  it("renders with initial values", () => {
    const handleCancel = vi.fn();
    const handleSave = vi.fn();
    render(
      <RuleForm
        initial={{
          name: "Test Rule",
          description: "desc",
          category: "lint",
          severity: "error",
          checkScript: "",
          scriptLanguage: "typescript" as const,
          acceptedObjectTypes: ["file"] as ("file" | "folder")[],
          tags: "",
        }}
        onCancel={handleCancel}
        onSave={handleSave}
      />
    );
    const input = screen.getByPlaceholderText("规则名称 *") as HTMLInputElement;
    expect(input.value).toBe("Test Rule");
  });
});
