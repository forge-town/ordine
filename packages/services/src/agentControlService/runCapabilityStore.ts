import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AgentControlScope } from "@repo/schemas";

const MAX_CAPABILITY_TTL_MS = 60 * 60 * 1_000;

type CapabilityGrant = {
  hash: Buffer;
  runId: string;
  threadId: string;
  scopes: ReadonlySet<AgentControlScope>;
  tools: ReadonlySet<string>;
  expiresAt: Date;
};

export type CapabilityVerification =
  | {
      ok: true;
      grant: Omit<CapabilityGrant, "hash">;
    }
  | {
      ok: false;
      code: "CAPABILITY_INVALID" | "CAPABILITY_EXPIRED" | "CAPABILITY_SCOPE_DENIED";
    };

const digest = (token: string): Buffer => createHash("sha256").update(token).digest();
const keyFor = (hash: Buffer): string => hash.toString("hex");

export class AgentRunCapabilityStore {
  readonly #grants = new Map<string, CapabilityGrant>();

  mint({
    runId,
    threadId,
    scopes,
    tools,
    ttlMs = 30 * 60 * 1_000,
    now = new Date(),
  }: {
    runId: string;
    threadId: string;
    scopes: readonly AgentControlScope[];
    tools: readonly string[];
    ttlMs?: number;
    now?: Date;
  }): { token: string; expiresAt: Date } {
    if (ttlMs <= 0 || ttlMs > MAX_CAPABILITY_TTL_MS) {
      throw new Error(`Capability TTL must be between 1 and ${MAX_CAPABILITY_TTL_MS}ms`);
    }
    const token = randomBytes(32).toString("base64url");
    const hash = digest(token);
    const expiresAt = new Date(now.getTime() + ttlMs);
    this.#grants.set(keyFor(hash), {
      hash,
      runId,
      threadId,
      scopes: new Set(scopes),
      tools: new Set(tools),
      expiresAt,
    });

    return { token, expiresAt };
  }

  verify({
    token,
    runId,
    toolName,
    now = new Date(),
  }: {
    token: string;
    runId: string;
    toolName?: string;
    now?: Date;
  }): CapabilityVerification {
    const candidate = digest(token);
    const grant = this.#grants.get(keyFor(candidate));
    if (
      !grant ||
      grant.hash.length !== candidate.length ||
      !timingSafeEqual(grant.hash, candidate)
    ) {
      return { ok: false, code: "CAPABILITY_INVALID" };
    }
    if (grant.runId !== runId) return { ok: false, code: "CAPABILITY_INVALID" };
    if (grant.expiresAt.getTime() <= now.getTime()) {
      this.#grants.delete(keyFor(candidate));

      return { ok: false, code: "CAPABILITY_EXPIRED" };
    }
    if (toolName && !grant.tools.has(toolName)) {
      return { ok: false, code: "CAPABILITY_SCOPE_DENIED" };
    }

    return {
      ok: true,
      grant: {
        runId: grant.runId,
        threadId: grant.threadId,
        scopes: grant.scopes,
        tools: grant.tools,
        expiresAt: grant.expiresAt,
      },
    };
  }

  revokeRun(runId: string): void {
    for (const [key, grant] of this.#grants) {
      if (grant.runId === runId) this.#grants.delete(key);
    }
  }

  deleteExpired(now = new Date()): number {
    const expiredKeys = [...this.#grants]
      .filter(([, grant]) => grant.expiresAt.getTime() <= now.getTime())
      .map(([key]) => key);
    for (const key of expiredKeys) this.#grants.delete(key);

    return expiredKeys.length;
  }

  get size(): number {
    return this.#grants.size;
  }
}

export const agentRunCapabilityStore = new AgentRunCapabilityStore();
