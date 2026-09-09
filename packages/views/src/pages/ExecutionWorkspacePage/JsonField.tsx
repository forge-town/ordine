import { useState } from "react";
import { Result } from "neverthrow";
import { z } from "zod";
import { Button } from "@repo/ui/button";
import { TextField } from "./TextField";
export const JsonField = ({
  label,
  value,
  onCommit,
  schema = z.json(),
}: {
  label: string;
  value: unknown;
  onCommit: (value: unknown) => void;
  schema?: z.ZodType;
}) => {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const commit = () => {
    const parsed = Result.fromThrowable(
      () => schema.parse(JSON.parse(text ?? JSON.stringify(value ?? {}))),
      () => "JSON 格式或内容不符合约束",
    )();
    if (parsed.isErr()) setError(parsed.error);
    else {
      onCommit(parsed.value);
      setText(null);
      setError(null);
    }
  };
  const handleChange1: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = setText;
  const handleClick2: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = commit;

  return (
    <div className="space-y-2">
      <TextField
        multiline
        label={label}
        value={text ?? JSON.stringify(value ?? {}, null, 2)}
        onChange={handleChange1}
      />
      <div className="flex items-center gap-2">
        <Button
          disabled={text === null}
          size="sm"
          type="button"
          variant="outline"
          onClick={handleClick2}
        >
          应用 JSON
        </Button>
        {text !== null && (
          <span className="text-xs text-muted-foreground">应用后才会随表单保存</span>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
