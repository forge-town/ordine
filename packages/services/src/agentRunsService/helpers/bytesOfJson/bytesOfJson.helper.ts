export const bytesOfJson = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value) ?? "").byteLength;
