import Markdown from "react-markdown";

export const MarkdownRenderer = ({ markdown }: { markdown: string }) => (
  <div
    className="prose prose-sm dark:prose-invert max-h-96 max-w-none overflow-auto rounded-lg bg-background p-4"
    data-testid="artifact-renderer-markdown"
  >
    <Markdown>{markdown}</Markdown>
  </div>
);
