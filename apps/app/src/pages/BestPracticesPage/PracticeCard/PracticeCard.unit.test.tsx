import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PracticeCard } from "./PracticeCard";
import type { BestPractice } from "@repo/schemas";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: Record<string, unknown>) => (
    <a href={String(props.to ?? "#")}>{children as React.ReactNode}</a>
  ),
}));

const mockPractice: BestPractice = {
  id: "bp-1",
  title: "避免在 useEffect 中直接 setState",
  condition: "当需要在组件挂载后获取异步数据时",
  content: "",
  category: "component",
  language: "typescript",
  codeSnippet: "const [data, setData] = useState(null);",
  tags: ["react", "hooks"],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PracticeCard", () => {
  it("renders practice title", () => {
    const handleDelete = vi.fn();
    render(<PracticeCard practice={mockPractice} onDelete={handleDelete} />);
    expect(screen.getByText(mockPractice.title)).toBeInTheDocument();
  });

  it("renders practice condition", () => {
    const handleDelete = vi.fn();
    render(<PracticeCard practice={mockPractice} onDelete={handleDelete} />);
    expect(screen.getByText(mockPractice.condition)).toBeInTheDocument();
  });

  it("shows code snippet toggle when codeSnippet is not empty", () => {
    const handleDelete = vi.fn();
    render(<PracticeCard practice={mockPractice} onDelete={handleDelete} />);
    expect(screen.getByText("代码片段")).toBeInTheDocument();
  });

  it("does not show code snippet toggle when codeSnippet is empty", () => {
    const handleDelete = vi.fn();
    render(
      <PracticeCard practice={{ ...mockPractice, codeSnippet: "" }} onDelete={handleDelete} />
    );
    expect(screen.queryByText("代码片段")).not.toBeInTheDocument();
  });

  it("expands code snippet on toggle click", () => {
    const handleDelete = vi.fn();
    render(<PracticeCard practice={mockPractice} onDelete={handleDelete} />);
    fireEvent.click(screen.getByText("代码片段"));
    expect(screen.getByText(mockPractice.codeSnippet)).toBeInTheDocument();
  });

  it("renders tags", () => {
    const handleDelete = vi.fn();
    render(<PracticeCard practice={mockPractice} onDelete={handleDelete} />);
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("hooks")).toBeInTheDocument();
  });
});
