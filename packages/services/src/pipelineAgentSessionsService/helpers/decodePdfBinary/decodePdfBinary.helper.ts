import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createDecodePdfBinaryHelper =
  (_serviceBindings: Pick<PipelineAgentSessionsServiceBindings, never>) => (bytes: Uint8Array) =>
    Buffer.from(bytes).toString("latin1");
