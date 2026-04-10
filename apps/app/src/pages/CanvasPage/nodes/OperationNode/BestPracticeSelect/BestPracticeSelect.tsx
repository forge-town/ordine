import { useCallback, useState } from "react";
import { BookOpen } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";

interface BestPracticeOption {
  id: string;
  title: string;
}

interface BestPracticeSelectProps {
  bestPractices: BestPracticeOption[];
  value: string | undefined;
  onValueChange: (id: string | undefined, name: string | undefined) => void;
}

const handleStopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export const BestPracticeSelect = ({
  bestPractices,
  value,
  onValueChange,
}: BestPracticeSelectProps) => {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
  };
  const handleToggle = () => setOpen((prev) => !prev);

  const handleChange = useCallback(
    (v: string | null) => {
      if (!v || v === "__none__") {
        onValueChange(undefined, undefined);
      } else {
        const bp = bestPractices.find((b) => b.id === v);
        onValueChange(v, bp?.title ?? v);
      }
      setOpen(false);
    },
    [bestPractices, onValueChange],
  );

  return (
    <div className="space-y-1" onMouseDown={handleStopPropagation}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <BookOpen className="mr-1 inline-block h-3 w-3" />
        最佳实践
      </p>
      <Select
        items={bestPractices.map((bp) => ({
          value: bp.id,
          label: bp.title,
        }))}
        open={open}
        value={value}
        onOpenChange={handleOpenChange}
        onValueChange={handleChange}
      >
        <SelectTrigger
          className="h-6 min-w-0 w-full px-1.5 text-[10px]"
          onClick={handleToggle}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Best Practice</SelectLabel>
            {bestPractices.map((bp) => (
              <SelectItem key={bp.id} value={bp.id}>
                {bp.title}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};
