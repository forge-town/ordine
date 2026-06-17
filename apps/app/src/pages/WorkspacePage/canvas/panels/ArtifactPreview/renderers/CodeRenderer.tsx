export const CodeRenderer = ({ code }: { code: string }) => (
  <pre
    className="max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre text-foreground"
    data-testid="artifact-renderer-code"
  >
    {code}
  </pre>
);
