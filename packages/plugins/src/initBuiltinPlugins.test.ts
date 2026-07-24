import { beforeEach, describe, expect, it } from "vitest";
import { pluginRegistry } from "@repo/plugin";
import { registerBuiltinPlugins } from "./initBuiltinPlugins";

describe("registerBuiltinPlugins", () => {
  beforeEach(() => {
    pluginRegistry.clear();
  });

  it("registers the built-in GitHub project plugin", () => {
    registerBuiltinPlugins();

    expect(pluginRegistry.getPlugin("builtin:github-project")).toBeDefined();
  });

  it("can initialize more than once without duplicating plugins", () => {
    registerBuiltinPlugins();

    expect(() => registerBuiltinPlugins()).not.toThrow();
    expect(pluginRegistry.getAllPlugins()).toHaveLength(1);
  });
});
