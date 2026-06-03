import { z } from "zod/v4";
import { ObjectNodeTypeSchema } from "../pipeline/node/ObjectNodeTypeSchema";
import { OperationConfigSchema } from "./OperationConfigSchema";
import type { Skill } from "../skill";

export const DraftOperationSchema = z.object({
  name: z.string(),
  description: z.string(),
  sourceSkillId: z.string(),
  config: OperationConfigSchema,
  acceptedObjectTypes: z.array(ObjectNodeTypeSchema),
});
export type DraftOperation = z.infer<typeof DraftOperationSchema>;

export const buildDraftOperation = (skill: Skill): DraftOperation => ({
  name: skill.label,
  description: skill.description,
  sourceSkillId: skill.id,
  config: {
    executor: {
      type: "agent",
      agentMode: "skill",
      skillId: skill.id,
    },
    inputs: [],
    outputs: [],
  },
  acceptedObjectTypes: ["file", "folder", "github-project", "prompt"],
});
