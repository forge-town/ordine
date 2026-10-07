export const MAX_SNAPSHOT_CHARS = 20_000;

export const truncate = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max)}\n... (truncated)`;
