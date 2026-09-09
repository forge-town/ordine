import { ResultAsync } from "neverthrow";

type ExecutionSessionProxyOptions = {
  origin: string;
  target?: string;
  transport: "bearer" | "desktop";
  ownerUserId?: string;
  getSessionUserId: (request: Request) => Promise<string | null>;
  readToken: () => Promise<string>;
  fetcher?: typeof fetch;
};

const failure = (status: number, code: string, message: string) =>
  Response.json(
    { error: { code, message, retryable: status === 503, stage: "authentication" } },
    { status, headers: { "Cache-Control": "no-store" } },
  );

/** The browser uses its existing session; the application credential stays on the server. */
export const createExecutionSessionProxy =
  (options: ExecutionSessionProxyOptions) =>
  async (request: Request): Promise<Response> => {
    const authenticated = await ResultAsync.fromPromise(
      options.getSessionUserId(request),
      () => new Error("Session lookup failed"),
    );
    if (authenticated.isErr() || !authenticated.value)
      return failure(401, "UNAUTHORIZED", "请先登录 ORDINE");
    if (!options.ownerUserId)
      return failure(503, "EXECUTION_NOT_CONFIGURED", "执行工作区尚未关联用户");
    if (authenticated.value !== options.ownerUserId)
      return failure(403, "FORBIDDEN", "当前用户无权访问此执行工作区");

    const url = new URL(request.url);
    const mutating = !["GET", "HEAD"].includes(request.method);
    if (
      url.origin !== options.origin ||
      !url.pathname.startsWith("/api/v2/") ||
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (mutating && request.headers.get("origin") !== options.origin)
    )
      return failure(403, "FORBIDDEN", "请求来源无效");
    if (!options.target) return failure(503, "EXECUTION_NOT_CONFIGURED", "执行服务尚未配置");

    const forwarded = await ResultAsync.fromPromise(
      Promise.resolve().then(async () => {
        const target = new URL(options.target!);
        if (
          target.username ||
          target.password ||
          target.search ||
          target.hash ||
          !["http:", "https:"].includes(target.protocol) ||
          (target.protocol === "http:" &&
            !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname))
        )
          throw new Error("Invalid execution target");
        const token = (await options.readToken()).trim();
        if (token.length < 32) throw new Error("Execution credential is unavailable");
        const headers = new Headers();
        for (const name of ["content-type", "accept", "range", "if-range"])
          if (request.headers.has(name)) headers.set(name, request.headers.get(name)!);
        headers.set("X-Ordine-Api-Version", "2");
        headers.set(
          options.transport === "desktop" ? "X-Desktop-Token" : "Authorization",
          options.transport === "desktop" ? token : `Bearer ${token}`,
        );

        return (options.fetcher ?? fetch)(new URL(url.pathname + url.search, target), {
          method: request.method,
          headers,
          redirect: "error",
          signal: request.signal,
          ...(mutating ? { body: request.body, duplex: "half" } : {}),
        } as RequestInit);
      }),
      () => new Error("Execution upstream unavailable"),
    );
    if (forwarded.isErr())
      return failure(503, "EXECUTION_UNAVAILABLE", "执行服务暂时不可用，请稍后重试");
    const upstream = forwarded.value;
    const headers = new Headers();
    for (const name of [
      "content-type",
      "content-range",
      "accept-ranges",
      "etag",
      "content-disposition",
    ])
      if (upstream.headers.has(name)) headers.set(name, upstream.headers.get(name)!);
    headers.set("Cache-Control", "no-store");

    return new Response(upstream.body, { status: upstream.status, headers });
  };
