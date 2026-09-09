import { ResultAsync } from "neverthrow";
import type { RunRequestInput, RunRequestReceipt } from "@repo/schemas";

export const contentIdentity = (value: unknown): string =>
  JSON.stringify(value, (_, item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;

    return Object.fromEntries(
      Object.entries(item).sort(([left], [right]) => left.localeCompare(right)),
    );
  });

/** Local snapshots avoid republishing changed drafts; server receipts remain authoritative. */
export const createSubmissionRecovery = (options: {
  lookup: (requestId: string) => Promise<RunRequestReceipt>;
  isNotFound: (error: unknown) => boolean;
  submit: (input: RunRequestInput) => Promise<RunRequestReceipt>;
}) => {
  const attempts = new Map<
    string,
    { identity: string; prepared?: RunRequestInput; inFlight?: Promise<RunRequestReceipt> }
  >();

  return (
    requestId: string,
    intent: unknown,
    prepare: () => Promise<RunRequestInput>,
  ): Promise<RunRequestReceipt> => {
    const identity = contentIdentity(intent);
    const existing = attempts.get(requestId);
    if (existing && existing.identity !== identity)
      return Promise.reject(new Error("同一 requestId 的提交参数不能更改；请先查询原请求。"));
    if (existing?.inFlight) return existing.inFlight;
    const entry = existing ?? { identity };
    attempts.set(requestId, entry);
    const action = async () => {
      const receipt = await ResultAsync.fromPromise(options.lookup(requestId), (error) => error);
      if (receipt.isOk()) return receipt.value;
      if (!options.isNotFound(receipt.error)) throw receipt.error;
      if (!entry.prepared) entry.prepared = structuredClone(await prepare());

      // An explicit retry after a confirmed 404 uses exactly the original body/ID.
      const submitted = await options.submit(structuredClone(entry.prepared));
      if (submitted.requestId !== requestId)
        throw new Error("执行服务返回了其他 requestId 的回执。");

      return submitted;
    };
    entry.inFlight = ResultAsync.fromPromise(action(), (error) => error).match(
      (receipt) => {
        entry.inFlight = undefined;

        return receipt;
      },
      (error) => {
        entry.inFlight = undefined;
        if (!entry.prepared) attempts.delete(requestId);
        throw error;
      },
    );

    return entry.inFlight;
  };
};
