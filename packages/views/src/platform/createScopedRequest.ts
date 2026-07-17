import type { PlatformCapabilities } from "./PlatformContext";

interface ScopedRequestOptions {
  baseUrl: string;
  getHeaders: () => HeadersInit;
  request?: PlatformCapabilities["request"];
}

export const createScopedRequest = ({
  baseUrl,
  getHeaders,
  request = (input, init) => globalThis.fetch(input, init),
}: ScopedRequestOptions): PlatformCapabilities["request"] => {
  return (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url !== baseUrl && !url.startsWith(`${baseUrl}/`)) {
      return request(input, init);
    }

    const headers = new Headers(init?.headers);
    new Headers(getHeaders()).forEach((value, key) => headers.set(key, value));

    return request(input, { ...init, headers });
  };
};
