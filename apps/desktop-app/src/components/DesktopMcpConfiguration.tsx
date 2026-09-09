import { useState } from "react";
import { ResultAsync } from "neverthrow";
import { Button } from "@repo/ui/button";
import { readMcpConfiguration } from "../integrations/sidecar/server";

export const DesktopMcpConfiguration = () => {
  const [notice, setNotice] = useState("");
  const handleCopyMcp = () => {
    void readMcpConfiguration()
      .andThen((configuration) =>
        ResultAsync.fromPromise(
          navigator.clipboard.writeText(JSON.stringify(configuration, null, 2)),
          () => new Error("无法复制到剪贴板。"),
        ),
      )
      .match(
        () => setNotice("MCP 配置已复制，使用独立 Agent 凭据。"),
        (error) => setNotice(error.message),
      );
  };

  return (
    <section
      aria-label="Native MCP 配置"
      className="flex flex-wrap items-center justify-end gap-3 border-b border-border px-5 py-3"
    >
      <span className="text-xs text-muted-foreground" role="status">
        {notice}
      </span>
      <Button size="sm" variant="outline" onClick={handleCopyMcp}>
        复制 MCP 配置
      </Button>
    </section>
  );
};
