---
name: ordine-browse-filesystem
description: Use when 需要通过 Ordine 浏览项目文件系统，列出目录内容或获取递归目录树。触发词：浏览文件、查看目录、文件系统浏览、目录树、browse filesystem。
---

# 浏览文件系统

## 概述

Ordine 提供 filesystem API 用于浏览服务端可访问的文件系统目录，帮助确定 Pipeline 输入路径。

## 通过 CLI

> CLI 当前不直接支持文件系统浏览。使用 REST API 操作。

## 通过 REST API

### 浏览目录

```bash
# 浏览根目录（默认）
curl -s http://localhost:9433/api/filesystem/browse | python3 -m json.tool

# 浏览指定目录
curl -s "http://localhost:9433/api/filesystem/browse?path=./src" | python3 -m json.tool
curl -s "http://localhost:9433/api/filesystem/browse?path=./packages/models/src/daos" | python3 -m json.tool
```

### 获取递归目录树

```bash
# 获取目录树
curl -s "http://localhost:9433/api/filesystem/tree?path=./src" | python3 -m json.tool
```

## 使用场景

### 确定 Pipeline 输入路径

在运行 Pipeline 前，先浏览文件系统确认目标路径存在：

```bash
# 1. 浏览查看有哪些顶层目录
curl -s http://localhost:9433/api/filesystem/browse | python3 -m json.tool

# 2. 深入查看具体路径
curl -s "http://localhost:9433/api/filesystem/browse?path=./packages" | python3 -m json.tool

# 3. 确认目标路径后运行 Pipeline
ordine run pipe_check_dao -i ./packages/models/src/daos
```

### 检查输出目录

运行 Pipeline 后，检查输出是否生成：

```bash
curl -s "http://localhost:9433/api/filesystem/browse?path=./.ordine/results" | python3 -m json.tool
```
