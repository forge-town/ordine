import { readFile } from "node:fs/promises";
import { ResultAsync } from "neverthrow";
import { createExecutionGateway } from "@repo/services";
import { getEnv } from "./env";

export const executionGateway = createExecutionGateway({
  target: getEnv().ORDINE_EXECUTION_API_TARGET,
  readToken: async () => {
    const path = getEnv().ORDINE_EXECUTION_AGENT_TOKEN_FILE;
    if (!path) throw new Error("执行服务的 Agent 凭据未配置。");
    const result = await ResultAsync.fromPromise(
      readFile(path, "utf8"),
      () => new Error("执行服务凭据无法读取。"),
    );
    if (result.isErr()) throw result.error;

    return result.value;
  },
});
