import type { Meta, StoryObj } from "@storybook/react";
import { PracticeCard } from "./PracticeCard";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";

const mockPractice: BestPracticeEntity = {
  id: "bp-1",
  title: "避免在 useEffect 中直接 setState",
  condition: "当需要在组件挂载后获取异步数据时",
  content: "",
  category: "component",
  language: "typescript",
  codeSnippet: "useEffect(() => {\n  fetchData().then(setData);\n}, []);",
  tags: ["react", "hooks"],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const meta: Meta<typeof PracticeCard> = {
  title: "BestPracticesPage/PracticeCard",
  component: PracticeCard,
  args: {
    practice: mockPractice,
    onDelete: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof PracticeCard>;

export const Default: Story = {
  args: {},
};

export const WithoutCode: Story = {
  args: {
    practice: { ...mockPractice, codeSnippet: "" },
  },
};

export const SecurityCategory: Story = {
  args: {
    practice: { ...mockPractice, category: "security", tags: ["owasp"] },
  },
};
