import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { query, type ModelInfo } from "@anthropic-ai/claude-agent-sdk";
import type { DetectedRuntime, RuntimeModel, RuntimeModelCapabilityOption } from "@repo/schemas";
import { Result, ResultAsync } from "neverthrow";
import { parse as parseToml } from "smol-toml";
import { spawnCommand } from "../spawn/spawnCommand";

const MODEL_PROBE_TIMEOUT_MS = 15_000;
const CODEX_INITIALIZE_REQUEST_ID = "1";
const CODEX_MODEL_LIST_REQUEST_ID = "2";
const PI_REASONING_EFFORTS = ["off", "minimal", "low", "medium", "high", "xhigh"];

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();

  return trimmed || undefined;
};

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const parseJson = (raw: string): unknown | undefined =>
  Result.fromThrowable(
    () => JSON.parse(raw) as unknown,
    () => undefined,
  )().unwrapOr(undefined);

const uniqueOptions = (options: RuntimeModelCapabilityOption[]): RuntimeModelCapabilityOption[] => {
  const seen = new Set<string>();

  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);

    return true;
  });
};

const normalizeCapabilityOptions = (
  value: unknown,
  defaultValue?: string,
): RuntimeModelCapabilityOption[] => {
  if (!Array.isArray(value)) return [];
  const options = value.flatMap((item): RuntimeModelCapabilityOption[] => {
    if (typeof item === "string" && item.trim()) {
      return [{ value: item.trim(), ...(item.trim() === defaultValue ? { isDefault: true } : {}) }];
    }
    const record = asRecord(item);
    if (!record) return [];
    const optionValue =
      asString(record["reasoningEffort"]) ??
      asString(record["effort"]) ??
      asString(record["value"]) ??
      asString(record["id"]);
    if (!optionValue) return [];
    const label = asString(record["label"]) ?? asString(record["name"]);
    const description = asString(record["description"]);
    const isDefault =
      asBoolean(record["default"]) === true ||
      asBoolean(record["isDefault"]) === true ||
      optionValue === defaultValue;

    return [
      {
        value: optionValue,
        ...(label ? { label } : {}),
        ...(description ? { description } : {}),
        ...(isDefault ? { isDefault: true } : {}),
      },
    ];
  });

  return uniqueOptions(options);
};

const canonicalSpeed = (value: string | undefined): string | undefined => {
  if (!value || value === "default" || value === "standard") return "standard";
  if (value === "priority" || value === "fast") return "priority";

  return value;
};

const normalizeCodexSpeeds = (model: UnknownRecord): RuntimeModelCapabilityOption[] | undefined => {
  const advertised =
    Array.isArray(model["serviceTiers"]) || Array.isArray(model["additionalSpeedTiers"]);
  if (!advertised) return undefined;

  const options: RuntimeModelCapabilityOption[] = [
    { value: "standard", label: "Standard", isDefault: true },
  ];
  for (const raw of [model["serviceTiers"], model["additionalSpeedTiers"]]) {
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      const record = asRecord(item);
      const rawValue = typeof item === "string" ? item : asString(record?.["id"]);
      const value = canonicalSpeed(asString(rawValue));
      if (!value) continue;
      const label = asString(record?.["name"]);
      const description = asString(record?.["description"]);
      options.push({
        value,
        ...(label ? { label } : {}),
        ...(description ? { description } : {}),
      });
    }
  }

  return uniqueOptions(options);
};

const normalizeCodexModel = (value: unknown): RuntimeModel | undefined => {
  const model = asRecord(value);
  if (!model) return undefined;
  const id = asString(model["model"]) ?? asString(model["id"]);
  if (!id) return undefined;
  const displayName = asString(model["displayName"]) ?? asString(model["display_name"]) ?? id;
  const description = asString(model["description"]);
  const defaultReasoningEffort =
    asString(model["defaultReasoningEffort"]) ?? asString(model["default_reasoning_effort"]);
  const rawReasoning = model["supportedReasoningEfforts"] ?? model["supported_reasoning_efforts"];
  const reasoningAdvertised = Array.isArray(rawReasoning);
  const reasoningEfforts = normalizeCapabilityOptions(rawReasoning, defaultReasoningEffort);
  const speeds = normalizeCodexSpeeds(model);
  const defaultSpeed = speeds
    ? canonicalSpeed(
        asString(model["defaultServiceTier"]) ?? asString(model["default_service_tier"]),
      )
    : undefined;
  const rawModalities = model["inputModalities"] ?? model["input_modalities"];
  const supportsImageInput = Array.isArray(rawModalities)
    ? rawModalities.some((modality) => asString(modality)?.toLowerCase() === "image")
    : undefined;

  return {
    id,
    displayName,
    ...(description ? { description } : {}),
    ...(asBoolean(model["isDefault"]) === true || asBoolean(model["is_default"]) === true
      ? { isDefault: true }
      : {}),
    ...(defaultReasoningEffort ? { defaultReasoningEffort } : {}),
    ...(reasoningAdvertised ? { reasoningEfforts } : {}),
    ...(defaultSpeed ? { defaultSpeed } : {}),
    ...(speeds ? { speeds } : {}),
    ...(supportsImageInput === undefined ? {} : { supportsImageInput }),
  };
};

export const parseCodexModelListLine = (
  line: string,
  requestId: string,
): RuntimeModel[] | undefined => {
  const payload = asRecord(parseJson(line));
  if (!payload || String(payload["id"] ?? "") !== requestId) return undefined;
  if (payload["error"] !== undefined && payload["error"] !== null) return [];
  const result = asRecord(payload["result"]);
  if (!Array.isArray(result?.["data"])) return [];

  return result["data"].flatMap((item) => {
    const model = normalizeCodexModel(item);

    return model ? [model] : [];
  });
};

export const normalizeClaudeModels = (models: unknown[]): RuntimeModel[] =>
  models.flatMap((value) => {
    const model = asRecord(value);
    if (!model) return [];
    const id =
      asString(model["value"]) ??
      asString(model["id"]) ??
      asString(model["modelId"]) ??
      asString(model["model_id"]);
    if (!id) return [];
    const displayName = asString(model["displayName"]) ?? asString(model["display_name"]) ?? id;
    const description = asString(model["description"]);
    const supportsEffort = asBoolean(model["supportsEffort"]);
    const reasoningEfforts = normalizeCapabilityOptions(model["supportedEffortLevels"]);
    const supportsImageInput =
      asBoolean(model["supportsVision"]) ?? asBoolean(model["supportsImageInput"]);

    return [
      {
        id,
        displayName,
        ...(description ? { description } : {}),
        ...(id === "default" ? { isDefault: true } : {}),
        ...(supportsEffort === true || Array.isArray(model["supportedEffortLevels"])
          ? { reasoningEfforts }
          : {}),
        ...(supportsImageInput === undefined ? {} : { supportsImageInput }),
      },
    ];
  });

const normalizeOpenCodeModel = (fullId: string, value: unknown): RuntimeModel | undefined => {
  const model = asRecord(value);
  if (!model) return undefined;
  const id = fullId.trim();
  if (!id) return undefined;
  const displayName = asString(model["name"]) ?? asString(model["id"]) ?? id;
  const description = asString(model["description"]);
  const capabilities = asRecord(model["capabilities"]);
  const input = asRecord(capabilities?.["input"]);
  const variants = asRecord(model["variants"]);
  const reasoningAdvertised = asBoolean(capabilities?.["reasoning"]);
  const reasoningEfforts = variants
    ? Object.keys(variants).map((variant) => ({ value: variant }))
    : [];
  const supportsImageInput = asBoolean(input?.["image"]);

  return {
    id,
    displayName,
    ...(description ? { description } : {}),
    ...(reasoningAdvertised === undefined ? {} : { reasoningEfforts }),
    ...(supportsImageInput === undefined ? {} : { supportsImageInput }),
  };
};

export const parseOpenCodeModels = (stdout: string): RuntimeModel[] => {
  const lines = stdout.split(/\r?\n/);
  const models: RuntimeModel[] = [];

  const cursor = { index: 0 };
  for (; cursor.index < lines.length - 1; cursor.index += 1) {
    const fullId = lines[cursor.index]?.trim() ?? "";
    if (!fullId || lines[cursor.index + 1]?.trim() !== "{") continue;
    const jsonLines: string[] = [];
    for (const jsonIndex of Array.from(
      { length: lines.length - cursor.index - 1 },
      (_, offset) => cursor.index + offset + 1,
    )) {
      jsonLines.push(lines[jsonIndex] ?? "");
      const parsed = parseJson(jsonLines.join("\n"));
      if (!asRecord(parsed)) continue;
      const model = normalizeOpenCodeModel(fullId, parsed);
      if (model) models.push(model);
      cursor.index = jsonIndex;
      break;
    }
  }

  return models;
};

export const parseKimiModels = (rawConfig: string): RuntimeModel[] => {
  const config = asRecord(
    Result.fromThrowable(
      () => parseToml(rawConfig) as unknown,
      () => undefined,
    )().unwrapOr(undefined),
  );
  const models = asRecord(config?.["models"]);
  if (!models) return [];
  const defaultModel = asString(config?.["default_model"]);

  return Object.entries(models).flatMap(([id, rawModel]) => {
    const model = asRecord(rawModel);
    if (!model) return [];
    const capabilities = Array.isArray(model["capabilities"])
      ? model["capabilities"].flatMap((capability) => {
          const value = asString(capability);

          return value ? [value] : [];
        })
      : [];
    const supportsReasoning = capabilities.includes("thinking");

    return [
      {
        id,
        displayName: asString(model["display_name"]) ?? asString(model["model"]) ?? id,
        isDefault: id === defaultModel,
        reasoningEfforts: supportsReasoning
          ? [
              { value: "off", label: "Off" },
              { value: "on", label: "On" },
            ]
          : [],
        supportsImageInput: capabilities.includes("image_in"),
      },
    ];
  });
};

export const parsePiModels = (stdout: string): RuntimeModel[] => {
  const rowPattern = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(yes|no)\s+(yes|no)\s*$/;

  return stdout.split(/\r?\n/).flatMap((line) => {
    const match = rowPattern.exec(line.trim());
    if (!match || match[1] === "provider") return [];
    const provider = match[1];
    const modelId = match[2];
    const thinking = match[5];
    const images = match[6];
    if (!provider || !modelId) return [];

    return [
      {
        id: `${provider}/${modelId}`,
        displayName: modelId,
        reasoningEfforts:
          thinking === "yes" ? PI_REASONING_EFFORTS.map((value) => ({ value })) : [],
        supportsImageInput: images === "yes",
      },
    ];
  });
};

export const normalizeAcpModels = (value: unknown): RuntimeModel[] => {
  const result = asRecord(value);
  if (!result) return [];
  const configOptions = Array.isArray(result["configOptions"]) ? result["configOptions"] : [];
  const modelConfig = configOptions.find((rawOption) => {
    const option = asRecord(rawOption);
    const id = asString(option?.["id"])
      ?.toLowerCase()
      .replaceAll(/[\s_-]+/g, "");
    const name = asString(option?.["name"])
      ?.toLowerCase()
      .replaceAll(/[\s_-]+/g, "");
    const category = asString(option?.["category"])
      ?.toLowerCase()
      .replaceAll(/[\s_-]+/g, "");

    return category === "model" || id === "model" || (!category && name === "model");
  });
  const config = asRecord(modelConfig);
  const currentValue = asString(config?.["currentValue"]);
  const configModels = (Array.isArray(config?.["options"]) ? config["options"] : []).flatMap(
    (rawModel): RuntimeModel[] => {
      const model = asRecord(rawModel);
      const id = asString(model?.["value"]) ?? asString(model?.["id"]);
      if (!id) return [];
      const name = asString(model?.["name"]);

      return [
        {
          id,
          displayName: name && name !== id ? `${name} (${id})` : id,
          ...(id === currentValue ? { isDefault: true } : {}),
        },
      ];
    },
  );
  if (configModels.length > 0) return configModels;

  const models = asRecord(result["models"]);
  const currentModelId = asString(models?.["currentModelId"]);

  return (Array.isArray(models?.["availableModels"]) ? models["availableModels"] : []).flatMap(
    (rawModel): RuntimeModel[] => {
      const model = asRecord(rawModel);
      const id = asString(model?.["modelId"]);
      if (!id) return [];
      const name = asString(model?.["name"]);

      return [
        {
          id,
          displayName: name && name !== id ? `${name} (${id})` : id,
          ...(id === currentModelId ? { isDefault: true } : {}),
        },
      ];
    },
  );
};

const probeAcpModels = (path: string, args: string[]): Promise<RuntimeModel[]> =>
  new Promise((resolve, reject) => {
    const child = spawnCommand(path, args, {
      cwd: tmpdir(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    const state = { settled: false, buffer: "", expectedId: 1 };
    const timeout = setTimeout(() => {
      if (state.settled) return;
      state.settled = true;
      child.kill("SIGTERM");
      reject(new Error("ACP model detection timed out"));
    }, MODEL_PROBE_TIMEOUT_MS);
    const finish = (models: RuntimeModel[]): void => {
      if (state.settled) return;
      state.settled = true;
      clearTimeout(timeout);
      child.stdin.end();
      child.kill("SIGTERM");
      resolve(models);
    };
    const fail = (message: string): void => {
      if (state.settled) return;
      state.settled = true;
      clearTimeout(timeout);
      child.kill("SIGTERM");
      reject(new Error(message));
    };
    const send = (id: number, method: string, params: unknown): void => {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    };
    const handleLine = (line: string): void => {
      const message = asRecord(parseJson(line));
      if (!message || Number(message["id"]) !== state.expectedId) return;
      const error = asRecord(message["error"]);
      if (error) {
        fail(asString(error["message"]) ?? "ACP model detection failed");

        return;
      }
      const result = asRecord(message["result"]);
      if (!result) return;
      if (state.expectedId === 1) {
        state.expectedId = 2;
        send(2, "session/new", { cwd: tmpdir(), mcpServers: [] });

        return;
      }
      finish(normalizeAcpModels(result));
    };
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      state.buffer += chunk;
      const lines = state.buffer.split(/\r?\n/);
      state.buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) handleLine(line);
      }
    });
    child.once("error", (error) => fail(error.message));
    child.once("close", (code) => {
      if (!state.settled) fail(`ACP model detection exited before session/new (${code})`);
    });
    send(1, "initialize", {
      protocolVersion: 1,
      clientCapabilities: { terminal: false },
      clientInfo: { name: "ordine-detect", version: "0.0.2" },
    });
  });

const execFileStdout = (bin: string, args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    const command =
      process.platform === "win32" && /\.(?:cmd|bat)$/i.test(bin)
        ? { bin: "cmd.exe", args: ["/d", "/s", "/c", bin, ...args] }
        : { bin, args };
    execFile(
      command.bin,
      command.args,
      { cwd: tmpdir(), timeout: MODEL_PROBE_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);

          return;
        }
        // Pi intentionally writes its human-readable model table to stderr;
        // other runtimes use stdout. Keep the probe protocol agnostic.
        const stdoutText = String(stdout);
        resolve(stdoutText.trim() ? stdoutText : String(stderr));
      },
    );
  });

const probeCodexModels = (path: string): Promise<RuntimeModel[]> =>
  new Promise((resolve, reject) => {
    const child = spawnCommand(path, ["app-server"], {
      cwd: tmpdir(),
      stdio: ["pipe", "pipe", "ignore"],
    });
    const state = { settled: false, buffer: "" };
    const timeout = setTimeout(() => {
      if (state.settled) return;
      state.settled = true;
      child.kill();
      reject(new Error("Codex model/list timed out"));
    }, MODEL_PROBE_TIMEOUT_MS);
    const finish = (models: RuntimeModel[]) => {
      if (state.settled) return;
      state.settled = true;
      clearTimeout(timeout);
      child.kill();
      resolve(models);
    };
    const fail = (error: Error) => {
      if (state.settled) return;
      state.settled = true;
      clearTimeout(timeout);
      child.kill();
      reject(error);
    };
    const send = (payload: UnknownRecord) => child.stdin.write(`${JSON.stringify(payload)}\n`);

    child.once("error", (error) => fail(error));
    child.once("exit", (code) => {
      if (!state.settled)
        fail(new Error(`Codex app-server exited before model/list (${code ?? "unknown"})`));
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      state.buffer += chunk;
      const lines = state.buffer.split(/\r?\n/);
      state.buffer = lines.pop() ?? "";
      for (const line of lines) {
        const payload = asRecord(parseJson(line));
        if (String(payload?.["id"] ?? "") === CODEX_INITIALIZE_REQUEST_ID) {
          send({ method: "initialized", params: {} });
          send({
            id: Number(CODEX_MODEL_LIST_REQUEST_ID),
            method: "model/list",
            params: { cursor: null, limit: 100, includeHidden: false },
          });
        }
        const models = parseCodexModelListLine(line, CODEX_MODEL_LIST_REQUEST_ID);
        if (models) finish(models);
      }
    });
    send({
      id: Number(CODEX_INITIALIZE_REQUEST_ID),
      method: "initialize",
      params: {
        clientInfo: { name: "ordine", title: "Ordine", version: "0.0.2-preview" },
        capabilities: { experimentalApi: true },
      },
    });
  });

const probeClaudeModels = (path: string): Promise<RuntimeModel[]> => {
  const claudeQuery = query({
    prompt: (async function* () {})(),
    options: {
      pathToClaudeCodeExecutable: path,
      cwd: tmpdir(),
      settingSources: ["user"],
      mcpServers: {},
    },
  });
  const models = Promise.race([
    claudeQuery.supportedModels(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Claude supportedModels timed out")),
        MODEL_PROBE_TIMEOUT_MS,
      ),
    ),
  ]);

  return models.then(
    (value: ModelInfo[]) => {
      claudeQuery.close();

      return normalizeClaudeModels(value);
    },
    (error: unknown) => {
      claudeQuery.close();

      throw error;
    },
  );
};

const probeModels = async (
  runtime: Pick<DetectedRuntime, "type" | "path">,
): Promise<RuntimeModel[] | undefined> => {
  switch (runtime.type) {
    case "codex": {
      return probeCodexModels(runtime.path);
    }
    case "claude-code": {
      return probeClaudeModels(runtime.path);
    }
    case "opencode": {
      return parseOpenCodeModels(
        await execFileStdout(runtime.path, ["models", "--verbose", "--pure"]),
      );
    }
    case "kimi-code": {
      return probeAcpModels(runtime.path, ["acp"]);
    }
    case "pi-agent": {
      return parsePiModels(await execFileStdout(runtime.path, ["--list-models", "--offline"]));
    }
    case "hermes": {
      return probeAcpModels(runtime.path, ["acp", "--accept-hooks"]);
    }
    case "mistral-vibe": {
      return probeAcpModels(runtime.path, []);
    }
    case "deepseek-reasonix": {
      return probeAcpModels(runtime.path, ["acp"]);
    }
    case "kiro": {
      return probeAcpModels(runtime.path, ["acp"]);
    }
    case "trae": {
      return probeAcpModels(runtime.path, ["acp", "serve"]);
    }
    default: {
      return undefined;
    }
  }
};

export const probeRuntimeModels = async (
  runtime: Pick<DetectedRuntime, "type" | "path">,
): Promise<RuntimeModel[] | undefined> => {
  const result = await ResultAsync.fromPromise(
    Promise.resolve().then(() => probeModels(runtime)),
    () => undefined as never,
  );

  return result.isOk() ? result.value : undefined;
};
