import type { createOperationOutputItemTemplatesDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createUpdateMethod =
  (dao: ReturnType<typeof createOperationOutputItemTemplatesDao>) =>
  async (...args: Parameters<typeof dao.update>) =>
    withMeta(await dao.update(...args));
