import { useState } from "react";
import { ResultAsync } from "neverthrow";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { Button } from "@repo/ui/button";

interface CopyButtonProps {
  text: string;
}

const COPIED_RESET_MS = 1500;
type CopyState = "idle" | "copied" | "failed";

export const CopyButton = ({ text }: CopyButtonProps) => {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const handleCopyButtonClick = () => {
    void ResultAsync.fromPromise(
      navigator.clipboard.writeText(text),
      () => "clipboard-copy-failed" as const,
    ).match(
      () => {
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), COPIED_RESET_MS);
      },
      () => {
        setCopyState("failed");
        setTimeout(() => setCopyState("idle"), COPIED_RESET_MS);
      },
    );
  };
  const label = copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy";

  return (
    <Button
      aria-label={label}
      className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
      size="icon"
      variant="ghost"
      onClick={handleCopyButtonClick}
    >
      {copyState === "copied" ? (
        <Check className="h-3 w-3" />
      ) : copyState === "failed" ? (
        <AlertTriangle className="h-3 w-3 text-destructive" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
};
