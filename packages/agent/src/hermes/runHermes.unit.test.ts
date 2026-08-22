import { okAsync } from "neverthrow";
import { afterEach, describe, expect, it, vi } from "vitest";

const runConfiguredAcpAgentMock = vi.fn((_config: unknown, _options: unknown) => okAsync("done"));

vi.mock("../runtime/runConfiguredAcpAgent", () => ({
  runConfiguredAcpAgent: (config: unknown, options: unknown) =>
    runConfiguredAcpAgentMock(config, options),
}));

import { getHermesBin, runHermes } from "./runHermes";

describe("runHermes", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("runs Hermes through its native ACP server", async () => {
    const result = await runHermes({
      systemPrompt: "system",
      userPrompt: "user",
      cwd: "C:\\workspace",
      model: "grok-4.3",
    });

    expect(result._unsafeUnwrap()).toBe("done");
    expect(runConfiguredAcpAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime: "hermes",
        command: "hermes",
        args: ["acp", "--accept-hooks"],
      }),
      expect.objectContaining({ model: "grok-4.3" }),
    );
  });

  it("honors the Hermes executable override", () => {
    vi.stubEnv("HERMES_BIN", "C:\\tools\\hermes.exe");

    expect(getHermesBin()).toBe("C:\\tools\\hermes.exe");
  });
});
