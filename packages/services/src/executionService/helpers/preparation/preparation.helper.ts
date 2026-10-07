import { fingerprintExecutable } from "../fingerprintExecutable";

type Dependencies = PreparationDependencies;

export type ExecutionPreparationService = ReturnType<typeof createExecutionPreparationService>;
import type { PreparationDependencies, ExecutionPreparationServiceBindings } from "../../contracts";

import { createPreparationPinnedOperationsHelper } from "../preparationPinnedOperations";
import { createPreparationSaveOperationMethod } from "../../methods/preparationSaveOperation";
import { createPreparationSavePipelineMethod } from "../../methods/preparationSavePipeline";
import { createPreparationSubmitMethod } from "../../methods/preparationSubmit";
export const createExecutionPreparationService = (deps: Dependencies) => {
  const serviceBindings: ExecutionPreparationServiceBindings = {
    get deps(): ExecutionPreparationServiceBindings["deps"] {
      return deps;
    },
    get repository(): ExecutionPreparationServiceBindings["repository"] {
      return repository;
    },
    get fingerprint(): ExecutionPreparationServiceBindings["fingerprint"] {
      return fingerprint;
    },
    get pinnedOperations(): ExecutionPreparationServiceBindings["pinnedOperations"] {
      return pinnedOperations;
    },
  };

  const repository = deps.repository;
  const fingerprint = deps.fingerprintExecutable ?? fingerprintExecutable;
  const pinnedOperations = createPreparationPinnedOperationsHelper(serviceBindings);

  return {
    saveOperation: createPreparationSaveOperationMethod(serviceBindings),
    savePipeline: createPreparationSavePipelineMethod(serviceBindings),
    submit: createPreparationSubmitMethod(serviceBindings),
  };
};
