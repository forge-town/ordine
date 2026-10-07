import type { createOperationOutputItemTemplatesDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createCreateMethod =
  (dao: ReturnType<typeof createOperationOutputItemTemplatesDao>) =>
  async (...args: Parameters<typeof dao.create>) =>
    withMeta(await dao.create(...args));
