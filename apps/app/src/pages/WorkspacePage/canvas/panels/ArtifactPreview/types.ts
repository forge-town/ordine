import type { TemplateContentType } from "@repo/schemas";

/** 读取单个工件文件的结果（与 artifactsService.readFile 返回对齐）。 */
export type ArtifactFileLoadResult = {
  content: string;
  contentType: TemplateContentType;
  truncated?: boolean;
};

/**
 * 工件文件加载器：注入式依赖，使 ArtifactPreview 保持纯展示、story 可 mock。
 * 真实场景由 tRPC artifacts.readFile 提供；story 传入桩实现。
 */
export type ArtifactFileLoader = (filePath: string) => Promise<ArtifactFileLoadResult>;
