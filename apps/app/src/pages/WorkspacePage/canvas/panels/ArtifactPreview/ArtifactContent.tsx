import { useTranslation } from "react-i18next";
import type { TemplateContentType } from "@repo/schemas";
import { pickRenderer, toImageSrc } from "./pickRenderer";
import { CodeRenderer } from "./renderers/CodeRenderer";
import { HtmlRenderer } from "./renderers/HtmlRenderer";
import { ImageRenderer } from "./renderers/ImageRenderer";
import { MarkdownRenderer } from "./renderers/MarkdownRenderer";
import { TextRenderer } from "./renderers/TextRenderer";

type ArtifactContentProps = {
  content: string;
  contentType: TemplateContentType;
  /** 文件路径（dir/file 工件用于按扩展名判定图片渲染） */
  path?: string;
  title?: string;
};

/** 按 contentType（+ 路径扩展名）把单段内容路由到对应渲染器。 */
export const ArtifactContent = ({ content, contentType, path, title }: ArtifactContentProps) => {
  const { t } = useTranslation();
  const kind = pickRenderer(contentType, path);

  if (kind === "image") {
    const src = toImageSrc(content, path);

    return src ? (
      <ImageRenderer src={src} alt={path} />
    ) : (
      <p
        className="rounded-lg bg-muted p-3 text-xs text-muted-foreground"
        data-testid="artifact-binary"
      >
        {t("workspace.canvas.preview.binary")}
      </p>
    );
  }
  if (kind === "html") return <HtmlRenderer html={content} title={title} />;
  if (kind === "markdown") return <MarkdownRenderer markdown={content} />;
  if (kind === "code") return <CodeRenderer code={content} />;

  return <TextRenderer text={content} />;
};
