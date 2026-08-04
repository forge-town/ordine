import {
  buildDraftOperation,
  type Operation,
  type OperationNodeData,
  type Skill,
} from "@repo/schemas";

export const makeOperationNodeData = (operation: Operation): OperationNodeData => ({
  config: {},
  label: operation.name,
  nodeType: "operation",
  operationId: operation.id,
  operationName: operation.name,
  status: "idle",
});

export const makeSkillBackedOperation = (skill: Skill): Operation => ({
  ...buildDraftOperation(skill),
  id: `skill-operation-${skill.id}`,
  name: skill.label || skill.name,
});

export const isSkillBackedOperation = (operation: Operation, skill: Skill): boolean => {
  const executor = operation.config.executor;

  return (
    operation.sourceSkillId === skill.id ||
    (executor?.type === "agent" && executor.agentMode === "skill" && executor.skillId === skill.id)
  );
};
