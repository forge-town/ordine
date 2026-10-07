import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createDecodeTextHelper =
  (_serviceBindings: Pick<PipelineAgentSessionsServiceBindings, never>) => (bytes: Uint8Array) =>
    new TextDecoder().decode(bytes);
