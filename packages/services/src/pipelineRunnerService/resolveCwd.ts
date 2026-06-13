import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { statSync } from "node:fs";
import { Result } from "neverthrow";

/** 把前导 `~` / `~/...` 展开为用户主目录（仅处理开头的 ~，不碰路径中段）。 */
export const expandHome = (input: string): string => {
  if (input === "~") return homedir();
  if (input.startsWith("~/")) return join(homedir(), input.slice(2));

  return input;
};

/**
 * 把 inputPath 解析成一个**真实存在的目录**作为 cwd。
 * - 空 / http(s) → process.cwd()
 * - 前导 `~` 先展开为 home（否则 statSync 必失败，是 N20-03 的崩因之一）
 * - 是文件 → 取父目录
 * - 是目录 → 原样
 * - 不存在（占位路径，如 Agent 提案塞的 `~/Desktop/x` / `~/Documents/Code/your-ts-repo`）
 *   → 回退 process.cwd()，绝不把无效路径当 cwd（否则 spawn ENOENT）。
 */
export const resolveCwd = ({ inputPath }: { inputPath: string | undefined }): string => {
  if (!inputPath) return process.cwd();
  if (inputPath.startsWith("http://") || inputPath.startsWith("https://")) return process.cwd();

  const expanded = expandHome(inputPath);

  const result = Result.fromThrowable(
    () => statSync(expanded),
    () => undefined,
  )();

  if (result.isErr()) {
    // 路径不存在（占位/未填）：回退到进程 cwd，避免把无效路径交给子进程。
    return process.cwd();
  }

  if (!result.value.isDirectory()) {
    return dirname(expanded);
  }

  return expanded;
};
