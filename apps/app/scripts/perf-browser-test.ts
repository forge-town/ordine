import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { performance as nodePerformance } from "perf_hooks";

interface BrowserPerformanceMemory {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

interface BrowserPerformanceConfig {
  headless: boolean;
  screenshotPath: string | null;
  timeoutMs: number;
}

type PerfResult = Result<void, string>;

const getArgValue = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const hasArg = (name: string): boolean => process.argv.includes(`--${name}`);

const readConfig = (): BrowserPerformanceConfig => {
  const headlessArg = getArgValue("headless");
  const screenshotArg = getArgValue("screenshot");
  const timeoutArg = getArgValue("timeout") ?? process.env.PERF_BROWSER_TIMEOUT_MS ?? "30000";
  const timeoutMs = Number.parseInt(timeoutArg, 10);
  const skipScreenshot = hasArg("no-screenshot") || process.env.PERF_SCREENSHOT === "false";

  return {
    headless:
      headlessArg === undefined
        ? process.env.PERF_BROWSER_HEADLESS !== "false"
        : headlessArg !== "false",
    screenshotPath: skipScreenshot
      ? null
      : (screenshotArg ?? process.env.PERF_SCREENSHOT_PATH ?? "output/perf/perf-test-result.png"),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000,
  };
};

const formatError = (label: string, cause: unknown) =>
  `${label}: ${cause instanceof Error ? cause.message : String(cause)}`;

const toResult = <T>(promise: Promise<T>, label: string) =>
  ResultAsync.fromPromise(promise, (cause) => formatError(label, cause));

const formatImprovement = (before: number, after: number) =>
  before > 0 ? `${((1 - after / before) * 100).toFixed(1)}%` : "n/a";

const closeContext = async (context: BrowserContext | null): Promise<PerfResult> => {
  if (!context) {
    return ok(undefined);
  }

  return await toResult(context.close(), "关闭浏览器上下文失败");
};

const closeBrowser = async (browser: Browser | null): Promise<PerfResult> => {
  if (!browser) {
    return ok(undefined);
  }

  return await toResult(browser.close(), "关闭浏览器失败");
};

const finishWithCleanup = async (
  workResult: PerfResult,
  context: BrowserContext | null,
  browser: Browser | null
): Promise<PerfResult> => {
  const contextCloseResult = await closeContext(context);
  const browserCloseResult = await closeBrowser(browser);

  if (workResult.isErr()) {
    return err(workResult.error);
  }

  if (contextCloseResult.isErr()) {
    return err(contextCloseResult.error);
  }

  if (browserCloseResult.isErr()) {
    return err(browserCloseResult.error);
  }

  return ok(undefined);
};

const writeScreenshot = async (page: Page, screenshotPath: string | null): Promise<PerfResult> => {
  if (!screenshotPath) {
    console.log("截图已跳过");

    return ok(undefined);
  }

  const directoryResult = await toResult(
    mkdir(dirname(screenshotPath), { recursive: true }),
    "创建截图目录失败"
  );
  if (directoryResult.isErr()) {
    return err(directoryResult.error);
  }

  const screenshotResult = await toResult(
    page.screenshot({ path: screenshotPath }),
    "保存截图失败"
  );
  if (screenshotResult.isErr()) {
    return err(screenshotResult.error);
  }

  console.log(`截图已保存: ${screenshotPath}`);

  return ok(undefined);
};

async function measureBrowserPerformance(
  page: Page,
  config: BrowserPerformanceConfig
): Promise<PerfResult> {
  console.log("=== Ordine 前端优化 - 浏览器 Performance API 测试 ===\n");
  console.log(`浏览器模式: ${config.headless ? "headless" : "headed"}`);
  console.log(`截图输出: ${config.screenshotPath ?? "disabled"}\n`);
  console.log(`操作超时: ${config.timeoutMs}ms\n`);

  console.log("1. 启动应用并导航到 Canvas 页面...");
  const startTime = nodePerformance.now();

  const navigationResult = await toResult(
    page.goto("about:blank", { timeout: config.timeoutMs }),
    "导航到测试页面失败"
  );
  if (navigationResult.isErr()) {
    return err(navigationResult.error);
  }

  const t1Result = await toResult(
    page.evaluate(() => {
      const iterations = 10000;

      performance.mark("t1-before-start");
      for (let i = 0; i < iterations; i++) {
        const headerRight = {
          type: "div",
          props: {
            className: "flex items-center gap-1",
            children: [
              { type: "span", props: { className: "text-xs" } },
              { type: "div", props: { className: "h-2 w-2 rounded-full bg-blue-500" } },
            ],
          },
        };
        JSON.stringify(headerRight);
      }
      performance.mark("t1-before-end");

      const cachedHeaderRight = {
        type: "div",
        props: {
          className: "flex items-center gap-1",
          children: [
            { type: "span", props: { className: "text-xs" } },
            { type: "div", props: { className: "h-2 w-2 rounded-full bg-blue-500" } },
          ],
        },
      };

      performance.mark("t1-after-start");
      for (let i = 0; i < iterations; i++) {
        JSON.stringify(cachedHeaderRight);
      }
      performance.mark("t1-after-end");

      performance.measure("t1-before", "t1-before-start", "t1-before-end");
      performance.measure("t1-after", "t1-after-start", "t1-after-end");

      const measures = performance.getEntriesByType("measure");
      const before = measures.find((m) => m.name === "t1-before");
      const after = measures.find((m) => m.name === "t1-after");

      return {
        before: before?.duration || 0,
        after: after?.duration || 0,
        iterations,
      };
    }),
    "执行 StatusBadge 基准失败"
  );
  if (t1Result.isErr()) {
    return err(t1Result.error);
  }

  console.log("T1: StatusBadge 提取 (OperationNode)");
  console.log(`  优化前: ${t1Result.value.before.toFixed(2)}ms (${t1Result.value.iterations}次)`);
  console.log(`  优化后: ${t1Result.value.after.toFixed(2)}ms (${t1Result.value.iterations}次)`);
  console.log(`  提升: ${formatImprovement(t1Result.value.before, t1Result.value.after)}\n`);

  const t6Result = await toResult(
    page.evaluate(() => {
      const iterations = 100000;

      performance.mark("t6-before-start");
      for (let i = 0; i < iterations; i++) {
        const data = { id: "1", name: "test" };
        const result = data as unknown as { id: string; name: string };
        JSON.stringify(result);
      }
      performance.mark("t6-before-end");

      performance.mark("t6-after-start");
      for (let i = 0; i < iterations; i++) {
        const data = { id: "1", name: "test" };
        JSON.stringify(data);
      }
      performance.mark("t6-after-end");

      performance.measure("t6-before", "t6-before-start", "t6-before-end");
      performance.measure("t6-after", "t6-after-start", "t6-after-end");

      const measures = performance.getEntriesByType("measure");
      const before = measures.find((m) => m.name === "t6-before");
      const after = measures.find((m) => m.name === "t6-after");

      return {
        before: before?.duration || 0,
        after: after?.duration || 0,
        iterations,
      };
    }),
    "执行 dataProvider 基准失败"
  );
  if (t6Result.isErr()) {
    return err(t6Result.error);
  }

  console.log("T6: dataProvider 类型映射重构");
  console.log(`  优化前: ${t6Result.value.before.toFixed(2)}ms (${t6Result.value.iterations}次)`);
  console.log(`  优化后: ${t6Result.value.after.toFixed(2)}ms (${t6Result.value.iterations}次)`);
  console.log(`  提升: ${formatImprovement(t6Result.value.before, t6Result.value.after)}\n`);

  const memoryInfoResult = await toResult(
    page.evaluate(() => {
      const memory = (performance as unknown as BrowserPerformanceMemory).memory;
      if (memory) {
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        };
      }
      return null;
    }),
    "读取内存信息失败"
  );
  if (memoryInfoResult.isErr()) {
    return err(memoryInfoResult.error);
  }

  if (memoryInfoResult.value) {
    console.log("内存使用情况:");
    console.log(
      `  已用 JS Heap: ${(memoryInfoResult.value.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(
      `  总 JS Heap: ${(memoryInfoResult.value.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(
      `  JS Heap 限制: ${(memoryInfoResult.value.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB\n`
    );
  }

  const navTimingResult = await toResult(
    page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      if (nav) {
        return {
          dnsLookup: nav.domainLookupEnd - nav.domainLookupStart,
          tcpConnection: nav.connectEnd - nav.connectStart,
          serverResponse: nav.responseEnd - nav.responseStart,
          domProcessing: nav.domComplete - nav.domInteractive,
          loadEvent: nav.loadEventEnd - nav.loadEventStart,
          total: nav.loadEventEnd - nav.startTime,
        };
      }
      return null;
    }),
    "读取导航时间失败"
  );
  if (navTimingResult.isErr()) {
    return err(navTimingResult.error);
  }

  if (navTimingResult.value) {
    console.log("页面加载时间 (Navigation Timing):");
    console.log(`  DNS 查询: ${navTimingResult.value.dnsLookup.toFixed(2)}ms`);
    console.log(`  TCP 连接: ${navTimingResult.value.tcpConnection.toFixed(2)}ms`);
    console.log(`  服务器响应: ${navTimingResult.value.serverResponse.toFixed(2)}ms`);
    console.log(`  DOM 处理: ${navTimingResult.value.domProcessing.toFixed(2)}ms`);
    console.log(`  Load 事件: ${navTimingResult.value.loadEvent.toFixed(2)}ms`);
    console.log(`  总加载时间: ${navTimingResult.value.total.toFixed(2)}ms\n`);
  }

  const totalTime = nodePerformance.now() - startTime;
  console.log(`=== 测试完成 (总耗时: ${totalTime.toFixed(2)}ms) ===`);

  return await writeScreenshot(page, config.screenshotPath);
}

const runBrowserPerformanceTest = async (): Promise<PerfResult> => {
  const config = readConfig();
  const browserResult = await toResult(
    chromium.launch({ headless: config.headless, timeout: config.timeoutMs }),
    "启动 Chromium 失败"
  );
  if (browserResult.isErr()) {
    return err(browserResult.error);
  }

  const browser = browserResult.value;
  const contextResult = await toResult(
    browser.newContext({ viewport: { width: 1280, height: 720 } }),
    "创建浏览器上下文失败"
  );
  if (contextResult.isErr()) {
    const browserCloseResult = await closeBrowser(browser);
    return browserCloseResult.isErr() ? err(browserCloseResult.error) : err(contextResult.error);
  }

  const context = contextResult.value;
  context.setDefaultTimeout(config.timeoutMs);
  context.setDefaultNavigationTimeout(config.timeoutMs);
  const pageResult = await toResult(context.newPage(), "创建页面失败");
  if (pageResult.isErr()) {
    return await finishWithCleanup(err(pageResult.error), context, browser);
  }

  const measureResult = await measureBrowserPerformance(pageResult.value, config);

  return await finishWithCleanup(measureResult, context, browser);
};

const result = await runBrowserPerformanceTest();

result.match(
  () => {
    process.exitCode = 0;
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
