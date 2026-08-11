import { ResultAsync } from "neverthrow";
import { getEnv } from "./integrations/env";

const getBaseUrl = (): string => getEnv().ORDINE_API_URL;

const getHeaders = (): Record<string, string> => {
  const { ORDINE_DESKTOP_AUTH_TOKEN } = getEnv();

  return ORDINE_DESKTOP_AUTH_TOKEN ? { "X-Desktop-Token": ORDINE_DESKTOP_AUTH_TOKEN } : {};
};

interface ApiError {
  ok: false;
  status: number;
  message: string;
}

interface ApiSuccess<T> {
  ok: true;
  data: T;
}

type ApiResult<T> = ApiSuccess<T> | ApiError;

const request = async <T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> => {
  const url = `${getBaseUrl()}${path}`;
  const headers = getHeaders();
  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);

  if (!res.ok) {
    const result = await ResultAsync.fromPromise(res.text(), () => undefined);
    const text = result.unwrapOr("");

    return { ok: false, status: res.status, message: text || res.statusText };
  }

  const data = (await res.json()) as T;

  return { ok: true, data };
};

const requestNoBody = async (method: string, path: string): Promise<ApiResult<void>> => {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, { method, headers: getHeaders() });

  if (!res.ok) {
    const result = await ResultAsync.fromPromise(res.text(), () => undefined);
    const text = result.unwrapOr("");

    return { ok: false, status: res.status, message: text || res.statusText };
  }

  return { ok: true, data: undefined };
};

const requestBytes = async (path: string): Promise<ApiResult<Uint8Array>> => {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, { method: "GET", headers: getHeaders() });

  if (!res.ok) {
    const result = await ResultAsync.fromPromise(res.text(), () => undefined);
    const text = result.unwrapOr("");

    return { ok: false, status: res.status, message: text || res.statusText };
  }

  return { ok: true, data: new Uint8Array(await res.arrayBuffer()) };
};

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  getBytes: (path: string) => requestBytes(path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  del: (path: string) => requestNoBody("DELETE", path),
};
