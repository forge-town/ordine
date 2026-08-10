import { afterEach, describe, expect, it, vi } from "vitest";

const { getLocalSession } = vi.hoisted(() => ({
  getLocalSession: vi.fn(),
}));

vi.mock("ky", () => ({
  default: { get: getLocalSession },
}));

import type { RouterContext } from "./__root";
import { requireAuthenticatedSession } from "./-requireAuthenticatedSession";

const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");

// Regression: ISSUE-001 — local-mode Canvas redirected to login after pipeline creation
// Found by /qa on 2026-08-10
// Report: .gstack/qa-reports/qa-report-localhost-9431-2026-08-10.md
describe("requireAuthenticatedSession", () => {
  afterEach(() => {
    vi.clearAllMocks();

    if (originalDocumentDescriptor) {
      Object.defineProperty(globalThis, "document", originalDocumentDescriptor);
    }
  });

  it("allows local-mode server rendering before the local session cookie exists", async () => {
    Reflect.deleteProperty(globalThis, "document");

    const result = await requireAuthenticatedSession({
      session: null,
      isLocalMode: true,
    } as RouterContext);

    expect(result).toBeUndefined();
    expect(getLocalSession).not.toHaveBeenCalled();
  });

  it("allows an existing session without requesting a local session", async () => {
    const result = await requireAuthenticatedSession({
      session: { user: { id: "user-1" } },
      isLocalMode: false,
    } as RouterContext);

    expect(result).toBeUndefined();
    expect(getLocalSession).not.toHaveBeenCalled();
  });
});
