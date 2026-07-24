import { describe, expect, it, vi } from "vitest";
import { createPipelineAgentSessionsClient } from "./pipelineAgentSessionsClient";

describe("createPipelineAgentSessionsClient", () => {
  it("uses the consuming platform API base and request transport", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "session-1",
          entrypoint: "canvas-agent-panel",
          mode: "edit",
          status: "draft",
        }),
      ),
    );
    const client = createPipelineAgentSessionsClient({
      apiBaseUrl: "http://127.0.0.1:9433/api",
      request,
    });

    await client.createSession({ entrypoint: "canvas-agent-panel", mode: "edit" });

    expect(request).toHaveBeenCalledWith(
      "http://127.0.0.1:9433/api/pipeline-agent-sessions",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
