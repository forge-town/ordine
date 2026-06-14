import { describe, expect, it } from "vitest";
import { buildUserActionRequests } from "./userActionRequests";

const t = (message: string, createdAt?: Date) => ({ createdAt, message });

describe("buildUserActionRequests", () => {
  it("attributes requests to the node from the preceding NODE_START marker", () => {
    const requests = buildUserActionRequests([
      t("@@NODE_START::node_pdf"),
      t(
        '@@USER_ACTION::{"kind":"configure-input","message":"请配置输入文件夹","field":"folderPath"}',
      ),
      t("@@NODE_START::node_export"),
      t('@@USER_ACTION::{"kind":"configure-output","message":"请设置导出路径"}'),
    ]);

    expect(requests).toEqual([
      {
        field: "folderPath",
        kind: "configure-input",
        message: "请配置输入文件夹",
        nodeId: "node_pdf",
      },
      { kind: "configure-output", message: "请设置导出路径", nodeId: "node_export" },
    ]);
  });

  it("dedupes same node + kind keeping the latest message", () => {
    const requests = buildUserActionRequests([
      t("@@NODE_START::n1"),
      t('@@USER_ACTION::{"kind":"configure-input","message":"old"}'),
      t('@@USER_ACTION::{"kind":"configure-input","message":"new"}'),
    ]);

    expect(requests).toEqual([{ kind: "configure-input", message: "new", nodeId: "n1" }]);
  });

  it("skips malformed JSON, unknown kinds and empty messages without throwing", () => {
    const requests = buildUserActionRequests([
      t("@@USER_ACTION::{not json"),
      t('@@USER_ACTION::{"kind":"reboot-universe","message":"x"}'),
      t('@@USER_ACTION::{"kind":"provide-info","message":""}'),
      t('@@USER_ACTION::{"kind":"provide-info","message":"需要 API key"}'),
    ]);

    expect(requests).toEqual([{ kind: "provide-info", message: "需要 API key" }]);
  });

  it("finds markers embedded inside multi-line LLM content traces", () => {
    const requests = buildUserActionRequests([
      t("@@NODE_START::n2"),
      t(
        '@@LLM_CONTENT::n2::部分结果...\n@@USER_ACTION::{"kind":"provide-info","message":"缺少 GitHub token"}\n继续输出',
      ),
    ]);

    expect(requests).toEqual([
      { kind: "provide-info", message: "缺少 GitHub token", nodeId: "n2" },
    ]);
  });

  it("normalizes newest-first trace order using createdAt", () => {
    const older = new Date("2026-06-13T00:00:00Z");
    const newer = new Date("2026-06-13T00:01:00Z");
    const requests = buildUserActionRequests([
      t('@@USER_ACTION::{"kind":"configure-input","message":"配置输入"}', newer),
      t("@@NODE_START::n3", older),
    ]);

    expect(requests).toEqual([{ kind: "configure-input", message: "配置输入", nodeId: "n3" }]);
  });
});
