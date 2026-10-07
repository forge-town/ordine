export const formatTimeout = (milliseconds: number): string => {
  const seconds = Math.round(milliseconds / 1000);
  if (seconds % 60 === 0) return `${seconds / 60} minute${seconds === 60 ? "" : "s"}`;

  return `${seconds} seconds`;
};
