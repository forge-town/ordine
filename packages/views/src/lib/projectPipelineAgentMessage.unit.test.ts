import { describe, expect, it } from "vitest";
import { projectPipelineAgentMessage } from "./projectPipelineAgentMessage";

describe("projectPipelineAgentMessage", () => {
  it("projects structured progress JSON to readable progress", () => {
    expect(
      projectPipelineAgentMessage('{"status":"planning","message":"正在分析 Pipeline 上下文"}'),
    ).toEqual({ type: "progress", message: "正在分析 Pipeline 上下文" });
  });

  it("projects a proposal to its safe human-readable preview", () => {
    expect(
      projectPipelineAgentMessage(
        '{"type":"proposal","proposal":{"mode":"generate","purpose":"创建地理试卷"}}',
      ),
    ).toEqual({ type: "assistant_chunk", text: "创建地理试卷" });
  });

  it("suppresses recognized protocol-only completion metadata", () => {
    expect(
      projectPipelineAgentMessage('{"status":"completed","pipelineId":"pipeline-1"}'),
    ).toBeNull();
  });

  it("leaves ordinary text and unrelated JSON untouched", () => {
    expect(projectPipelineAgentMessage("正常消息")).toBeUndefined();
    expect(projectPipelineAgentMessage('{"example":true}')).toBeUndefined();
  });
});
