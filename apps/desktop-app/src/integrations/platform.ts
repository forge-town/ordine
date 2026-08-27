import { createScopedRequest, type PlatformCapabilities } from "@repo/views/platform";
import { open } from "@tauri-apps/plugin-shell";
import { getDesktopAuthToken } from "./sidecar/server";

export const DESKTOP_API_BASE = "http://127.0.0.1:9433/api";

export const desktopRequest = createScopedRequest({
  baseUrl: DESKTOP_API_BASE,
  getHeaders: () => {
    const token = getDesktopAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers["X-Desktop-Token"] = token;

    return headers;
  },
});

/**
 * Desktop 端平台能力实现。
 *
 * 当前使用 Tauri WebView 内置的下载能力（anchor download 会触发系统保存）。
 * 后续可替换为 Tauri 原生保存对话框（@tauri-apps/plugin-dialog + fs）。
 */
export const desktopPlatform: PlatformCapabilities = {
  apiBaseUrl: DESKTOP_API_BASE,
  request: desktopRequest,
  copyText: async (text) => {
    if (!globalThis.navigator?.clipboard?.writeText) {
      throw new Error("Clipboard API is unavailable");
    }
    await globalThis.navigator.clipboard.writeText(text);
  },
  openPath: (path) => open(path),
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
