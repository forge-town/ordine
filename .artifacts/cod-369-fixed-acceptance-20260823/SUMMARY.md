# COD-369 修复后 Windows 验收

日期：2026-08-23

修复提交：`13e0aa70`

## 修复内容

- 持久化前正确脱敏独立 `sk-*` 与常见 GitHub 凭据。
- OpenCode 子进程的 `cwd`、`PWD`、`INIT_CWD` 使用同一个 Agent Run 工作目录。
- Windows 真实验收比较非空 UTF-8 行，不再把文件末尾换行当作 Agent 能力。

## 主线程真实运行

- 测试：`agentRunsService.windows.integration.test.ts`
- 结果：1 个测试文件通过，4 项测试通过，退出码 0。
- Codex 0.149.0、Claude Code 2.1.207、OpenCode 1.18.21 均完成首轮写文件、原生续跑和取消。
- 三者首轮与续跑均复用原生 session；完成态包含 usage、工具事件和 terminal。
- 9 次运行均标记进程树已清理；验收后 9 个记录 PID 全部不存在。
- 三个文件均位于各自记录的绝对 cwd，内容和 SHA-256 匹配。

脱敏明细：`runtime/acceptance.json`

## Luna 独立复核

- 只读代码审查确认三处修复正确，未发现 P0/P1 回归。
- 独立 Luna 使用新的证据目录再次真实调用三种客户端。
- 结果同样为 1 个测试文件、4 项测试全部通过，退出码 0；9 个记录 PID 全部不存在。

脱敏明细：`../cod-369-luna-fixed-review-20260823/runtime/acceptance.json`

## MCP 真实验收

- 三个客户端均完成安装、状态探测、命令启动、`initialize`、`tools/list`、安全 `ordine.list_jobs` 调用和卸载。
- 每个客户端列出 21 个工具；动态令牌文件未写入报告，临时服务与端口已清理。

脱敏明细：`../cod-369-luna-review-20260823/mcp/mcp-acceptance.json`
