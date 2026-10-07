import { err, ok, type Result } from "neverthrow";

import type { ResourceControlError, ResourceControlValue } from "../../helpers/resourceControl";
import { toError } from "../../helpers/resourceControlToError";
import { resourceRef } from "../../helpers/resourceControlResourceRef";
import { compactResource } from "../../helpers/resourceControlCompactResource";

import type { ResourceControlBindings } from "../../contracts";
export const createResourceControlTestConnectorMethod = (
  serviceBindings: Pick<ResourceControlBindings, "services">,
) =>
  ({
    async testConnector(id: string): Promise<Result<ResourceControlValue, ResourceControlError>> {
      const result = await serviceBindings.services.connector.connect(id);
      if (result.isErr()) return err(toError(result.error, "Test Connector"));
      const compact = compactResource("connector", result.value);

      return ok({
        resources: [resourceRef("connector", compact)],
        summary: `Connector ${id} handshake succeeded.`,
        data: { resource: compact },
      });
    },
  }).testConnector;
