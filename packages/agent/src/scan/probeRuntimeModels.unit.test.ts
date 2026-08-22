import { describe, expect, it } from "vitest";
import {
  normalizeClaudeModels,
  normalizeAcpModels,
  parseCodexModelListLine,
  parseKimiModels,
  parseOpenCodeModels,
  parsePiModels,
} from "./probeRuntimeModels";

describe("runtime model catalog parsers", () => {
  it("normalizes ACP model config options and the active model", () => {
    expect(
      normalizeAcpModels({
        configOptions: [
          {
            id: "model",
            type: "select",
            category: "model",
            currentValue: "deepseek-v4-pro",
            options: [
              { value: "deepseek-v4-flash", name: "Flash" },
              { value: "deepseek-v4-pro", name: "Pro" },
            ],
          },
        ],
      }),
    ).toEqual([
      { id: "deepseek-v4-flash", displayName: "Flash (deepseek-v4-flash)" },
      { id: "deepseek-v4-pro", displayName: "Pro (deepseek-v4-pro)", isDefault: true },
    ]);
  });

  it("normalizes Codex model/list capabilities", () => {
    const models = parseCodexModelListLine(
      JSON.stringify({
        id: 2,
        result: {
          data: [
            {
              model: "gpt-5.6-sol",
              displayName: "GPT-5.6-Sol",
              description: "Frontier coding model",
              isDefault: true,
              defaultReasoningEffort: "medium",
              supportedReasoningEfforts: [
                { reasoningEffort: "low", description: "Fast" },
                { reasoningEffort: "medium", description: "Balanced" },
              ],
              inputModalities: ["text", "image"],
              serviceTiers: [{ id: "priority", name: "Fast" }],
              additionalSpeedTiers: ["fast"],
            },
          ],
        },
      }),
      "2",
    );

    expect(models).toEqual([
      {
        id: "gpt-5.6-sol",
        displayName: "GPT-5.6-Sol",
        description: "Frontier coding model",
        isDefault: true,
        defaultReasoningEffort: "medium",
        reasoningEfforts: [
          { value: "low", description: "Fast" },
          { value: "medium", description: "Balanced", isDefault: true },
        ],
        defaultSpeed: "standard",
        speeds: [
          { value: "standard", label: "Standard", isDefault: true },
          { value: "priority", label: "Fast" },
        ],
        supportsImageInput: true,
      },
    ]);
    expect(parseCodexModelListLine('{"method":"thread/started"}', "2")).toBeUndefined();
  });

  it("normalizes Claude Agent SDK model metadata", () => {
    expect(
      normalizeClaudeModels([
        {
          value: "sonnet",
          displayName: "Sonnet",
          description: "Balanced Claude model",
          supportsEffort: true,
          supportedEffortLevels: ["low", "medium", "high"],
          supportsVision: true,
        },
      ]),
    ).toEqual([
      {
        id: "sonnet",
        displayName: "Sonnet",
        description: "Balanced Claude model",
        reasoningEfforts: [{ value: "low" }, { value: "medium" }, { value: "high" }],
        supportsImageInput: true,
      },
    ]);
  });

  it("parses OpenCode verbose model output", () => {
    const output = `opencode/gpt-5.6
{
  "id": "gpt-5.6",
  "providerID": "opencode",
  "name": "GPT 5.6",
  "description": "Coding model",
  "capabilities": {
    "reasoning": true,
    "input": { "text": true, "image": true }
  },
  "variants": {
    "low": { "reasoningEffort": "low" },
    "high": { "reasoningEffort": "high" }
  }
}
opencode/fast-model
{
  "id": "fast-model",
  "providerID": "opencode",
  "name": "Fast Model",
  "capabilities": {
    "reasoning": false,
    "input": { "text": true, "image": false }
  },
  "variants": {}
}`;

    expect(parseOpenCodeModels(output)).toEqual([
      {
        id: "opencode/gpt-5.6",
        displayName: "GPT 5.6",
        description: "Coding model",
        reasoningEfforts: [{ value: "low" }, { value: "high" }],
        supportsImageInput: true,
      },
      {
        id: "opencode/fast-model",
        displayName: "Fast Model",
        reasoningEfforts: [],
        supportsImageInput: false,
      },
    ]);
  });

  it("parses Kimi config without exposing provider credentials", () => {
    const config = `default_model = "kimi-code/k3"

[models."kimi-code/k3"]
provider = "managed:kimi-code"
model = "k3"
capabilities = ["thinking", "image_in"]
display_name = "K3"

[models."custom/text-only"]
provider = "custom"
model = "text-only"
capabilities = []
`;

    expect(parseKimiModels(config)).toEqual([
      {
        id: "kimi-code/k3",
        displayName: "K3",
        isDefault: true,
        reasoningEfforts: [
          { value: "off", label: "Off" },
          { value: "on", label: "On" },
        ],
        supportsImageInput: true,
      },
      {
        id: "custom/text-only",
        displayName: "text-only",
        isDefault: false,
        reasoningEfforts: [],
        supportsImageInput: false,
      },
    ]);
  });

  it("parses Pi's machine-local model table", () => {
    const output = `provider    model                   context  max-out  thinking  images
deepseek    deepseek-v4-flash       1M       384K     yes       no
kimi        kimi-for-coding         262.1K   32.8K    yes       no
anthropic   claude-sonnet           200K     64K      yes       yes`;

    expect(parsePiModels(output)).toEqual([
      {
        id: "deepseek/deepseek-v4-flash",
        displayName: "deepseek-v4-flash",
        reasoningEfforts: [
          { value: "off" },
          { value: "minimal" },
          { value: "low" },
          { value: "medium" },
          { value: "high" },
          { value: "xhigh" },
        ],
        supportsImageInput: false,
      },
      {
        id: "kimi/kimi-for-coding",
        displayName: "kimi-for-coding",
        reasoningEfforts: [
          { value: "off" },
          { value: "minimal" },
          { value: "low" },
          { value: "medium" },
          { value: "high" },
          { value: "xhigh" },
        ],
        supportsImageInput: false,
      },
      {
        id: "anthropic/claude-sonnet",
        displayName: "claude-sonnet",
        reasoningEfforts: [
          { value: "off" },
          { value: "minimal" },
          { value: "low" },
          { value: "medium" },
          { value: "high" },
          { value: "xhigh" },
        ],
        supportsImageInput: true,
      },
    ]);
  });
});
