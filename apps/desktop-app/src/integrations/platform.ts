import type { PlatformCapabilities } from "@repo/views/platform";

/**
 * Desktop 端平台能力实现。
 *
 * 当前使用 Tauri WebView 内置的下载能力（anchor download 会触发系统保存）。
 * 后续可替换为 Tauri 原生保存对话框（@tauri-apps/plugin-dialog + fs）。
 */
export const desktopPlatform: PlatformCapabilities = {
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
