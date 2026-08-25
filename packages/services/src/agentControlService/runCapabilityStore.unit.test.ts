import { describe, expect, it } from "vitest";
import { AgentRunCapabilityStore } from "./runCapabilityStore";

describe("AgentRunCapabilityStore", () => {
  it("mints 256-bit run-bound capabilities and never exposes a stored raw token", () => {
    const store = new AgentRunCapabilityStore();
    const minted = store.mint({
      runId: "run-1",
      threadId: "thread-1",
      scopes: ["resources:read"],
      tools: ["ordine.search"],
      now: new Date("2026-08-25T00:00:00.000Z"),
    });

    expect(Buffer.from(minted.token, "base64url")).toHaveLength(32);
    expect(JSON.stringify(store)).not.toContain(minted.token);
    expect(
      store.verify({
        token: minted.token,
        runId: "run-1",
        toolName: "ordine.search",
        now: new Date("2026-08-25T00:01:00.000Z"),
      }),
    ).toMatchObject({ ok: true, grant: { threadId: "thread-1" } });
  });

  it("denies forged, cross-run, out-of-scope, expired, and revoked capabilities", () => {
    const store = new AgentRunCapabilityStore();
    const minted = store.mint({
      runId: "run-1",
      threadId: "thread-1",
      scopes: ["resources:read"],
      tools: ["ordine.search"],
      ttlMs: 1_000,
      now: new Date("2026-08-25T00:00:00.000Z"),
    });

    expect(store.verify({ token: "forged", runId: "run-1" })).toMatchObject({ ok: false });
    expect(store.verify({ token: minted.token, runId: "run-2" })).toMatchObject({ ok: false });
    expect(
      store.verify({
        token: minted.token,
        runId: "run-1",
        toolName: "ordine.add_node",
        now: new Date("2026-08-25T00:00:00.500Z"),
      }),
    ).toMatchObject({ ok: false, code: "CAPABILITY_SCOPE_DENIED" });
    expect(
      store.verify({
        token: minted.token,
        runId: "run-1",
        now: new Date("2026-08-25T00:00:02.000Z"),
      }),
    ).toMatchObject({ ok: false, code: "CAPABILITY_EXPIRED" });

    const second = store.mint({
      runId: "run-2",
      threadId: "thread-1",
      scopes: ["resources:read"],
      tools: ["ordine.search"],
    });
    store.revokeRun("run-2");
    expect(store.verify({ token: second.token, runId: "run-2" })).toMatchObject({ ok: false });
  });
});
