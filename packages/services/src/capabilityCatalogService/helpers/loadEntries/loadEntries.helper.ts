import { type CapabilityCatalogEntry } from "@repo/schemas";
import { ResultAsync } from "neverthrow";
import { toServiceError } from "../../../serviceErrors";
import { projectCapabilityCatalog } from "../catalogProjection/catalogProjection.helper";
import { type CapabilityCatalogServiceDependencies } from "../../contracts";

export const createLoadEntriesHelper =
  (dependencies: CapabilityCatalogServiceDependencies) =>
  (): ResultAsync<CapabilityCatalogEntry[], Error> =>
    ResultAsync.fromPromise(
      (async () => {
        await dependencies.skillsDao.seedIfEmpty();
        const [connectors, skills, overrides] = await Promise.all([
          dependencies.connectorsDao.findMany(),
          dependencies.skillsDao.findMany(),
          dependencies.riskOverridesDao.findMany(),
        ]);

        return projectCapabilityCatalog({ connectors, skills, overrides });
      })(),
      (error) => toServiceError(error, "Load capability catalog"),
    );
