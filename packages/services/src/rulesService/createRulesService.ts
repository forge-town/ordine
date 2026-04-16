import type { RulesDaoInstance } from "@repo/models";

export const createRulesService = (dao: RulesDaoInstance) => ({
  getAll: (...args: Parameters<typeof dao.findMany>) => dao.findMany(...args),
  getById: (id: string) => dao.findById(id),
  create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
  update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
  toggleEnabled: (id: string, enabled: boolean) => dao.toggleEnabled(id, enabled),
  delete: (id: string) => dao.delete(id),
});
