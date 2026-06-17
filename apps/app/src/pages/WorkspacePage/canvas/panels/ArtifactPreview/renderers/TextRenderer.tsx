export const TextRenderer = ({ text }: { text: string }) => (
  <pre
    className="max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-foreground"
    data-testid="artifact-renderer-text"
  >
    {text}
  </pre>
);
