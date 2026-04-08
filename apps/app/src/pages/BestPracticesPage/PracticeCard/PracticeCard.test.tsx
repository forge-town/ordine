import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PracticeCard } from "./PracticeCard";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";

const mockPractice: BestPracticeEntity = {
  id: "bp-1",
  title: "避免在 useEffect 中直接 setState",
  condition: "当需要在组件挂载后获取异步数据时",
  category: "component",
  language: "typescript",
  codeSnippet: "const [data, setData] = useState(null);",
  tags: ["react", "hooks"],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("PracticeCard", () => {
  it("renders practice title", () => {
    const handleDelete = vi.fn();
    const handleEdit = vi.fn();
    render(<PracticeCard practice={mockPractice} onDelete={handleDelete} onEdit={handleEdit} />);
    expect(screen.getByText(mockPractice.title)).toBeInTheDocument();
  });

  it("renders practice condition", () => {
    const handleDelete = vi.fn();
    const handleEdit = vi.fn();
    render(<PracticeCard practice={mockPractice} onDelete={handleDelete} onEdit={handleEdit} />);
    expect(screen.getByText(mockPractice.condition)).toBeInTheDocument();
  });

  it("shows code snippet toggle when codeSnippet is not empty", () => {
    const handleDelete = vi.fn();
    const handleEdit = vi.fn();
    render(<PracticeCard practice={mockPractice} onDelete={handleDelete} onEdit={handleEdit} />);
    expect(screen.getByText("代码片段")).toBeInTheDocument();
  });

  it("does not show code snippet toggle when codeSnippet is empty", () => {
    const handleDelete = vi.fn();
    const handleEdit = vi.fn();
    render(
      <PracticeCard
        practice={{ ...mockPractice, codeSnippet: "" }}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
    );
    expect(screen.queryByText("代码片段")).not.toBeInTheDocument();
  });

  it("expands code snippet on toggle click", () => {
    const handleDelete = vi.fn();
    const handleEdit = vi.fn();
    render(<PracticeCard practice={mockPractice} onDelete={handleDelete} onEdit={handleEdit} />);
    fireEvent.click(screen.getByText("代码片段"));
    expect(screen.getByText(mockPractice.codeSnippet)).toBeInTheDocument();
  });

  it("renders tags", () => {
    const handleDelete = vi.fn();
    const handleEdit = vi.fn();
    render(<PracticeCard practice={mockPractice} onDelete={handleDelete} onEdit={handleEdit} />);
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("hooks")).toBeInTheDocument();
  });
});
