import { useStore } from "zustand";
import { useHarnessCanvasStore } from "./_store";
import { cn } from "@/lib/cn";
import { Bot, X, Send, Loader2 } from "lucide-react";
import { useState, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export const AiAssistantPanel = () => {
  const store = useHarnessCanvasStore();
  const isAiAssistantOpen = useStore(store, (state) => state.isAiAssistantOpen);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "你好！我是 Harness Studio AI 设计助手。我可以帮你：\n\n• 检查线束设计连接关系\n• 建议最优走线方案\n• 识别潜在的电气冲突\n• 生成 BOM 清单\n\n请告诉我你需要什么帮助？",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleClose = () => {
    store.getState().toggleAiAssistant();
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // TODO: Integrate with Mastra agent API
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-ai`,
        role: "assistant",
        content: `正在分析你的线束设计请求...\n\n针对"${userMessage.content}"，我建议：\n\n1. 检查所有连接器的针脚编号是否正确\n2. 确认导线截面积满足电流需求\n3. 验证接地点布置是否合理\n\n（Mastra AI 服务集成中，请稍候...）`,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  if (!isAiAssistantOpen) return null;

  return (
    <div className="absolute bottom-4 right-4 z-20 flex h-120 w-80 flex-col rounded-xl border border-gray-200 bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-xl border-b border-gray-100 bg-linear-to-r from-blue-500 to-blue-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">AI 设计助手</div>
            <div className="text-[10px] text-blue-100">由 Mastra 驱动</div>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/20 transition-colors"
        >
          <X className="h-4 w-4 text-white" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-line",
                msg.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700",
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2">
              <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
              <span className="text-xs text-gray-500">思考中...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="描述你的设计需求..."
            rows={2}
            className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
              input.trim() && !isLoading
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-gray-100 text-gray-300 cursor-not-allowed",
            )}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-gray-400">
          Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  );
};
