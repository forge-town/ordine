import type { Meta, StoryObj } from "@storybook/react";
import { PracticeFormDialog } from "./PracticeFormDialog";
import type { BestPracticeRecord } from "@repo/db-schema";

const mockPractice: BestPracticeRecord = {
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
};

const meta: Meta<typeof PracticeFormDialog> = {
  title: "BestPracticesPage/PracticeFormDialog",
  component: PracticeFormDialog,
  args: {
    onClose: () => undefined,
    onSave: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof PracticeFormDialog>;

export const Default: Story = {
  args: {},
};

export const EditMode: Story = {
  args: {
    initial: mockPractice,
  },
};
