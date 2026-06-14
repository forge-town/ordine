import { useEffect } from "react";
import { countAnchorsByRef, useAgentBarStore } from "./AgentBar/_store";
import { useWorkspaceStore } from "./_store/workspaceStore";

/**
 * 把 AgentBar 消息中的未解决锚点计数镜像进 workspaceStore（G1-03）。
 * canvas 节点徽标只读 workspaceStore.anchorCounts，不再反向依赖 AgentBar 内部 store。
 * 挂载于 WorkspacePage（AgentBar 与 canvas 的共同父级），自身不渲染任何内容。
 */
export const AnchorCountSync = () => {
  const messages = useAgentBarStore((state) => state.messages);
  const setAnchorCounts = useWorkspaceStore((state) => state.setAnchorCounts);

  useEffect(() => {
    setAnchorCounts(countAnchorsByRef(messages));
  }, [messages, setAnchorCounts]);

  return null;
};
