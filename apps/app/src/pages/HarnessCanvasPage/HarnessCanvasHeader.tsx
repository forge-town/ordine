import { Settings, Save, FolderOpen } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Separator } from "@repo/ui/separator";

export const HarnessCanvasHeader = () => {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">Canvas</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">无标题 Pipeline</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-xs"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          打开
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-xs"
        >
          <Save className="h-3.5 w-3.5" />
          保存
        </Button>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};
