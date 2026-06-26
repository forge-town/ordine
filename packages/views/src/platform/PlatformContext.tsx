import { createContext, useContext, type ReactNode } from "react";

/**
 * 平台能力注入点。
 *
 * `@repo/views` 内部不得直接引用任何客户端特有 API（浏览器 DOM、Tauri、Electron 等）。
 * 凡是客户端特有的行为（文件下载、原生对话框、系统通知等）都通过该 Context 注入，
 * 由各应用（apps/app = Web，apps/desktop-app = Desktop）提供各自的实现。
 */
export interface PlatformCapabilities {
  /** 将二进制内容保存到本地。Web 端走浏览器下载，Desktop 端可走原生保存对话框。 */
  downloadBlob: (blob: Blob, filename: string) => void;
}

const PlatformContext = createContext<PlatformCapabilities | null>(null);

interface PlatformProviderProps {
  value: PlatformCapabilities;
  children: ReactNode;
}

export const PlatformProvider = ({ value, children }: PlatformProviderProps) => {
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
};

/** 读取注入的平台能力。必须在 {@link PlatformProvider} 内部使用。 */
export const usePlatform = (): PlatformCapabilities => {
  const ctx = useContext(PlatformContext);
  if (!ctx) {
    throw new Error("usePlatform 必须在 PlatformProvider 内部使用");
  }

  return ctx;
};
