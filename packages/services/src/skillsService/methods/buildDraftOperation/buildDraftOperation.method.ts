import { buildDraftOperation, type Skill } from "@repo/schemas";

export const createBuildDraftOperationMethod = () => (skill: Skill) => buildDraftOperation(skill);
