import { afterEach, describe, expect, it, vi } from "vitest";

const { getLocalSession, redirect } = vi.hoisted(() => ({
  getLocalSession: vi.fn(),
  redirect: vi.fn((options: { to: string }) => Object.assign(new Error("redirect"), { options })),
}));

vi.mock("ky", () => ({
  default: { get: getLocalSession },
}));

vi.mock("@tanstack/react-router", () => ({ redirect }));

import type { RouterContext } from "./__root";
import { requireAuthenticatedSession } from "./-requireAuthenticatedSession";

const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalLocationDescriptor = Object.getOwnPropertyDescriptor(globalThis, "location");

// Regression: ISSUE-001 — local-mode Canvas redirected to login after pipeline creation
// Found by /qa on 2026-08-10
// Report: .gstack/qa-reports/qa-report-localhost-9431-2026-08-10.md
describe("requireAuthenticatedSession", () => {
  afterEach(() => {
    vi.clearAllMocks();

    if (originalDocumentDescriptor) {
      Object.defineProperty(globalThis, "document", originalDocumentDescriptor);
    }

    if (originalLocationDescriptor) {
      Object.defineProperty(globalThis, "location", originalLocationDescriptor);
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

  it("requests a local session in the browser and suspends until reload", async () => {
    const reload = vi.fn();
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { reload },
    });
    getLocalSession.mockResolvedValueOnce(new Response(null, { status: 204 }));

    void requireAuthenticatedSession({
      session: null,
      isLocalMode: true,
    } as RouterContext);

    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalledOnce();
    });
    expect(getLocalSession).toHaveBeenCalledWith("/api/local-session", {
      credentials: "include",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to login when the browser cannot establish a local session", async () => {
    getLocalSession.mockRejectedValueOnce(new Error("request failed"));

    await expect(
      requireAuthenticatedSession({
        session: null,
        isLocalMode: true,
      } as RouterContext),
    ).rejects.toMatchObject({ options: { to: "/login" } });

    expect(redirect).toHaveBeenCalledWith({ to: "/login" });
  });
});
