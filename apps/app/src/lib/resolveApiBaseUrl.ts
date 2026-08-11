interface BrowserLocation {
  hostname: string;
  origin: string;
}

interface ResolveApiBaseUrlOptions {
  explicitBaseUrl?: string;
  isDevelopment?: boolean;
}

const normalizeExplicitBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/\/+$/, "");
const formatHostname = (hostname: string) =>
  hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname;

export const resolveApiBaseUrl = (
  location?: BrowserLocation,
  options?: ResolveApiBaseUrlOptions,
) => {
  const explicitBaseUrl = options?.explicitBaseUrl ?? import.meta.env.VITE_API_BASE_URL;
  const isDevelopment = options?.isDevelopment ?? import.meta.env.DEV;

  if (explicitBaseUrl?.trim()) {
    return normalizeExplicitBaseUrl(explicitBaseUrl);
  }

  if (isDevelopment) {
    if (!location) {
      return "http://localhost:9433/api";
    }

    const protocol = new URL(location.origin).protocol;

    return `${protocol}//${formatHostname(location.hostname)}:9433/api`;
  }

  return location ? `${location.origin}/api` : "/api";
};
