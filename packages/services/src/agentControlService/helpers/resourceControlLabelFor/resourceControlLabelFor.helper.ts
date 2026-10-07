export const labelFor = (value: Record<string, unknown>): string | undefined => {
  const candidate = value.name ?? value.title ?? value.label;

  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
};
