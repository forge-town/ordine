import type { Meta, StoryObj } from "@storybook/react";
import { PracticeCard } from "./PracticeCard";
import { BestPracticesPageStoreProvider } from "../_store";
import type { BestPractice } from "@repo/schemas";

const mockPractice: BestPractice = {
  id: "bp-1",
  title: "避免在 useEffect 中直接 setState",
  condition: "当需要在组件挂载后获取异步数据时",
  content: "",
  category: "component",
  language: "typescript",
  codeSnippet: "useEffect(() => {\n  fetchData().then(setData);\n}, []);",
  tags: ["react", "hooks"],
  meta: { createdAt: new Date(), updatedAt: new Date() },
};

const meta: Meta<typeof PracticeCard> = {
  title: "BestPracticesPage/PracticeCard",
  component: PracticeCard,
  decorators: [
    (Story) => (
      <BestPracticesPageStoreProvider>
        <Story />
      </BestPracticesPageStoreProvider>
    ),
  ],
  args: {
    practice: mockPractice,
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
