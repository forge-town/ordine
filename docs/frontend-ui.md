# Ordine 前端视觉规范

本文档约束 Ordine 应用内页面布局与内容卡片。目标是让不同功能页面共享同一套层级、间距和交互反馈，而不是在页面内重复拼接 Tailwind class。

## 组件基础

Ordine 使用本地维护的 shadcn/ui 风格组件：

- 通用组件位于 `packages/ui/src`。
- 页面级复合组件位于 `packages/views/src/components`。
- 交互原语主要基于 `@base-ui/react`。
- 样式使用 Tailwind CSS 与语义 token，禁止为页面卡片硬编码颜色或 box-shadow。

## Animate UI 适配层

Overlay 动效组件（Dialog、Sheet、Popover、Tooltip、Dropdown Menu、Context
Menu、Select）统一从 `@repo/ui` 导出。它们参考
[Animate UI](https://animate-ui.com) 的 shadcn 适配源码，但保留 Ordine 当前
`@base-ui/react` 原语、公共 API 和 Web/Desktop 共享路径；不得在应用目录直接运行
Animate UI Registry 的 `add` 命令，也不得引入 `@base-ui-components/react`、Radix
或 Headless UI 的第二套原语栈。

动效只使用 `opacity`、`transform` 和必要的 Motion layout projection：Dialog
内容 `scale(0.96)` / 150-25 spring，Popover `scale(0.95)` / 300-25 spring，
Tooltip 125ms，菜单 200ms，Sheet 使用 150-22 spring 从侧边进入，Select 对齐
触发器时只淡入。组件通过 `UiMotionProvider` 的 `LazyMotion + domMax + m` 加载，
并由 `MotionConfig reducedMotion="user"` 在减少动效偏好下保留 opacity、移除
位移和缩放。

上游审查基线、Registry 依赖和本地文件 hash 记录在
`packages/ui/animate-ui.registry.json`。修改适配源码后先运行：

```sh
bun run ui:animate:inspect
```

该命令默认校验固定上游提交、工作区 hash 和原语导入；离线环境可使用
`bun run ui:animate:inspect -- --offline`，但 PR 必须附带一次在线校验结果。

上游 Registry 变更必须先在临时目录审查，例如：

```sh
mkdir -p "$TMPDIR/ordine-animate-review"
cd "$TMPDIR/ordine-animate-review"
bunx --bun shadcn@4.5.0 view @animate-ui/primitives-base-dialog
```

如需验证 `add` 的生成结果，也只能写入该临时目录，再人工迁移并重新运行
`ui:animate:inspect`；禁止直接把 Registry `add` 写入应用或 `packages/ui/src`。

页面卡片统一使用 `@repo/ui/card` 导出的 `Card` 或 `surfaceCardVariants`：

```tsx
import { Card, surfaceCardVariants } from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";

// 普通 div 容器
<Card className="p-5" variant="surface">
  {children}
</Card>

// 需要保留 article、section、Link 等语义元素
<article
  className={cn(surfaceCardVariants({ interactive: true }), "p-3.5")}
>
  {children}
</article>
```

## 页面卡片

`surface` 是应用页面的标准卡片外壳：

```text
rounded-lg bg-surface shadow-soft ring-1 ring-border
```

统一规则：

| 场景                   | 内边距         | 交互                       |
| ---------------------- | -------------- | -------------------------- |
| 重复内容卡片           | `p-3.5`        | 可点击时启用 `interactive` |
| 信息较多的复杂卡片     | `p-4`          | 可点击时启用 `interactive` |
| 图表、分析、详情主面板 | `p-5`          | 通常不浮起                 |
| 表格、日历外壳         | 无整体 padding | 行或单元格自己控制间距     |

交互卡片统一由 `interactive` 提供：

```text
hover:shadow-float hover:ring-border-strong
```

不要在页面中另写 `hover:shadow-sm`、`hover:shadow-md` 或自定义边框颜色。

## 页面间距

标准可滚动内容区：

```text
min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-7
```

- 页面工具栏水平间距使用 `px-4 sm:px-7`。
- 重复卡片网格使用 `gap-3`。
- 分析模块之间使用 `gap-5` 或 `space-y-5`。
- 不再为常规页面内容区使用无响应式的 `p-6`。

## 内部层级

卡片内部的代码、空状态或辅助信息区域不是第二张卡片，统一使用：

```text
rounded-lg bg-surface-2
```

内部区域不加 `shadow-soft`，避免卡片套卡片形成多重悬浮层级。分隔内容优先使用 `border-border/70`。

## 例外

以下元素不使用页面卡片规范：

- 设置页中的表单分组和字段边界。
- 画布节点、浮动工具栏、弹窗、Popover 和 Drawer。
- 普通列表行、导航项、筛选按钮和输入框。
- 仅为布局存在、没有独立内容语义的容器。

这些元素应使用各自的 shadcn/Base UI 组件和交互规范。不要为了视觉统一把所有带边框的容器都改成卡片。

## 开发检查

- 优先复用 `Card`，需要其他 HTML 语义时复用 `surfaceCardVariants`。
- 卡片必须有 `shadow-soft`；浮层才使用 `shadow-float` 作为静态阴影。
- 同一网格中的卡片必须使用相同圆角、阴影、ring 和 padding 档位。
- 新页面需要检查桌面和窄屏，确认页面边距、卡片间距与文字没有溢出。
- 视觉变更提交 PR 时附桌面与窄屏截图。
