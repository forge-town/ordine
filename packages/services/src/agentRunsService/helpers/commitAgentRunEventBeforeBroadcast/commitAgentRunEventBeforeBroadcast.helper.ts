export const commitAgentRunEventBeforeBroadcast = async <T>(
  persist: () => Promise<T>,
  broadcast: (committed: T) => Promise<void>,
): Promise<T> => {
  const committed = await persist();
  await broadcast(committed);

  return committed;
};
