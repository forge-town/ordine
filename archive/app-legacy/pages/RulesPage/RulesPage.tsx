import { RulesPageStoreProvider } from "./_store";
import { RulesPageContent } from "./RulesPageContent";

export const RulesPage = () => {
  return (
    <RulesPageStoreProvider>
      <RulesPageContent />
    </RulesPageStoreProvider>
  );
};
