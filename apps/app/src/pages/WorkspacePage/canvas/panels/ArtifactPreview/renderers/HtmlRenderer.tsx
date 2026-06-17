type HtmlRendererProps = {
  html: string;
  title?: string;
};

/**
 * 沙箱 iframe：仅 allow-scripts，**不开 allow-same-origin** —— HTML 在唯一不透明源里运行，
 * 无法触达父文档 cookie/DOM，防止产物预览越权。
 */
export const HtmlRenderer = ({ html, title }: HtmlRendererProps) => (
  <iframe
    className="h-96 w-full rounded-lg border border-border bg-white"
    sandbox="allow-scripts"
    srcDoc={html}
    title={title ?? "artifact-html"}
    data-testid="artifact-renderer-html"
  />
);
