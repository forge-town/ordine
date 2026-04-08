import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BestPracticesPageContent } from "./BestPracticesPageContent";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";

vi.mock("@/services/bestPracticesService", () => ({
  deleteBestPractice: vi.fn(),
  createBestPractice: vi.fn(),
  updateBestPractice: vi.fn(),
}));

const mockUseLoaderData = vi.fn();
vi.mock("@/routes/best-practices", () => ({
  Route: { useLoaderData: () => mockUseLoaderData() },
}));

const mockPractices: BestPracticeEntity[] = [
  {
    id: "bp-1",
    title: "避免在 useEffect 中直接 setState",
    condition: "当需要在组件挂载后获取异步数据时",
    category: "component",
    language: "typescript",
    codeSnippet: "",
    tags: ["react"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "bp-2",
    title: "使用 useMemo 缓存计算结果",
    condition: "当有昂贵的计算且依赖不频繁变化时",
    category: "performance",
    language: "typescript",
    codeSnippet: "",
    tags: ["performance"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
    expect(screen.getByText("还没有最佳实践")).toBeInTheDocument();
  });

  it("shows practice count", () => {
    mockUseLoaderData.mockReturnValue(mockPractices);
    render(<BestPracticesPageContent />);
    expect(screen.getByText("2 条")).toBeInTheDocument();
  });
});
