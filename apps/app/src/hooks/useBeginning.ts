import { useRef } from "react";

export const useBeginning = <T>(cb?: () => T) => {
  const flag = useRef(false);
  if (flag.current) return;
  flag.current = true;

  return cb?.();
};
