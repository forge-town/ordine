import type { PlatformCapabilities } from "@repo/views/platform";
import type { DesktopCredentials } from "./sidecar/server";

/**
 * Desktop 端平台能力实现。
 *
 * 当前使用 Tauri WebView 内置的下载能力（anchor download 会触发系统保存）。
 * 后续可替换为 Tauri 原生保存对话框（@tauri-apps/plugin-dialog + fs）。
 */
export const createDesktopRequest = (
  credentials: Pick<DesktopCredentials, "baseUrl" | "appToken">,
  request: PlatformCapabilities["request"] = (input, init) => globalThis.fetch(input, init),
): PlatformCapabilities["request"] => {
  const base = new URL(credentials.baseUrl);
  if (
    base.protocol !== "http:" ||
    base.hostname !== "127.0.0.1" ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new Error("Native API origin is invalid.");

  return async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, base);
    if (
      url.origin !== base.origin ||
      url.username ||
      url.password ||
      !(url.pathname === "/api" || url.pathname.startsWith("/api/"))
    )
      throw new Error("Desktop requests must target this instance's API.");
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    headers.set("X-Desktop-Token", credentials.appToken);
    headers.set("X-Ordine-Api-Version", "2");

    return request(input instanceof Request ? input : url.href, {
      ...init,
      headers,
      redirect: "error",
    });
  };
};

export const createDesktopPlatform = (
  credentials: Pick<DesktopCredentials, "baseUrl" | "appToken">,
): PlatformCapabilities => ({
  apiBaseUrl: `${credentials.baseUrl.replace(/\/+$/, "")}/api`,
  request: createDesktopRequest(credentials),
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
});
