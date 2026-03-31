import { Button } from "@repo/ui/button";

interface SaveButtonProps {
  onSave: () => void;
  saved: boolean;
}

export const SaveButton = ({ onSave, saved }: SaveButtonProps) => (
  <Button
    onClick={onSave}
    variant={saved ? "secondary" : "default"}
    className="mt-2"
  >
    {saved ? "已保存 ✓" : "保存更改"}
  </Button>
);
