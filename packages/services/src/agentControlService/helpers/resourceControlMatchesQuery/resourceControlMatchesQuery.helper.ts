export const matchesQuery = (value: Record<string, unknown>, query: string): boolean => {
  if (query === "*") return true;
  const haystack = [value.id, value.name, value.title, value.label, value.description]
    .filter((entry): entry is string => typeof entry === "string")
    .join("\n")
    .toLocaleLowerCase();

  return haystack.includes(query.toLocaleLowerCase());
};
