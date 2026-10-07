import type { createOperationOutputItemTemplatesDao } from "@repo/models";

export const createDeleteMethod =
  (dao: ReturnType<typeof createOperationOutputItemTemplatesDao>) => (id: string) =>
    dao.delete(id);
