import { useEffect, useState } from "react";
import { dataProvider } from "@/integrations/refine/dataProvider";

/**
 * N15-01：请求期间轮询服务端真实阶段（thinking → analyzing? → drafting → validating）。
 * 自 useAgentConversation 抽出的自包含副作用（H2-01）：传入 progressToken，返回当前 stage。
 */
export const useProposeProgress = (progressToken: string | null): string | null => {
  const [progressStage, setProgressStage] = useState<string | null>(null);

  useEffect(() => {
    if (!progressToken) {
      setProgressStage(null);

      return;
    }

    const intervalId = globalThis.setInterval(() => {
      void dataProvider.custom!<{ stage: string | null }>({
        method: "post",
        payload: { token: progressToken },
        url: "pipelines/proposeProgress",
      })
        .then((response) => {
          if (response.data.stage) {
            setProgressStage(response.data.stage);
          }
        })
        .catch(() => undefined);
    }, 700);

    return () => globalThis.clearInterval(intervalId);
  }, [progressToken]);

  return progressStage;
};
