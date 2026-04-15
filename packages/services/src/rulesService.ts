import type { RuleEntity } from "@repo/models";

type RuleCategory = RuleEntity["category"];

type RulesDao = {
  findMany: (filter?: { category?: RuleCategory; enabled?: boolean }) => Promise<RuleEntity[]>;
  findById: (id: string) => Promise<RuleEntity | null>;
  create: (data: Omit<RuleEntity, "createdAt" | "updatedAt">) => Promise<RuleEntity>;
  update: (
    id: string,
    data: Partial<Omit<RuleEntity, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<RuleEntity | null>;
  toggleEnabled: (id: string, enabled: boolean) => Promise<RuleEntity | null>;
  delete: (id: string) => Promise<void>;
};

export const createRulesService = (dao: RulesDao) => ({
  getAll: (filter?: { category?: RuleCategory; enabled?: boolean }) => dao.findMany(filter),
  getById: (id: string) => dao.findById(id),
  create: (data: Omit<RuleEntity, "createdAt" | "updatedAt">) => dao.create(data),
  update: (id: string, data: Partial<Omit<RuleEntity, "id" | "createdAt" | "updatedAt">>) =>
    dao.update(id, data),
  toggleEnabled: (id: string, enabled: boolean) => dao.toggleEnabled(id, enabled),
  delete: (id: string) => dao.delete(id),
});
