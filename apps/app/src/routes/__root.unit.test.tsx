import { afterEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    handler: (handler: () => unknown) => handler,
  }),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => ({ headers: new Headers() }),
}));

vi.mock("@/integrations/better-auth", () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

vi.mock("@/integrations/server-env", () => ({
  getServerEnv: () => ({ ORDINE_LOCAL_MODE: false }),
}));

vi.mock("@/lib/i18n", () => ({}));
vi.mock("@/plugins/init", () => ({}));
vi.mock("./-NotFound", () => ({ NotFound: () => null }));
vi.mock("./-RootDocument", () => ({ RootDocument: () => null }));

import { Route } from "./__root";

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

describe("__root beforeLoad", () => {
  afterEach(() => {
    vi.clearAllMocks();

    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, "window", originalWindowDescriptor);

      return;
    }

    Reflect.deleteProperty(globalThis, "window");
  });

  it("does not throw when globalThis.window exists but is undefined", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
      writable: true,
    });

    const result = await Route.options.beforeLoad?.({} as never);

    expect(result).toEqual({ session: null, isLocalMode: false });
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});
