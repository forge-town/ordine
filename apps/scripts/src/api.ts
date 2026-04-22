/**
 * REST API client for seed scripts.
 *
 * All seed scripts communicate with the app's REST API instead of
 * hitting the database directly.
 */

const BASE_URL = process.env["API_BASE_URL"] ?? "http://localhost:9430";

interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

const request = async <T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> => {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data: T = (() => {
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  })();

  return { ok: res.ok, status: res.status, data };
};

export const apiGet = async <T>(path: string): Promise<T> => {
  const result = await request<T>("GET", path);
  if (!result.ok)
    throw new Error(`GET ${path} failed (${result.status}): ${JSON.stringify(result.data)}`);

  return result.data;
};

export const apiPost = async <T>(path: string, body: unknown): Promise<T> => {
  const result = await request<T>("POST", path, body);
  if (!result.ok)
    throw new Error(`POST ${path} failed (${result.status}): ${JSON.stringify(result.data)}`);

  return result.data;
};

/**
 * PUT = upsert: creates if not found, updates if exists.
 */
export const apiPut = async <T>(path: string, body: unknown): Promise<T> => {
  const result = await request<T>("PUT", path, body);
  if (!result.ok)
    throw new Error(`PUT ${path} failed (${result.status}): ${JSON.stringify(result.data)}`);

  return result.data;
};

export const apiDelete = async (path: string): Promise<void> => {
  const result = await request<void>("DELETE", path);
  if (!result.ok && result.status !== 404) {
    throw new Error(`DELETE ${path} failed (${result.status}): ${JSON.stringify(result.data)}`);
  }
};
