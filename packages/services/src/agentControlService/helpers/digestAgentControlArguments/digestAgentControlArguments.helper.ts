import { createHash } from "node:crypto";

import { normalizeForDigest } from "../normalizeForDigest";

export const digestAgentControlArguments = (input: unknown): string =>
  createHash("sha256")
    .update(JSON.stringify(normalizeForDigest(input)))
    .digest("hex");
