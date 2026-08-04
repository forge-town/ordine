import type { DataProvider } from "@refinedev/core";
import type { Operation, Skill } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { isSkillBackedOperation, makeSkillBackedOperation } from "./makeOperationNodeData";

const pendingResolutions = new Map<string, Promise<Operation>>();

const findOrCreateSkillOperation = async (
  dataProvider: DataProvider,
  skill: Skill,
): Promise<Operation> => {
  const operations = await dataProvider.getList<Operation>({ resource: ResourceName.operations });
  const existing = operations.data.find((operation) => isSkillBackedOperation(operation, skill));
  if (existing) {
    return existing;
  }

  const created = await dataProvider.create<Operation>({
    resource: ResourceName.operations,
    variables: makeSkillBackedOperation(skill),
  });

  return created.data;
};

export const resolveSkillOperation = (
  dataProvider: DataProvider,
  skill: Skill,
): Promise<Operation> => {
  const pending = pendingResolutions.get(skill.id);
  if (pending) {
    return pending;
  }

  const resolution = findOrCreateSkillOperation(dataProvider, skill).finally(() => {
    if (pendingResolutions.get(skill.id) === resolution) {
      pendingResolutions.delete(skill.id);
    }
  });
  pendingResolutions.set(skill.id, resolution);

  return resolution;
};
