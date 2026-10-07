import type { createSettingsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";
import { normalizeSettingsRecord } from "../../helpers/normalizeSettingsRecord";

export const createGetMethod = (dao: ReturnType<typeof createSettingsDao>) => async () =>
  withMeta(normalizeSettingsRecord(await dao.get()));
