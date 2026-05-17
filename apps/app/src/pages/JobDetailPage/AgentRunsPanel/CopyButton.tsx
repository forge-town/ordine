import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@repo/ui/button";

interface CopyButtonProps {
  text: string;
}

const COPIED_RESET_MS = 1500;

export const CopyButton = ({ text }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);
  const handleCopyButtonClick = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_RESET_MS);
    });
  };

  return (
    <Button
      className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
      size="icon"
      variant="ghost"
      onClick={handleCopyButtonClick}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
};
