import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BestPracticesPageContent } from "./BestPracticesPageContent";
import type { BestPracticeRecord } from "@repo/db-schema";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: Record<string, unknown>) => (
    <a href={String(props.to ?? "#")}>{children as React.ReactNode}</a>
  ),
}));

vi.mock("@/services/bestPracticesService", () => ({
  deleteBestPractice: vi.fn(),
  createBestPractice: vi.fn(),
  updateBestPractice: vi.fn(),
}));

const mockUseLoaderData = vi.fn();
vi.mock("@/routes/_layout/best-practices.index", () => ({
  Route: { useLoaderData: () => mockUseLoaderData() },
}));

const mockPractices: BestPracticeRecord[] = [
  {
    id: "bp-1",
    title: "避免在 useEffect 中直接 setState",
    condition: "当需要在组件挂载后获取异步数据时",
    content: "",
    category: "component",
    language: "typescript",
    codeSnippet: "",
    tags: ["react"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "bp-2",
    title: "使用 useMemo 缓存计算结果",
    condition: "当有昂贵的计算且依赖不频繁变化时",
    content: "",
    category: "performance",
    language: "typescript",
    codeSnippet: "",
    tags: ["performance"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("BestPracticesPageContent", () => {
  it("renders list of practices", () => {
    mockUseLoaderData.mockReturnValue(mockPractices);
    render(<BestPracticesPageContent />);
    expect(screen.getByText("避免在 useEffect 中直接 setState")).toBeInTheDocument();
    expect(screen.getByText("使用 useMemo 缓存计算结果")).toBeInTheDocument();
  });

  it("renders empty state when no practices", () => {
    mockUseLoaderData.mockReturnValue([]);
    render(<BestPracticesPageContent />);
    expect(screen.getByText("还没有任何最佳实践")).toBeInTheDocument();
  });

  it("shows practice count", () => {
    mockUseLoaderData.mockReturnValue(mockPractices);
    render(<BestPracticesPageContent />);
    expect(screen.getByText("2 条")).toBeInTheDocument();
  });
});
