import { useState, useCallback } from "react";

const STORAGE_KEY = "github_personal_access_token";

const readToken = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeToken = (token: string | null): void => {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // storage not available
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
