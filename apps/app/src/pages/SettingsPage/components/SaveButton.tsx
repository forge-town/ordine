import { Button } from "@repo/ui/button";

interface SaveButtonProps {
  onSave: () => void;
  saved: boolean;
}

export const SaveButton = ({ onSave, saved }: SaveButtonProps) => {
  const handleSave = onSave;
  return (
    <Button className="mt-2" variant={saved ? "secondary" : "default"} onClick={handleSave}>
      {saved ? "已保存 ✓" : "保存更改"}
    </Button>
  );
};
