import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createNormalizeWhitespaceHelper =
  (_serviceBindings: Pick<PipelineAgentSessionsServiceBindings, never>) => (value: string) =>
    value.replaceAll(/\s+/g, " ").trim();
