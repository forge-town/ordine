import { MessageBubble } from "./MessageBubble";
import { OutputSection } from "./OutputSection";

interface ConversationViewProps {
  payload: Record<string, unknown>;
}

export const ConversationView = ({ payload }: ConversationViewProps) => (
  <div className="p-3 space-y-2">
    {Boolean(payload.output) && <OutputSection output={String(payload.output)} />}
    {Boolean(payload.system) && (
      <MessageBubble content={String(payload.system)} label="System Prompt" role="system" />
    )}
    {Boolean(payload.prompt) && (
      <MessageBubble content={String(payload.prompt)} label="User Input" role="user" />
    )}
  </div>
);
