import type { PlatformCapabilities } from "@repo/views/platform";
import { resolveApiBaseUrl } from "@/lib/resolveApiBaseUrl";

/**
 * Web 端（浏览器）平台能力实现。
 *
 * 共享包 @repo/views 不直接引用浏览器 API，客户端特有行为在此注入。
 */
export const webPlatform: PlatformCapabilities = {
  apiBaseUrl: resolveApiBaseUrl(
    globalThis.window === undefined ? undefined : globalThis.window.location,
  ),
  request: (input, init) => globalThis.fetch(input, init),
  copyText: async (text) => {
    if (!globalThis.navigator?.clipboard?.writeText) {
      throw new Error("Clipboard API is unavailable");
    }
    await globalThis.navigator.clipboard.writeText(text);
  },
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
