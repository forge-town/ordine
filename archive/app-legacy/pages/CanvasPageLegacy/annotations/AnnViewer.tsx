import { MessageSquare, Plus } from "lucide-react";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { ScrollArea } from "@repo/ui/scroll-area";
import { useTargetAnnotations } from "./useAnnotations";

interface AnnViewerProps {
  targetId: string | null;
  targetLabel?: string;
  onAdd: (targetId: string) => void;
  onClose: () => void;
}

const formatAnnotationTime = (value: Date) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);

export const AnnViewer = ({ targetId, targetLabel, onAdd, onClose }: AnnViewerProps) => {
  const annotations = useTargetAnnotations(targetId);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };
  const handleAddClick = () => {
    if (!targetId) {
      return;
    }

    onAdd(targetId);
  };
  const handleCloseClick = () => {
    onClose();
  };

  return (
    <Dialog open={!!targetId} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[460px]" data-testid="annotation-viewer">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Annotations</DialogTitle>
              <DialogDescription className="truncate">
                {targetLabel ?? targetId ?? "Canvas target"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[320px] pr-3">
          <div className="space-y-2">
            {annotations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                No annotations yet.
              </div>
            ) : (
              annotations.map((annotation) => (
                <article
                  key={annotation.id}
                  className="rounded-lg border border-border bg-background px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium capitalize">{annotation.author}</span>
                    <div className="flex items-center gap-2">
                      {annotation.resolved ? (
                        <Badge variant="secondary">Resolved</Badge>
                      ) : (
                        <Badge variant="outline">Open</Badge>
                      )}
                      <time className="text-[10.5px] text-muted-foreground">
                        {formatAnnotationTime(annotation.createdAt)}
                      </time>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-5">{annotation.content}</p>
                </article>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleCloseClick}>
            Close
          </Button>
          <Button disabled={!targetId} type="button" onClick={handleAddClick}>
            <Plus className="h-4 w-4" />
            Add note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
