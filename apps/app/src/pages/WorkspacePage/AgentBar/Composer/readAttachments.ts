import type { ProposeAttachment } from "@repo/schemas";

/** N14-01 限额：单文件 32k、所有附件全文总量 128k、DB excerpt 1k。 */
export const MAX_FILE_CHARS = 32_000;
export const MAX_TOTAL_CHARS = 128_000;
export const EXCERPT_CHARS = 1_000;

const TEXT_EXTENSIONS = new Set([
  "md",
  "markdown",
  "txt",
  "json",
  "csv",
  "tsv",
  "yaml",
  "yml",
  "xml",
  "html",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "sh",
  "sql",
  "toml",
  "ini",
  "log",
]);

const TEXT_MIME_TYPES = new Set(["application/json", "application/xml", "application/x-yaml"]);

export const isTextAttachment = (name: string, type: string): boolean => {
  if (type.startsWith("text/") || TEXT_MIME_TYPES.has(type)) {
    return true;
  }

  const extension = name.split(".").at(-1)?.toLowerCase() ?? "";

  return TEXT_EXTENSIONS.has(extension);
};

/**
 * 读取附件真实内容（N14-02 逆向工程的输入）。文本类附件读全文并按
 * 单文件/总量限额截断；二进制只保留元数据（UI 标注"仅文件名参与分析"）。
 * 返回值含 content（只走请求 payload）与 excerpt（唯一允许落库的内容字段）。
 */
export const readAttachments = async (
  files: File[],
  usedChars = 0,
): Promise<ProposeAttachment[]> => {
  const results: ProposeAttachment[] = [];
  const totalBudget = Math.max(0, MAX_TOTAL_CHARS - usedChars);

  for (const file of files) {
    const budget = totalBudget - results.reduce((sum, r) => sum + (r.content?.length ?? 0), 0);

    // webkitRelativePath 仅目录上传时存在（旧 jsdom 可能缺失）。
    const relativePath: string = file.webkitRelativePath ?? "";
    const name = relativePath.length > 0 ? relativePath : file.name;
    const base: ProposeAttachment = {
      name,
      size: file.size,
      type: file.type.length > 0 ? file.type : undefined,
    };

    if (!isTextAttachment(name, file.type) || budget <= 0) {
      results.push(base);
      continue;
    }

    const text = await file.text();
    const content = text.slice(0, Math.min(MAX_FILE_CHARS, budget));
    results.push({ ...base, content, excerpt: content.slice(0, EXCERPT_CHARS) });
  }

  return results;
};

/** 持久化前剥离全文——conversation_messages 只允许存 excerpt（手册警告 6）。 */
export const toMetadataAttachment = ({ content: _content, ...meta }: ProposeAttachment) => meta;
