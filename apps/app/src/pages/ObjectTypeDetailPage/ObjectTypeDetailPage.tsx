import { Route } from "@/routes/_layout/pipelines.objects.$objectTypeId";
import { ObjectTypeDetailPageContent } from "./ObjectTypeDetailPageContent";

export const ObjectTypeDetailPage = () => {
  const { objectTypeId } = Route.useParams();

  return <ObjectTypeDetailPageContent objectTypeId={objectTypeId} />;
};
