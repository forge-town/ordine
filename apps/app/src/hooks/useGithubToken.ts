import { useState, useCallback } from "react";
import { Result } from "neverthrow";

const STORAGE_KEY = "github_personal_access_token";

const safeGetItem = Result.fromThrowable(
  (key: string) => localStorage.getItem(key),
  () => null
);

const safeSetItem = Result.fromThrowable(
  (key: string, value: string) => localStorage.setItem(key, value),
  () => undefined
);

const safeRemoveItem = Result.fromThrowable(
  (key: string) => localStorage.removeItem(key),
  () => undefined
);

const readToken = (): string | null => {
  const result = safeGetItem(STORAGE_KEY);

  return result.isOk() ? result.value : null;
};

const writeToken = (token: string | null): void => {
  if (token) {
    safeSetItem(STORAGE_KEY, token);
  } else {
    safeRemoveItem(STORAGE_KEY);
  }
};

export const useGithubToken = () => {
  const [token, setTokenState] = useState<string | null>(readToken);

  const setToken = useCallback((newToken: string | null) => {
    writeToken(newToken);
    setTokenState(newToken);
  }, []);

  const clearToken = useCallback(() => {
    writeToken(null);
    setTokenState(null);
  }, []);

  return { token, setToken, clearToken };
};
