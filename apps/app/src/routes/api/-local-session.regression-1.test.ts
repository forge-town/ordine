import { beforeEach, describe, expect, it, vi } from "vitest";

const { authHandler, limit } = vi.hoisted(() => ({
  authHandler: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));

vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

vi.mock("@repo/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit }),
      }),
    }),
  },
}));

vi.mock("@repo/db-schema", () => ({
  usersTable: { email: "email", id: "id" },
}));

vi.mock("@/integrations/better-auth", () => ({
  auth: { handler: authHandler },
}));

vi.mock("@/integrations/server-env", () => ({
  getServerEnv: () => ({ ORDINE_LOCAL_MODE: true }),
}));

import { handleLocalSessionRequest } from "./local-session";

// Regression: ISSUE-003 — concurrent local-mode page loads raced to create the same user
// Found by /qa on 2026-08-11
// Report: .gstack/qa-reports/qa-report-localhost-9440-2026-08-11.md
describe("handleLocalSessionRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limit.mockResolvedValue([]);
    authHandler.mockImplementation(async (request: Request) => {
      if (request.url.endsWith("/sign-up/email")) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      return new Response(null, { status: 200 });
    });
  });

  it("shares local-user initialization across concurrent requests", async () => {
    const request = new Request("http://localhost:9430/api/local-session");
    const responses = await Promise.all([
      handleLocalSessionRequest(request),
      handleLocalSessionRequest(request),
      handleLocalSessionRequest(request),
    ]);

    expect(responses.every((response) => response.ok)).toBe(true);
    expect(limit).toHaveBeenCalledTimes(1);
    expect(
      authHandler.mock.calls.filter(([authRequest]) =>
        (authRequest as Request).url.endsWith("/sign-up/email"),
      ),
    ).toHaveLength(1);
    expect(
      authHandler.mock.calls.filter(([authRequest]) =>
        (authRequest as Request).url.endsWith("/sign-in/email"),
      ),
    ).toHaveLength(3);
  });
});
