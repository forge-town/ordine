import { CircleAlert, MessageSquarePlus, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Icon } from "../../../../components/primitives";

export type UserActionRequest = {
  field?: string;
  kind: string;
  message: string;
  nodeId?: string;
};

export type UserActionCardProps = {
  /** nodeId → 画布节点名，用于可读展示。 */
  nodeLabelById?: Record<string, string>;
  requests: UserActionRequest[];
  /** 把请求转给 Agent 处理（回填 composer）。 */
  onAskAgent: (request: UserActionRequest) => void;
  /** 打开对应节点的配置面板。 */
  onOpenConfig: (nodeId: string) => void;
};

/**
 * N17-03b：执行器运行期发出的"需要用户补充"请求（@@USER_ACTION 协议）。
 * 极简左边框列表 + 行内动作，与 ProposalCard/ProgressList 同视觉。
 */
export const UserActionCard = ({
  nodeLabelById = {},
  onAskAgent,
  onOpenConfig,
  requests,
}: UserActionCardProps) => {
  const { t } = useTranslation();

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5" data-testid="agent-user-action">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/85">
        <Icon className="text-warning" icon={CircleAlert} size={11} />
        {t("canvas.agentPanel.userAction.title", { count: requests.length })}
      </div>
      <div className="space-y-2 border-l border-border pl-3">
        {requests.map((request) => {
          const nodeLabel = request.nodeId
            ? (nodeLabelById[request.nodeId] ?? request.nodeId)
            : undefined;
          const handleOpenConfigClick = () => request.nodeId && onOpenConfig(request.nodeId);
          const handleAskAgentClick = () => onAskAgent(request);

          return (
            <div
              key={`${request.nodeId ?? ""}:${request.kind}`}
              className="space-y-1"
              data-testid="agent-user-action-item"
            >
              <div className="text-[11.5px] leading-relaxed text-foreground/90">
                {nodeLabel ? (
                  <span className="mr-1 rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground ring-1 ring-border">
                    {nodeLabel}
                  </span>
                ) : null}
                {request.message}
              </div>
              <div className="flex items-center gap-1.5">
                {request.nodeId ? (
                  <Button
                    className="h-6 rounded-lg px-2 text-[11px]"
                    data-testid="agent-user-action-config"
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={handleOpenConfigClick}
                  >
                    <Settings2 className="size-3" />
                    {t("canvas.agentPanel.userAction.openConfig")}
                  </Button>
                ) : null}
                <Button
                  className="h-6 rounded-lg px-2 text-[11px] text-muted-foreground"
                  data-testid="agent-user-action-ask"
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={handleAskAgentClick}
                >
                  <MessageSquarePlus className="size-3" />
                  {t("canvas.agentPanel.userAction.askAgent")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
