import {
  type CapabilityCatalogEntry,
  type SetCapabilityRiskTierOverrideInput,
} from "@repo/schemas";
import { errAsync, ResultAsync } from "neverthrow";
import { NotFoundError, toServiceError } from "../../../serviceErrors";

import { type CapabilityCatalogServiceDependencies } from "../../contracts";

import type { createLoadEntriesHelper } from "../../helpers/loadEntries";
export const createSetRiskTierOverrideMethod =
  (
    dependencies: CapabilityCatalogServiceDependencies,
    loadEntries: ReturnType<typeof createLoadEntriesHelper>,
  ) =>
  ({
    id,
    riskTier,
  }: SetCapabilityRiskTierOverrideInput): ResultAsync<CapabilityCatalogEntry, Error> =>
    loadEntries().andThen((entries) => {
      const entry = entries.find((candidate) => candidate.id === id);
      if (!entry) return errAsync(new NotFoundError("Capability", id));

      const mutation: Promise<void> = riskTier
        ? dependencies.riskOverridesDao.upsert(id, riskTier).then(() => undefined)
        : dependencies.riskOverridesDao.delete(id);

      return ResultAsync.fromPromise(mutation, (error) =>
        toServiceError(error, "Set capability risk override"),
      ).map(() => ({
        ...entry,
        riskTier: riskTier ?? entry.inferredRiskTier,
        riskTierSource: riskTier ? ("override" as const) : ("rule" as const),
      }));
    });
