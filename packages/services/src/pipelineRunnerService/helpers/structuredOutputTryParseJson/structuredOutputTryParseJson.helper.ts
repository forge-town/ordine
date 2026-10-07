import { Result } from "neverthrow";

import type { StructuredOutputAssemblyBindings } from "../../contracts";
export const createStructuredOutputTryParseJsonHelper =
  (_serviceBindings: Pick<StructuredOutputAssemblyBindings, never>) =>
  ({ text }: { text: string }): unknown | undefined => {
    const result = Result.fromThrowable(JSON.parse, () => undefined)(text);

    return result.isOk() ? (result.value as unknown) : undefined;
  };
