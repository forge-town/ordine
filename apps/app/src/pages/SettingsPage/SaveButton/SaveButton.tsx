import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";

interface SaveButtonProps {
  onSave: () => void;
  saved: boolean;
}

export const SaveButton = ({ onSave, saved }: SaveButtonProps) => {
  const { t } = useTranslation();
  const handleSave = () => onSave();

  return (
    <Button className="mt-2" variant={saved ? "secondary" : "default"} onClick={handleSave}>
      {saved ? t("settings.saved") : t("settings.saveChanges")}
    </Button>
  );
};
