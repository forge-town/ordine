import type { Meta, StoryObj } from "@storybook/react";
import { BestPracticesPageContent } from "./BestPracticesPageContent";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";

const mockPractices: BestPracticeEntity[] = [
  {
    id: "bp-1",
    title: "避免在 useEffect 中直接 setState",
    condition: "当需要在组件挂载后获取异步数据时",
    category: "component",
    language: "typescript",
    codeSnippet: "useEffect(() => {\n  fetchData().then(setData);\n}, []);",
    tags: ["react", "hooks"],
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

const meta: Meta<typeof BestPracticesPageContent> = {
  title: "BestPracticesPage/BestPracticesPageContent",
  component: BestPracticesPageContent,
  args: {
    practices: mockPractices,
  },
};

export default meta;
type Story = StoryObj<typeof BestPracticesPageContent>;

export const Default: Story = {
  args: {},
};

export const Empty: Story = {
  args: {
    practices: [],
  },
};
