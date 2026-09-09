import { TRPCError } from "@trpc/server";

export const legacyExecutionDisabled = (): never => {
  throw new TRPCError({
    code: "NOT_IMPLEMENTED",
    message: "NOT_SUPPORTED: 旧运行接口已停用，请通过新版运行请求确认执行。",
  });
};
