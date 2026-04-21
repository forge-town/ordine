# 对象

**对象** 是流水线操作的目标 — 在图中流动的输入。

## 对象类型

### 文件夹 (Folder)

目录树。流水线读取指定路径下的所有文件，并将其内容传递给下游。

```json
{
  "type": "folder",
  "data": { "path": "./src" }
}
```

使用场景：
- 扫描整个项目目录
- 处理匹配特定模式的所有文件
- 将代码库提供给 AI agent 进行审查

### 代码文件 (Code File)

单个源文件。当你想针对特定文件进行处理时使用。

```json
{
  "type": "code-file",
  "data": { "path": "./src/index.ts" }
}
```

使用场景：
- 分析单个配置文件
- 处理特定模块
- 针对已知问题文件

### GitHub 项目 (GitHub Project)

GitHub 仓库。流水线克隆或引用仓库，并将其内容传递给下游。

```json
{
  "type": "github-project",
  "data": { "owner": "forge-town", "repo": "ordine" }
}
```

使用场景：
- 审查外部仓库
- 跨项目分析
- 依赖审计

## 对象如何流动

对象是流水线 DAG 中的源节点。它们没有入边 — 只有出边。其内容被打包为 `NodeCtx` 并流向下游操作：

```
[folder: ./src] ──► [operation: review] ──► [output: ./results]
```

多个对象可以输入同一个操作，它们的内容在处理前会被合并。

## 自定义对象（通过插件）

插件可以引入新的对象类型。例如，文档插件可能添加 `wiki-page` 对象类型，CI 插件可能添加 `pull-request` 对象类型。
