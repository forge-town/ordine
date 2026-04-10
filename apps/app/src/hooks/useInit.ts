import { useRef } from "react";
import { useBeginning } from "./useBeginning";

export const useInit = <T>(initFunc: () => T) => {
  const initItemRef = useRef<T>(useBeginning(initFunc)!);
  return initItemRef.current;
};
