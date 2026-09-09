import type { Context } from "hono";

export const legacyExecutionDisabled = (c: Context) =>
  c.json({ code: "NOT_SUPPORTED", error: "旧运行接口已停用，请使用 v2 运行请求。" }, 410);
