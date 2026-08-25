import { CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../../components/PageHeader";
import { PageState } from "../../../components/PageState";

export const SchedulePageContent = () => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        icon={<CalendarClock className="h-4 w-4 text-primary" />}
        sub={t("schedule.subtitle")}
        title={t("schedule.title")}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        <PageState
          description={t("schedule.emptyDescription")}
          icon={<CalendarClock />}
          title={t("schedule.emptyTitle")}
        />
      </div>
    </div>
  );
};
