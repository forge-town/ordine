import { useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Textarea } from "@repo/ui/textarea";
import type { AnnotationTargetType } from "@repo/schemas";
import { useCanvasAnnotations } from "./useAnnotations";

interface AnnComposerProps {
  targetId: string | null;
  targetLabel?: string;
  targetType?: AnnotationTargetType;
  onClose: () => void;
}

export const AnnComposer = ({
  targetId,
  targetLabel,
  targetType = "node",
  onClose,
}: AnnComposerProps) => {
  const annotations = useCanvasAnnotations();
  const [content, setContent] = useState("");
  const trimmed = content.trim();
  const canSubmit = !!annotations?.pipelineId && !!targetId && trimmed.length > 0;

  useEffect(() => {
    if (!targetId) {
      setContent("");
    }
  }, [targetId]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };
  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value);
  };
  const handleCancelClick = () => {
    onClose();
  };
  const handleSubmit = async () => {
    if (!targetId || !canSubmit) {
      return;
    }

    const created = await annotations?.createAnnotation({
      content: trimmed,
      targetId,
      targetType,
    });
    if (!created) {
      return;
    }

    setContent("");
    onClose();
  };

  return (
    <Dialog open={!!targetId} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[420px]" data-testid="annotation-composer">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
              <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Add annotation</DialogTitle>
              <DialogDescription className="truncate">
                {targetLabel ?? targetId ?? "Canvas target"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Textarea
          aria-label="Annotation content"
          className="min-h-28 resize-none"
          placeholder="Leave a note for this node..."
          value={content}
          onChange={handleContentChange}
        />
        {!annotations?.pipelineId && (
          <p className="text-xs text-destructive">Save the pipeline before adding annotations.</p>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleCancelClick}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit || annotations?.isCreating}
            type="button"
            onClick={handleSubmit}
          >
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
