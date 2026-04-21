import { useParams } from "@tanstack/react-router";
import { pluginRegistry } from "@repo/plugin";
import { Puzzle } from "lucide-react";

export const ObjectTypePage = () => {
  const { objectTypeId } = useParams({ from: "/_layout/objects/$objectTypeId" });
  const objectType = pluginRegistry.getObjectType(objectTypeId);

  if (!objectType) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Object type &quot;{objectTypeId}&quot; not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-4">
        <Puzzle className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">{objectType.label}</h1>
      </header>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <Puzzle className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p className="text-sm">
            This is the <strong>{objectType.label}</strong> object type page.
          </p>
          <p className="mt-1 text-xs">
            Contributed by plugin: <code>{objectType.id}</code>
          </p>
        </div>
      </div>
    </div>
  );
};
