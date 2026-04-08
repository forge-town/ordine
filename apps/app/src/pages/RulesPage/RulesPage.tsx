import { useLoaderData } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { RulesPageContent } from "./RulesPageContent/RulesPageContent";
import type { RuleEntity } from "@/models/daos/rulesDao";

export const RulesPage = () => {
  const rules = useLoaderData({ from: "/rules" }) as RuleEntity[];
  return (
    <AppLayout>
      <RulesPageContent rules={rules} />
    </AppLayout>
  );
};
