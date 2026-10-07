import { okAsync, type ResultAsync } from "neverthrow";
import type { CapabilityHarvestInput, CapabilityHarvestResult } from "../../contracts";
export const createHarvestOnceMethod =
  (
    automaticHarvestState: {
      completed?: CapabilityHarvestResult;
      inFlight?: ResultAsync<CapabilityHarvestResult, Error>;
    },
    harvest: (input: CapabilityHarvestInput) => ResultAsync<CapabilityHarvestResult, Error>,
  ) =>
  (input: CapabilityHarvestInput) => {
    if (automaticHarvestState.completed) return okAsync(automaticHarvestState.completed);
    if (automaticHarvestState.inFlight) return automaticHarvestState.inFlight;

    const inFlight = harvest(input)
      .map((result) => {
        automaticHarvestState.completed = result;
        automaticHarvestState.inFlight = undefined;

        return result;
      })
      .mapErr((error) => {
        automaticHarvestState.inFlight = undefined;

        return error;
      });
    automaticHarvestState.inFlight = inFlight;

    return inFlight;
  };
