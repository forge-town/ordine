import type { Operation, OperationNodeData, Skill } from "@repo/schemas";

export const makeOperationNodeData = (operation: Operation): OperationNodeData => ({
  config: {},
  label: operation.name,
  nodeType: "operation",
  operationId: operation.id,
  operationName: operation.name,
  status: "idle",
});

export const makeSkillOperationNodeData = (skill: Skill): OperationNodeData => ({
  config: {},
  label: skill.label || skill.name,
  nodeType: "operation",
  operationId: `skill:${skill.id}`,
  operationName: skill.label || skill.name,
  status: "idle",
});
