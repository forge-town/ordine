import { SkillsPageStoreProvider } from "./_store";
import { SkillsPageContent } from "./SkillsPageContent";

export const SkillsPage = () => {
  return (
    <SkillsPageStoreProvider>
      <SkillsPageContent />
    </SkillsPageStoreProvider>
  );
};
