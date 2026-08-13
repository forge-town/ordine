interface BrowserLocation {
  origin: string;
}

interface ResolveApiBaseUrlOptions {
  explicitBaseUrl?: string;
  isDevelopment?: boolean;
}

const normalizeExplicitBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/\/+$/, "");

export const resolveApiBaseUrl = (
  location?: BrowserLocation,
  options?: ResolveApiBaseUrlOptions,
) => {
  const explicitBaseUrl = options?.explicitBaseUrl ?? import.meta.env.VITE_API_BASE_URL;
  const isDevelopment = options?.isDevelopment ?? import.meta.env.DEV;

  if (explicitBaseUrl?.trim()) {
    return normalizeExplicitBaseUrl(explicitBaseUrl);
  }

  if (location) {
    return `${location.origin}/api`;
  }

  return isDevelopment ? "http://localhost:9433/api" : "/api";
};
