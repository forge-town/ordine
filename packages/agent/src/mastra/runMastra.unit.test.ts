import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerate = vi.fn();
const mockShutdown = vi.fn();

vi.mock("@mastra/core/agent", () => ({
  Agent: vi.fn().mockImplementation(function Agent(options) {
    return options;
  }),
}));

vi.mock("@mastra/core/mastra", () => ({
  Mastra: vi.fn().mockImplementation(function Mastra() {
    return {
      getAgent: vi.fn(() => ({
        generate: mockGenerate,
      })),
    };
  }),
}));

vi.mock("@mastra/observability", () => ({
  DefaultExporter: vi.fn(),
  Observability: vi.fn().mockImplementation(function Observability() {
    return {
      shutdown: mockShutdown,
    };
  }),
}));

vi.mock("@mastra/pg", () => ({
  PostgresStore: vi.fn(),
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("../integrations/env", () => ({
  // A fake key keeps this hermetic: without it the KIMI_API_KEY fast-fail guard
  // would make the outcome depend on the host machine's real env.
  getEnv: vi.fn(() => ({ KIMI_API_KEY: "test-key" })),
}));

import { runMastra } from "./runMastra";

describe("runMastra multimodal input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerate.mockResolvedValue({ text: "image summary" });
    mockShutdown.mockResolvedValue(undefined);
  });

  it("passes image content blocks to mastra generate", async () => {
    await runMastra({
      systemPrompt: "system",
      userPrompt: "Describe the uploaded image",
      cwd: process.cwd(),
      attachments: [
        {
          kind: "image",
          filename: "diagram.png",
          mediaType: "image/png",
          dataBase64: "ZmFrZQ==",
        },
      ],
    });

    expect(mockGenerate).toHaveBeenCalledWith([
      expect.objectContaining({
        role: "user",
        content: expect.arrayContaining([
          expect.objectContaining({
            type: "text",
            text: "Describe the uploaded image",
          }),
          expect.objectContaining({
            type: "image",
            mediaType: "image/png",
            image: "data:image/png;base64,ZmFrZQ==",
          }),
        ]),
      }),
    ]);
  });
});
