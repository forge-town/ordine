---
name: ordine-browse-filesystem
description: 通过 Ordine 浏览服务端目录或目录树，用于定位输入路径或检查输出。
---

# 浏览文件系统

## 概述

Ordine 提供 filesystem API 用于浏览服务端可访问的文件系统目录，帮助确定 Pipeline 输入路径。

## 通过 CLI

`ordine fs browse [path]` 可列出目录；递归树使用下述 REST API。

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

## 范围

目标路径已明确时直接检查该路径，不必先枚举根目录或整棵树。仅在任务需要递归内容时取目录树；浏览文件不自动触发 Pipeline。检查产物时读取所需文件内容，仅看到文件名不能证明结果正确。
