import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    // PGlite 迁移测试在 CI 共享 runner 上初始化+跑全量迁移链需要 6-10s,
    // 默认 5s 超时必挂(此前被 typecheck 失败掩盖,未暴露)。
    testTimeout: 30_000,
  },
});
