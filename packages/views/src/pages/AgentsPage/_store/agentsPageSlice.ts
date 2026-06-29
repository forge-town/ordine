import type { ChangeEvent } from "react";
import type { StateCreator } from "zustand";
import { createFormControl } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { type Agent } from "@repo/schemas";

export const agentFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  defaultRuntime: z.string(),
  systemPrompt: z.string(),
  tags: z.string(),
});

export type AgentFormValues = z.infer<typeof agentFormSchema>;
export type AgentFormMutationValues = {
  name: string;
  description: string | null;
  defaultRuntime: string | null;
  systemPrompt: string | null;
  tags: string[];
};

type AgentFormControl = ReturnType<typeof createFormControl<AgentFormValues>>;

const emptyAgentFormValues: AgentFormValues = {
  name: "",
  description: "",
  defaultRuntime: "",
  systemPrompt: "",
  tags: "",
};

export const toAgentFormMutationValues = (values: AgentFormValues): AgentFormMutationValues => ({
  name: values.name.trim(),
  description: values.description || null,
  defaultRuntime: values.defaultRuntime || null,
  systemPrompt: values.systemPrompt || null,
  tags: values.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean),
});

export interface AgentsPageSlice {
  search: string;
  showForm: boolean;
  editing: Agent | null;
  agentFormControl: AgentFormControl;

  handleSearchInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleAddAgentButtonClick: () => void;
  handleDialogOpenChange: (open: boolean) => void;
  handleCancelButtonClick: () => void;
  handleFormSubmitSuccess: () => void;
}

export const createAgentsPageSlice: StateCreator<AgentsPageSlice> = (set) => {
  const agentFormControl = createFormControl<AgentFormValues>({
    defaultValues: emptyAgentFormValues,
    resolver: zodResolver(agentFormSchema),
  });

  const closeForm = () => {
    agentFormControl.reset(emptyAgentFormValues);
    set({ showForm: false, editing: null });
  };

  return {
    search: "",
    showForm: false,
    editing: null,
    agentFormControl,

    handleSearchInputChange: (event) => set({ search: event.target.value }),
    handleAddAgentButtonClick: () => {
      agentFormControl.reset(emptyAgentFormValues);
      set({ editing: null, showForm: true });
    },
    handleDialogOpenChange: (open) => {
      if (!open) closeForm();
    },
    handleCancelButtonClick: closeForm,
    handleFormSubmitSuccess: closeForm,
  };
};
