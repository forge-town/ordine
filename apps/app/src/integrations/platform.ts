import type { PlatformCapabilities } from "@repo/views/platform";

/**
 * Web 端（浏览器）平台能力实现。
 *
 * 共享包 @repo/views 不直接引用浏览器 API，客户端特有行为在此注入。
 */
export const webPlatform: PlatformCapabilities = {
  apiBaseUrl:
    globalThis.window === undefined
      ? "http://localhost:9433/api"
      : globalThis.window.location.hostname === "localhost"
        ? "http://localhost:9433/api"
        : `${globalThis.window.location.origin}/api`,
  request: (input, init) => globalThis.fetch(input, init),
  downloadBlob: (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
};
