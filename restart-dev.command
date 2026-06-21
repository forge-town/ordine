#!/bin/zsh
# 一键重启 Ordine dev server（杀掉 9430 旧进程后以本地模式启动）
cd "$(dirname "$0")"
echo "[restart-dev] killing process on :9430 ..."
lsof -ti:9430 | xargs kill -9 2>/dev/null
sleep 1
export PATH="$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
# 只起 app（vite :9430）。根 `turbo run dev` 会连带跑 @ordine/cli、@ordine/create
# 两个一次性 CLI（bun src/index.ts → 打印 help 后 exit 1），turbo 视为持久任务失败、
# 整窝 dev 被一起拉崩（实测 connection refused 的真因）。--filter 锁定到 app 即可。
echo "[restart-dev] starting ORDINE_LOCAL_MODE=true bun run dev --filter=@ordine/app ..."
ORDINE_LOCAL_MODE=true bun run dev --filter=@ordine/app
