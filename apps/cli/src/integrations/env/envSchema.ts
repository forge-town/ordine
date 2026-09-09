import { z } from "zod/v4";
import { Result } from "neverthrow";

const isSafeApiUrl = (value: string): boolean => {
  const parsed = Result.fromThrowable(
    () => new URL(value),
    () => undefined,
  )();
  if (parsed.isErr()) return false;
  const url = parsed.value;
  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(url.hostname);

  return (
    value === value.trim() &&
    !value.includes("?") &&
    !value.includes("#") &&
    !url.username &&
    !url.password &&
    (url.protocol === "https:" || (url.protocol === "http:" && loopback))
  );
};

export const envSchema = z.object({
  ORDINE_API_URL: z
    .string()
    .refine(isSafeApiUrl, "Invalid API endpoint")
    .default("http://localhost:19433"),
  ORDINE_AUTH_MODE: z.enum(["bearer", "desktop"]).default("bearer"),
  ORDINE_AGENT_API_TOKEN: z.string().optional(),
  ORDINE_AGENT_API_TOKEN_FILE: z.string().optional(),
  ORDINE_DESKTOP_AUTH_TOKEN: z.string().optional(),
  ORDINE_DESKTOP_AUTH_TOKEN_FILE: z.string().optional(),
});
