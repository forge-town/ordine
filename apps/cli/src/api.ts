import { ResultAsync } from "neverthrow";
import { readFile } from "node:fs/promises";
import { getEnv } from "./integrations/env";

const getBaseUrl = (): string => getEnv().ORDINE_API_URL;

const getHeaders = async (): Promise<Record<string, string>> => {
  const { ORDINE_DESKTOP_AUTH_TOKEN, ORDINE_DESKTOP_AUTH_TOKEN_FILE } = getEnv();
  const tokenFromFile = ORDINE_DESKTOP_AUTH_TOKEN_FILE
    ? await ResultAsync.fromPromise(
        readFile(ORDINE_DESKTOP_AUTH_TOKEN_FILE, "utf8"),
        () => undefined,
      )
    : null;
  const token = tokenFromFile?.isOk() ? tokenFromFile.value.trim() : ORDINE_DESKTOP_AUTH_TOKEN;

  return token ? { "X-Desktop-Token": token } : {};
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
  const headers = await getHeaders();
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
  const res = await fetch(url, { method, headers: await getHeaders() });

  if (!res.ok) {
    const result = await ResultAsync.fromPromise(res.text(), () => undefined);
    const text = result.unwrapOr("");

    return { ok: false, status: res.status, message: text || res.statusText };
  }

  return { ok: true, data: undefined };
};

const requestBytes = async (path: string): Promise<ApiResult<Uint8Array>> => {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, { method: "GET", headers: await getHeaders() });

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
