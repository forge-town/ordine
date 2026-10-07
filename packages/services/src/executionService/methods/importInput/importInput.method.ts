import {
  type ExecutionPrincipal,
  ImportExecutionInputSchema,
  EXECUTION_MAX_INPUT_ASSET_BYTES,
} from "@repo/schemas";

import { executionFailure } from "../../helpers/serviceResult";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createImportInputMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal, value: unknown) =>
    (0, serviceBindings.scoped)(principal, "artifacts:import", async (identity) => {
      const input = ImportExecutionInputSchema.parse(value);
      const bytes = Buffer.from(input.contentBase64, "base64");
      if (
        bytes.byteLength > EXECUTION_MAX_INPUT_ASSET_BYTES ||
        bytes.toString("base64") !== input.contentBase64
      )
        executionFailure(
          "INPUT_ASSET_TOO_LARGE",
          "Input must be canonical base64 and at most 8 MiB",
          "contentBase64",
          "artifact",
        );
      const created = await serviceBindings.deps.artifactStore.importInput(identity, {
        importRequestId: input.importRequestId,
        name: input.name,
        mimeType: input.mimeType,
        bytes,
      });
      if (created.isErr()) throw created.error;

      return created.value;
    });
