export const appendZodPath = (prefix: string, segments: PropertyKey[]): string =>
  segments.reduce<string>(
    (path, segment) =>
      typeof segment === "number" ? `${path}[${segment}]` : `${path}.${String(segment)}`,
    prefix,
  );
