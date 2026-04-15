import type { Meta, StoryObj } from "@storybook/react";
import { BestPracticesPageContent } from "./BestPracticesPageContent";
import type { BestPracticeEntity } from "@repo/models";

const mockPractices: BestPracticeEntity[] = [
  {
    id: "bp-1",
    title: "避免在 useEffect 中直接 setState",
    condition: "当需要在组件挂载后获取异步数据时",
    content: "",
    category: "component",
    language: "typescript",
    codeSnippet: "useEffect(() => {\n  fetchData().then(setData);\n}, []);",
    tags: ["react", "hooks"],
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
