const DEFAULT_BASE_URL = "http://localhost:3000";

const getBaseUrl = (): string => process.env["ORDINE_API_URL"] ?? DEFAULT_BASE_URL;

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
  const headers: Record<string, string> = {};
  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, message: text || res.statusText };
  }

  const data = (await res.json()) as T;
  return { ok: true, data };
};

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
};
