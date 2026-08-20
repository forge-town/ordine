import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getServerEnv } from "./getServerEnv";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ordine");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ORDINE_LOCAL_MODE", "false");
  vi.stubEnv("ORDINE_SELF_HOSTED", "false");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getServerEnv", () => {
  it("requires a PostgreSQL connection string", () => {
    vi.stubEnv("DATABASE_URL", "");

    expect(() => getServerEnv()).toThrow("Server env not valid");
  });

  it("rejects production local mode outside a self-hosted deployment", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ORDINE_LOCAL_MODE", "true");

    expect(() => getServerEnv()).toThrow("ORDINE_LOCAL_MODE=true is not allowed in production");
  });

  it("allows production local mode for an explicit self-hosted deployment", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ORDINE_LOCAL_MODE", "true");
    vi.stubEnv("ORDINE_SELF_HOSTED", "true");

    expect(getServerEnv()).toMatchObject({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ordine",
      NODE_ENV: "production",
      ORDINE_LOCAL_MODE: true,
      ORDINE_SELF_HOSTED: true,
    });
  });
});
