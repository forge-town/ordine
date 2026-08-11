const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

interface BrowserLocation {
  hostname: string;
  origin: string;
}

export const resolveApiBaseUrl = (location?: BrowserLocation) => {
  if (!location || LOCAL_HOSTNAMES.has(location.hostname)) {
    return "http://localhost:9433/api";
  }

  return `${location.origin}/api`;
};
