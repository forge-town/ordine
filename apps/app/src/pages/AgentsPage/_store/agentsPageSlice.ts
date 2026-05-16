import type { ChangeEvent } from "react";
import type { StateCreator } from "zustand";
import { z } from "zod/v4";
import { type Agent } from "@repo/schemas";
import { dataProvider, ResourceName } from "@/integrations/refine/dataProvider";

export const agentFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  defaultRuntime: z.string(),
  systemPrompt: z.string(),
  tags: z.string(),
});

export type AgentFormValues = z.infer<typeof agentFormSchema>;

export interface AgentsPageSlice {
  search: string;
  showForm: boolean;
  editing: Agent | null;

  handleSearchInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleAddAgentButtonClick: () => void;
  handleDialogOpenChange: (open: boolean) => void;
  handleCancelButtonClick: () => void;
  handleFormSubmit: (values: AgentFormValues) => Promise<void>;
}

export const createAgentsPageSlice: StateCreator<AgentsPageSlice> = (set, get) => {
  const closeForm = () => set({ showForm: false, editing: null });

  return {
    search: "",
    showForm: false,
    editing: null,

    handleSearchInputChange: (event) => set({ search: event.target.value }),
    handleAddAgentButtonClick: () => set({ editing: null, showForm: true }),
    handleDialogOpenChange: (open) => {
      if (!open) closeForm();
    },
    handleCancelButtonClick: closeForm,
    handleFormSubmit: async (values) => {
      const editing = get().editing;
      const tags = values.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (editing) {
        await dataProvider.update({
          resource: ResourceName.agents,
          id: editing.id,
          variables: {
            name: values.name.trim(),
            description: values.description || null,
            defaultRuntime: values.defaultRuntime || null,
            systemPrompt: values.systemPrompt || null,
            tags,
          },
        });
      } else {
        await dataProvider.create({
          resource: ResourceName.agents,
          variables: {
            id: crypto.randomUUID(),
            name: values.name.trim(),
            description: values.description || null,
            defaultRuntime: values.defaultRuntime || null,
            systemPrompt: values.systemPrompt || null,
            capabilities: [],
            allowedTools: [],
            allowedSkillIds: [],
            tags,
          },
        });
      }
      closeForm();
    },
  };
};
