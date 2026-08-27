import { Result } from "neverthrow";
import { FindingsView } from "./FindingsView";
import { MessageBubble } from "./MessageBubble";

interface OutputSectionProps {
  output: string;
}

export const OutputSection = ({ output }: OutputSectionProps) => {
  const parsed = Result.fromThrowable(
    () => JSON.parse(output) as { findings?: unknown[] },
    () => null,
  )();
  if (parsed.isOk() && parsed.value?.findings) {
    return <FindingsView output={output} />;
  }

  return <MessageBubble content={output} label="Agent Output" role="assistant" />;
};
