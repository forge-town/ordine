import { useOne } from "@refinedev/core";
import { ResourceName } from "../../constants";
import type { SkillAnalysisResult } from "@repo/schemas";

export const useAnalyzeSkill = (skillId: string | null, enabled: boolean) => {
  return useOne<SkillAnalysisResult>({
    resource: ResourceName.skillAnalyses,
    id: skillId ?? "",
    queryOptions: {
      enabled: enabled && !!skillId,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  });
};
