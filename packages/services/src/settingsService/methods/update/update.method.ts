import type { createSettingsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";
import { normalizeSettingsRecord } from "../../helpers/normalizeSettingsRecord";

export const createUpdateMethod =
  (dao: ReturnType<typeof createSettingsDao>) =>
  async (...args: Parameters<typeof dao.update>) =>
    withMeta(normalizeSettingsRecord(await dao.update(...args)));
