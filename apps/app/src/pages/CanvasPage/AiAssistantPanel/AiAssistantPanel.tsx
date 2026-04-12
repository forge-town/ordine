import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../_store";
import { Bot, X, Send, Loader2, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@repo/ui/button";
import { ScrollArea } from "@repo/ui/scroll-area";
import { Separator } from "@repo/ui/separator";
import { cn } from "@repo/ui/lib/utils";
import type { NodeType } from "../nodeSchemas";
import { safeJsonParse } from "@/lib/safeJson";
import { ResultAsync, err, ok } from "neverthrow";

const MASTRA_BASE = "http://localhost:4111";
const AGENT_ID = "harnessDesignAgent";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: PipelineAction[];
}

// Structured actions the AI can emit to mutate the pipeline
interface PipelineAction {
  type: "addNode" | "clearCanvas" | "connectNodes";
  nodeType?: NodeType;
  label?: string;
  skillName?: string;
  sourceId?: string;
  targetId?: string;
}

// Parse ```actions ... ``` blocks from the AI response
const parseActions = (
  text: string
): {
  clean: string;
  actions: PipelineAction[];
} => {
  const regex = /```actions\s*([\s\S]*?)```/g;
  const actions: PipelineAction[] = [];
  let clean = text;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const parseResult = safeJsonParse<PipelineAction | PipelineAction[]>(match[1].trim());
    if (parseResult.isOk()) {
      const list = Array.isArray(parseResult.value) ? parseResult.value : [parseResult.value];
      actions.push(...list);
    }
    clean = clean.replace(match[0], "").trim();
  }
  return { clean, actions };
};

export const AiAssistantPanel = () => {
  const { t } = useTranslation();
  const store = useHarnessCanvasStore();
  const isOpen = useStore(store, (state) => state.isAiAssistantOpen);
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const toggleAiAssistant = useStore(store, (state) => state.handleToggleAi);
  const clearCanvas = useStore(store, (state) => state.clearCanvas);
  const addNode = useStore(store, (state) => state.addNode);
  const onConnect = useStore(store, (state) => state.handleConnect);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("canvas.aiAssistantWelcome"),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleToggle = () => toggleAiAssistant();

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const executePipelineAction = (action: PipelineAction) => {
    if (action.type === "clearCanvas") {
      clearCanvas();
    } else if (action.type === "addNode" && action.nodeType) {
      const id = `${action.nodeType}-${Date.now()}`;
      const x = 200 + Math.random() * 300;
      const y = 150 + Math.random() * 250;
      if (action.nodeType === "operation") {
        addNode({
          id,
          type: "operation",
          position: { x, y },
          data: {
            label: action.label ?? "Operation",
            nodeType: "operation",
            operationId: "",
            operationName: action.label ?? "Operation",
            status: "idle",
            config: {},
          },
        });
      }
    } else if (action.type === "connectNodes" && action.sourceId && action.targetId) {
      onConnect({
        source: action.sourceId,
        sourceHandle: null,
        target: action.targetId,
        targetHandle: null,
      });
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Build context: current pipeline snapshot
    const pipelineContext = JSON.stringify({
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: (n.data as { label?: string }).label,
      })),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
    });

    const result = await ResultAsync.fromPromise(
      fetch(`${MASTRA_BASE}/api/agents/${AGENT_ID}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            {
              role: "user",
              content: `当前 Pipeline 状态:\n${pipelineContext}\n\n用户请求: ${userMsg.content}\n\n如果需要修改 Pipeline，请在回复末尾用 \`\`\`actions [...] \`\`\` JSON 块描述操作，支持的 type: addNode (需 nodeType, label, skillName?), clearCanvas, connectNodes (需 sourceId, targetId)。`,
            },
          ],
        }),
      }),
      () => "连接 Mastra 服务失败。请确保 `apps/mastra` 已在端口 4111 启动。"
    )
      .andThen((res) => {
        if (!res.ok) {
          return err(`HTTP ${res.status}`);
        }
        return ResultAsync.fromPromise(
          res.json() as Promise<{ text?: string; content?: string }>,
          () => "解析响应失败"
        );
      })
      .andThen((data) => ok(data));

    result.match(
      (data) => {
        const raw = data.text ?? data.content ?? "（无响应）";
        const { clean, actions } = parseActions(raw);
        actions.forEach(executePipelineAction);
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", content: clean, actions },
        ]);
      },
      (errorMsg) => {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", content: errorMsg },
        ]);
      }
    );
    setIsLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleChangeInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };
  const handleClickSend = () => void handleSend();

  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-3">
      {/* Expanded chat panel */}
      {isOpen && (
        <div className="flex h-[460px] w-[320px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between bg-primary px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-primary-foreground">Pipeline AI</p>
                <p className="text-[10px] text-primary-foreground/60">
                  {t("canvas.aiAssistantSubtitle")}
                </p>
              </div>
            </div>
            <Button
              className="h-6 w-6 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
              size="icon"
              variant="ghost"
              onClick={handleToggle}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1">
            <div className="space-y-3 p-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                      msg.role === "user"
                        ? "rounded-tr-sm bg-primary text-primary-foreground"
                        : "rounded-tl-sm bg-muted text-foreground"
                    )}
                  >
                    {msg.content}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1 border-t border-current/10 pt-1.5">
                        {msg.actions.map((a, i) => (
                          <span
                            key={i}
                            className="rounded bg-current/10 px-1.5 py-0.5 text-[10px] font-medium"
                          >
                            ✓{" "}
                            {a.type === "addNode"
                              ? `${t("canvas.aiAssistantActionAdd")} ${a.nodeType}`
                              : a.type === "clearCanvas"
                                ? t("canvas.aiAssistantActionClear")
                                : t("canvas.aiAssistantActionConnect")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl rounded-tl-sm bg-muted px-3 py-2">
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {t("canvas.aiAssistantThinking")}
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <Separator />
          <div className="shrink-0 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                className="flex-1 resize-none rounded-lg border bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={t("canvas.aiAssistantInputPlaceholder")}
                rows={2}
                value={input}
                onChange={handleChangeInput}
                onKeyDown={handleKeyDown}
              />
              <Button
                className="h-8 w-8 shrink-0"
                disabled={!input.trim() || isLoading}
                size="icon"
                onClick={handleClickSend}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {t("canvas.aiAssistantSendHint")}
            </p>
          </div>
        </div>
      )}

      {/* Floating bubble button */}
      <button
        className={cn(
          "group relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200",
          isOpen
            ? "bg-primary text-primary-foreground shadow-primary/30"
            : "bg-primary text-primary-foreground hover:scale-110 hover:shadow-xl hover:shadow-primary/30"
        )}
        title={t("canvas.aiAssistantTitle")}
        onClick={handleToggle}
      >
        {/* Pulse ring when closed */}
        {!isOpen && <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />}
        <Bot className={cn("h-6 w-6 transition-transform duration-200", isOpen && "scale-90")} />
      </button>
    </div>
  );
};
