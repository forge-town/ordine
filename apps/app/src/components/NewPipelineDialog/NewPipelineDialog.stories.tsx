import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { PipelineAgentProposal } from "@repo/schemas";
import { SidebarStoreContext, createSidebarStore } from "@/store/sidebarStore";
import type { PipelineAgentSessionsClient } from "@repo/views/lib/pipelineAgentSessionsClient";
import { NewPipelineDialog } from "./NewPipelineDialog";

const readyProposal = {
  mode: "generate",
  purpose: "Review repository code and return a concise report",
  inputs: ["Repository folder"],
  outputs: ["Markdown report"],
  majorOperations: ["Review the repository"],
  executionFlow: ["Repository folder → review → Markdown report"],
  assumptions: ["The repository is available locally"],
  openQuestions: [],
  readiness: "ready_for_generation",
} satisfies PipelineAgentProposal;

const createStoryClient = (options?: { generation?: "pending" | "success" }) =>
  ({
    createSession: async () => ({
      id: "storybook-session",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "draft",
    }),
    appendMessage: async (_sessionId: string, input: { content: string }) => ({
      id: "storybook-message",
      ...input,
    }),
    getLatestAssistantQuestion: async () => null,
    getLatestReadyProposal: async () => null,
    planSessionStream: async (_sessionId: string, input: { onEvent: (event: unknown) => void }) => {
      input.onEvent({
        type: "proposal_ready",
        proposal: readyProposal,
        proposalId: "storybook-proposal",
      });
    },
    approveProposal: async () => undefined,
    generatePipelineFromApprovedProposal:
      options?.generation === "pending"
        ? () => new Promise<never>(() => undefined)
        : async () => ({ pipelineId: "storybook-pipeline" }),
    supersedeProposal: async () => undefined,
    uploadAttachment: async () => ({}),
    waitForCreatedPipeline: async () => ({ pipelineId: "storybook-pipeline" }),
  }) as unknown as PipelineAgentSessionsClient;

const renderDialog = (args: React.ComponentProps<typeof NewPipelineDialog>) => {
  const store = createSidebarStore();
  store.setState({ newPipelineOpen: true });

  return (
    <SidebarStoreContext.Provider value={store}>
      <div className="min-h-[44rem] bg-surface-2 p-8">
        <NewPipelineDialog {...args} />
      </div>
    </SidebarStoreContext.Provider>
  );
};

const submitGoal = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement.ownerDocument.body);
  await userEvent.type(
    canvas.getByPlaceholderText("Describe your goal and add any useful context..."),
    "Build a repository review pipeline",
  );
  await userEvent.click(canvas.getByRole("button", { name: "Send" }));
  await expect(canvas.findByRole("button", { name: "Approve plan" })).resolves.toBeVisible();

  return canvas;
};

const meta: Meta<typeof NewPipelineDialog> = {
  title: "Components/NewPipelineDialog",
  component: NewPipelineDialog,
  render: renderDialog,
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          "Agent-first pipeline creation dialog. Stories exercise the real component with deterministic session and generation adapters.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof NewPipelineDialog>;

export const Conversation: Story = {
  args: {
    client: createStoryClient(),
    materializePipeline: async () => "storybook-pipeline",
  },
};

export const PlanReady: Story = {
  args: {
    client: createStoryClient(),
    materializePipeline: async () => "storybook-pipeline",
  },
  play: async ({ canvasElement }) => {
    await submitGoal(canvasElement);
  },
};

export const Generating: Story = {
  args: {
    client: createStoryClient({ generation: "pending" }),
    materializePipeline: async () => "storybook-pipeline",
  },
  play: async ({ canvasElement }) => {
    const canvas = await submitGoal(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Approve plan" }));
    await expect(canvas.getByRole("button", { name: "Generating..." })).toBeDisabled();
  },
};

export const PipelineReady: Story = {
  args: {
    client: createStoryClient(),
    materializePipeline: async () => "storybook-pipeline",
  },
  play: async ({ canvasElement }) => {
    const canvas = await submitGoal(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Approve plan" }));
    await waitFor(() => expect(canvas.getByText("Pipeline Ready")).toBeVisible());
    await expect(canvas.getByText("storybook-pipeline")).toBeVisible();
  },
};

export const MaterializationFailure: Story = {
  args: {
    client: createStoryClient(),
    materializePipeline: async () => {
      throw new Error("Generated pipeline could not be saved locally");
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = await submitGoal(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Approve plan" }));
    await expect(
      canvas.findByText("Generated pipeline could not be saved locally"),
    ).resolves.toBeVisible();
  },
};
