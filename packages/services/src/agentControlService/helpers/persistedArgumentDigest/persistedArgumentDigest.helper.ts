import type { PersistedAction } from "../../contracts";

import { digestAgentControlArguments } from "../digestAgentControlArguments";

export const persistedArgumentDigest = (action: PersistedAction): string =>
  action.argumentDigest ?? digestAgentControlArguments(action.redactedInput);
