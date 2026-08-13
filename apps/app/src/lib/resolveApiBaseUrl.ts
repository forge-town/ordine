interface BrowserLocation {
  origin: string;
}

export const resolveApiBaseUrl = (location?: BrowserLocation) => {
  if (!location) {
    return "http://localhost:9433/api";
  }

  return `${location.origin}/api`;
};
