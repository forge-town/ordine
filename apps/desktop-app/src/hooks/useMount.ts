import { useEffect } from "react";

export const useMount = (callback: () => void | (() => void)) => {
  useEffect(() => {
    return callback();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
