# NanoCloud - 轻量级私有云文件管理系统

基于 Go 构建的轻量级私有云文件管理系统，采用前后端分离架构，部署简单、功能完备。

## 项目概述

NanoCloud 提供完整的文件管理解决方案，包括文件上传/下载、在线预览、在线编辑、批量操作等功能。系统采用三级权限体系（公开/认证/管理员），支持基于角色的访问控制。

### 核心特性

- **安全可靠**：基于 Bearer Token 的认证机制，密码采用 bcrypt 哈希存储，路径遍历防护
- **高性能**：并发安全的文件操作，存储空间缓存 + singleflight 防击穿
- **易部署**：支持同源部署和跨域独立部署，自动生成配置文件
- **功能完备**：文件管理、在线预览、在线编辑、批量操作、二维码下载等

### 技术架构

- **后端**：Go 1.16+，标准库 + golang.org/x/crypto + gopkg.in/yaml.v3
- **前端**：原生 JavaScript + CSS，无第三方依赖
- **存储**：本地文件系统
- **认证**：Bearer Token（30分钟自动过期）
- **日志**：自动轮转 + 过期清理

后端提供 RESTful API 并托管前端静态资源，前端通过 `API_BASE` 变量配置后端地址，支持同源部署和跨域独立部署两种模式。

## ✨ 功能概览

| 功能模块 | 说明 |
|---------|------|
| 📁 文件管理 | 上传/下载/删除/移动/复制/重命名，支持批量操作和文件夹上传 |
| 👁️ 在线预览 | 图片、视频、音频、PDF、Office 文档、Markdown、代码高亮 |
| ✏️ 在线编辑 | 文本/代码文件在线编辑，支持 50+ 语言语法高亮 |
| 📱 二维码下载 | 扫码下载文件，手机端友好下载页面 |
| 🔍 文件搜索 | 按文件名搜索，支持递归/当前目录搜索 |
| 🔐 用户认证 | 基于角色的访问控制（admin/user），Token 认证 + 自动过期 |
| 💾 存储管理 | 容量限制、空间监控、缓存优化 |
| 📋 操作日志 | 全操作审计日志，自动轮转和过期清理 |
| 🌓 主题切换 | 浅色/深色主题，响应式布局适配移动端 |

## 📦 部署说明

### 环境要求

- Go 1.16 或更高版本
- Windows/Linux/macOS 操作系统
- 至少 100MB 可用磁盘空间

### 同源部署（默认）

后端直接托管前端静态资源，部署时需要确保以下目录与可执行文件在同一目录：

- `static/` - 前端静态资源目录（包含 index.html、app.js、style.css、download.html）
- `config.yaml` - 配置文件（首次运行自动生成）
- `files/` - 文件存储目录（运行时自动创建）
- `logs/` - 日志目录（运行时自动创建）

前端 `app.js` 中 `API_BASE` 留空即可：

```javascript
const API_BASE = "";
```

### 跨域独立部署

前端部署到独立的 Web 服务器（如 Nginx），修改 `app.js` 中的 `API_BASE` 为后端地址：

```javascript
const API_BASE = "http://your-server:8080";
```

后端已内置 CORS 中间件，自动允许跨域请求。

### 配置文件

首次运行时自动生成 `config.yaml`，包含以下默认配置：

```yaml
port: ":8080"
uploadDir: "./files"
maxStorage: "10GB"
previewMaxSize: "10MB"
logDir: "./logs"
logLevel: "info"
logMaxSize: "100MB"
logMaxBackups: 7
logMaxAge: 30
users:
  - username: root
    password: $2a$10$...  # bcrypt 哈希
    type: root
    displayName: Root
  - username: admin
    password: $2a$10$...
    type: admin
    displayName: Admin
  - username: user
    password: $2a$10$...
    type: user
    displayName: User
```

**安全提示**：
- 首次部署后请立即修改默认密码
- 生产环境建议使用强密码
- 定期备份 `config.yaml` 和 `files/` 目录

## 📁 项目结构

```
nano/
├── main.go                          # 入口文件（服务启动、优雅关闭）
├── config.yaml                      # 配置文件（首次运行自动生成）
├── internal/
│   ├── config/
│   │   └── config.go                # 配置加载/解析/持久化、用户管理
│   ├── handler/
│   │   ├── routes.go                # API 路由注册与方法守卫
│   │   ├── auth.go                  # 用户认证（登录/登出/令牌验证）
│   │   ├── list.go                  # 文件列表查询
│   │   ├── upload.go                # 文件上传（含冲突策略）
│   │   ├── file_ops.go              # 文件操作（创建/删除/移动/复制/重命名）
│   │   ├── preview.go               # 文件预览
│   │   ├── download.go              # 文件下载（单文件/批量/目录ZIP/下载页面）
│   │   ├── editor.go                # 文件在线编辑（读取/保存）
│   │   ├── search.go                # 文件搜索
│   │   ├── security.go              # 安全配置与用户管理（管理员）
│   │   ├── server_info.go           # 服务器信息与存储空间
│   │   ├── mime.go                  # MIME 类型映射
│   │   ├── response.go              # 统一响应处理
│   │   └── util.go                  # 通用工具函数（getClientIP、formatSize）
│   ├── logger/
│   │   └── logger.go                # 日志系统（级别过滤 + 自动轮转 + 过期清理）
│   ├── middleware/
│   │   ├── auth.go                  # 认证/权限中间件 + Token 管理
│   │   └── cors.go                  # CORS 跨域中间件
│   ├── model/
│   │   ├── response.go              # API 响应结构与文件信息模型
│   │   └── user.go                  # 用户模型与登录请求/响应
│   └── service/
│       └── file_manager.go          # 文件管理器（并发安全 + 存储缓存 + 路径安全）
├── cmd/
│   └── stress_test/
│       └── main.go                  # 压力测试（并发 + 内存泄漏 + Goroutine 泄漏）
├── static/                          # 前端静态资源（部署时必需）
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── download.html
├── logs/                            # 日志目录（运行时自动创建）
├── files/                           # 文件存储目录（运行时自动创建）
├── install.bat                      # 一键安装脚本
└── readme.md
```

## 🚀 安装与运行

### 系统要求

- Go 1.16 或更高版本

### 快速启动

```bash
# 进入项目目录
cd nano

# 直接运行
go run .

# 或编译后运行
go build -o nano.exe .
./nano.exe
```

启动后访问 http://localhost:8080

## 📡 API 接口

### 认证相关（公开）

| 方法  | 路径                | 说明       | 权限 | 请求参数                          |
| ----- | ------------------- | ---------- | ---- | --------------------------------- |
| POST  | `/api/login`        | 用户登录   | 公开 | `username`, `password`            |
| POST  | `/api/logout`       | 用户登出   | 公开 | Header: `Authorization: Bearer <token>` |
| GET   | `/api/verify-token` | 验证令牌   | 公开 | Header: `Authorization: Bearer <token>` |
| PUT   | `/api/profile`      | 更新个人信息 | 认证 | `oldPassword`, `password`, `displayName` |

### 文件浏览

| 方法   | 路径                | 说明       | 权限 | 请求参数                          |
| ------ | ------------------- | ---------- | ---- | --------------------------------- |
| GET    | `/api/list`         | 文件列表   | 公开 | `path`（目录路径）                |
| GET    | `/api/server-info`  | 服务器信息 | 公开 | —                                 |
| GET    | `/api/search`       | 搜索文件   | 认证 | `q`（关键词）, `path`, `recursive` |
| GET    | `/api/storage`      | 存储空间信息 | 认证 | —                                 |

### 文件操作（需管理员权限）

| 方法   | 路径                 | 说明            | 权限   | 请求参数                                        |
| ------ | -------------------- | --------------- | ------ | ----------------------------------------------- |
| POST   | `/api/upload`        | 上传文件        | 认证   | multipart/form-data, `path`, `conflict`, `pathMap` |
| POST   | `/api/create-folder` | 创建文件夹      | 管理员 | `path`, `folderName`                            |
| POST   | `/api/create-file`   | 创建空文件      | 管理员 | `path`, `fileName`                              |
| DELETE | `/api/delete`        | 删除文件/文件夹 | 管理员 | `path` 或 `paths[]`                             |
| POST   | `/api/move`          | 移动文件/文件夹 | 管理员 | `sourcePath`/`sourcePaths[]`, `destinationPath` |
| POST   | `/api/copy`          | 复制文件/文件夹 | 管理员 | `sourcePath`/`sourcePaths[]`, `destinationPath` |
| POST   | `/api/rename`        | 重命名          | 管理员 | `oldPath`, `newName`                            |

### 下载与预览

| 方法 | 路径                  | 说明              | 权限 | 请求参数                           |
| ---- | --------------------- | ----------------- | ---- | ---------------------------------- |
| GET  | `/api/download`       | 下载文件/目录     | 认证 | `path`, `asZip=true`（单文件打包） |
| GET  | `/api/batch-download` | 批量下载（ZIP）   | 认证 | `paths`（逗号分隔）                |
| GET  | `/api/preview`        | 预览文件          | 认证 | `path`                             |
| GET  | `/api/d`              | 二维码下载页面    | 认证 | `path` 或 `paths`                  |

### 在线编辑（需管理员权限）

| 方法 | 路径                | 说明         | 权限   | 请求参数          |
| ---- | ------------------- | ------------ | ------ | ----------------- |
| GET  | `/api/file-content` | 获取文件内容 | 管理员 | `path`            |
| POST | `/api/save-file`    | 保存文件内容 | 管理员 | `path`, `content` |

### 系统管理（仅 root 权限）

| 方法   | 路径                        | 说明     | 权限 | 请求参数                                              |
| ------ | --------------------------- | -------- | ---- | ----------------------------------------------------- |
| GET    | `/api/admin/config`         | 获取配置 | Root | —                                                     |
| PUT    | `/api/admin/update-config`  | 更新配置 | Root | `maxStorage`, `previewMaxSize`                        |
| PUT    | `/api/admin/update-user`    | 更新用户 | Root | `username`, `password`, `type`, `displayName`         |
| POST   | `/api/admin/add-user`       | 新增用户 | Root | `username`, `password`, `type`, `displayName`         |
| DELETE | `/api/admin/delete-user`    | 删除用户 | Root | `username`                                            |

### 统一响应格式

```json
{
  "success": true,
  "message": "Success",
  "data": { ... }
}
```

### 权限说明

- **公开**：无需认证即可访问
- **认证**：需要登录，任何用户均可访问
- **管理员**：需要 admin 或 root 权限
- **Root**：仅 root 用户可访问

## ⚙️ 配置说明

项目根目录下的 `config.yaml` 为配置文件，启动时自动加载：

```yaml
# 服务监听端口
port: ":8080"

# 文件存储根目录
uploadDir: "./files"

# 存储容量上限，支持 MB、GB、TB 等格式
maxStorage: "10GB"

# 在线预览/编辑文件大小限制
previewMaxSize: "10MB"

# 日志配置
logDir: "./logs"        # 日志存储目录
logLevel: "info"        # 日志级别: debug, info, warn, error
logMaxSize: "100MB"     # 单个日志文件最大大小
logMaxBackups: 7        # 保留的日志文件备份数量
logMaxAge: 30           # 日志文件保留天数
```

### 配置项说明


| 字段           | 默认值  | 说明                                  |
| -------------- | ------- | ------------------------------------- |
| port           | :8080   | 服务监听端口                          |
| uploadDir      | ./files | 文件存储根目录                        |
| maxStorage     | 10GB    | 存储容量上限，支持 B/KB/MB/GB/TB 单位 |
| previewMaxSize | 10MB    | 在线预览/编辑文件大小限制             |
| logDir         | ./logs  | 日志存储目录                          |
| logLevel       | info    | 日志级别（debug/info/warn/error）     |
| logMaxSize     | 100MB   | 单个日志文件最大大小，超过自动轮转    |
| logMaxBackups  | 7       | 保留的日志文件备份数量                |
| logMaxAge      | 30      | 日志文件保留天数，超期自动清理        |

> 若 `config.yaml` 不存在，将使用默认配置启动并自动生成配置文件。

## 📝 日志格式

日志文件位于 `logs/nanocloud.log`，格式为：

```
时间 级别 用户 操作 文件名 具体路径 [目标路径] [错误信息]
```

示例：

```
2024-01-15 10:30:00 info 192.168.1.100 上传 report.pdf /docs/report.pdf
2024-01-15 10:31:00 info 192.168.1.100 移动 photo.jpg /images/photo.jpg /archive/photo.jpg
2024-01-15 10:32:00 error 192.168.1.100 删除 temp.log /logs/temp.log 文件被占用
```

## 📖 使用说明

### 登录系统

1. 访问系统地址（默认：http://localhost:8080）
2. 输入用户名和密码（默认：admin/123456）
3. 点击"登录"按钮

**安全提示**：
- 连续登录失败5次将锁定5分钟
- 建议首次登录后立即修改密码

### 文件浏览

- **导航**：点击文件夹进入，点击面包屑导航返回上级
- **排序**：点击表头可按名称、大小、修改时间排序
- **搜索**：使用搜索框按文件名搜索，支持递归搜索
- **刷新**：点击刷新按钮重新加载当前目录

### 上传文件

1. 点击顶部"上传"按钮
2. 选择文件或拖拽到上传区域
3. 选择冲突处理策略：
   - **重命名**：自动重命名同名文件（file.txt → file(1).txt）
   - **覆盖**：直接覆盖同名文件
   - **跳过**：跳过同名文件
4. 点击"上传"按钮开始上传

### 上传文件夹

1. 点击顶部"上传文件夹"按钮
2. 选择文件夹
3. 点击"上传"按钮，目录结构将自动保持
4. 同名文件夹会自动重命名

### 创建文件夹

1. 点击顶部"新建"按钮
2. 输入文件夹名称，点击"创建"

### 创建空文件

1. 点击顶部"新建文件"按钮
2. 输入文件名称，点击"创建"

### 在线编辑

1. 点击文本/代码文件进入预览
2. 点击编辑按钮进入编辑模式
3. 修改后点击保存

**支持的文件类型**：
- 文本文件（.txt, .md, .json, .xml 等）
- 代码文件（支持 50+ 种语言语法高亮）

### 文件预览

支持以下文件类型的在线预览：
- **图片**：JPG、PNG、GIF、SVG 等
- **视频**：MP4、WebM 等
- **音频**：MP3、WAV 等
- **文档**：PDF、Office 文档
- **代码**：支持语法高亮的代码文件
- **Markdown**：支持实时渲染

### 右键菜单操作

右键点击文件/文件夹可执行：
- **打开**：进入文件夹或预览文件
- **下载**：下载单个文件或文件夹（打包为 ZIP）
- **复制**：复制到指定目录
- **移动**：移动到指定目录
- **重命名**：修改文件或文件夹名称
- **删除**：删除文件或文件夹

### 批量操作

1. 使用复选框选择多个文件/文件夹
2. 点击顶部批量操作按钮：
   - **批量下载**：打包为 ZIP 下载
   - **批量删除**：删除所有选中项
   - **批量移动**：移动到指定目录

### 二维码下载

1. 右键点击文件，选择"二维码下载"
2. 使用手机扫描二维码
3. 在手机浏览器中下载文件

### 个人设置

1. 点击右上角用户头像
2. 选择"个人设置"
3. 可修改：
   - 显示名称
   - 密码（需验证旧密码）

## 🔒 安全特性

### 路径安全
- **路径遍历防护**：所有文件操作均经过 `IsPathSafe()` 校验，拒绝包含 `..` 的路径段
- **路径规范化**：使用 `filepath.Clean` 统一路径格式，防止路径混淆攻击

### 身份认证
- **Bearer Token**：基于 Bearer Token 的认证机制，Token 30 分钟自动过期
- **双通道认证**：支持 `Authorization` 请求头和 URL 查询参数两种认证方式
- **登录保护**：连续失败5次锁定5分钟，防止暴力破解
- **密码修改保护**：修改密码需要验证旧密码，并有2秒间隔保护

### 权限控制
- **三级权限体系**：公开（无需认证）、认证（需登录）、管理员（需 admin/root 权限）
- **角色管理**：支持 root、admin、user 三种角色
- **root 保护**：root 用户不可删除，类型不可修改，禁止创建新的 root 用户

### 密码安全
- **bcrypt 哈希**：密码采用 bcrypt 哈希存储，自动迁移明文密码
- **密码隔离**：密码字段不序列化到 API 响应

### 资源管控
- **存储容量限制**：写操作前检查剩余空间，防止恶意上传耗尽磁盘
- **文件大小限制**：预览和编辑操作受 `previewMaxSize` 限制

### 并发安全
- **文件操作锁**：按路径粒度加锁，排序加锁防止死锁
- **内存安全**：锁对象自动清理、Token 定期清理、无 Goroutine 泄漏
- **存储缓存**：singleflight 防击穿，缓存有效期30秒

### 跨域支持
- **CORS 中间件**：内置跨域中间件，支持前后端分离部署

### 日志审计
- **操作日志**：记录所有文件操作，包含时间、用户、操作类型、文件路径
- **日志轮转**：自动轮转和过期清理，防止日志文件过大

## 🏗️ 并发安全架构

### FileManager 统一管理

`internal/service/file_manager.go` 封装了所有文件操作，提供统一的并发安全保证：

```
FileManager
├── 路径安全     IsPathSafe() — 拒绝 ".." 路径段
├── 文件操作锁   LockFile()   — 按路径粒度加锁，自动清理
├── 存储空间缓存  GetUsedSize() — 30秒缓存 + singleflight
└── 文件操作      Create/Read/Write/Delete/Move/Copy/ListDir...
```

### 文件操作锁机制

同一路径的并发操作会被串行化，避免数据竞争：

```go
unlock := fm.LockFile("/docs/report.pdf")
defer unlock()
// 执行文件操作...
```

**设计要点：**

- 使用 `sync.Map` 按路径存储 `sync.Mutex`，实现路径粒度的锁
- 解锁后通过 `TryLock` 检测是否有等待者，无等待者则从 Map 中删除锁对象，**防止内存泄漏**
- 涉及两个路径的操作（移动/复制）按路径字典序加锁，**防止死锁**

### 存储空间缓存 + Singleflight

`GetUsedSize()` 采用缓存 + singleflight 模式，避免高并发下重复遍历文件系统：

```
请求1 ──┐
请求2 ──┼── 缓存命中？── 是 ──> 直接返回缓存值
请求3 ──┘        │
                 否
                 │
         singleflight ── 仅1个goroutine遍历计算 ──> 更新缓存 ──> 通知等待者
```

- 缓存有效期 30 秒
- 缓存过期时仅启动 1 个 goroutine 遍历计算，其他 goroutine 等待结果
- 写操作（上传/删除/移动/复制/保存）自动使缓存失效

## 🧪 压力测试

项目内置压力测试工具，验证并发安全性和内存稳定性：

```bash
# 编译运行压力测试
go build -o stress_test.exe ./cmd/stress_test/
./stress_test.exe
```

### 测试覆盖

| 测试项 | 内容 | 验证目标 |
|--------|------|----------|
| 并发创建/删除 | 100 goroutine × 50次 | 锁竞争、操作正确性 |
| 并发移动/复制 | 50 goroutine × 20次 | 死锁检测、排序加锁 |
| 并发 GetUsedSize | 200 goroutine × 50次 | 缓存命中、singleflight |
| LockFile 高竞争 | 100 goroutine × 200次 | 锁正确性、锁泄漏 |
| 混合操作 | 50 goroutine × 5秒 | 真实场景模拟 |
| 重复循环 | 30 goroutine × 10轮 | Goroutine 泄漏检测 |

### 测试结果

| 检测项 | 结果 |
|--------|------|
| 锁泄漏 | ✅ 加锁/解锁完全匹配 |
| 内存泄漏 (sync.Map) | ✅ 锁对象全部清理，残留 0 |
| 堆内存泄漏 | ✅ 增长 0 字节 |
| Goroutine 泄漏 | ✅ Baseline=1, Final=1 |
| 死锁 | ✅ 排序加锁策略有效 |

## 📝 代码注释规范

项目采用 Go 标准注释风格，所有公开的函数、类型和常量都包含完整的文档注释。

### 包级注释

每个包的开头都包含包级注释，说明包的用途和主要功能：

```go
// Package config 提供配置加载、解析、持久化和用户管理功能。
//
// 支持从 YAML 配置文件加载配置项，缺失字段自动填充默认值。
// 密码字段自动迁移为 bcrypt 哈希存储，确保安全性。
// 运行时支持动态修改配置并持久化到磁盘。
package config
```

### 函数注释

所有公开函数都包含完整的文档注释，说明函数用途、参数和返回值：

```go
// Load 从 config.yaml 加载配置，文件不存在时生成默认配置。
// 加载流程：读取文件 → YAML 反序列化 → 填充默认值 → 解析字节数。
// 若配置文件不存在，将默认配置写入磁盘以便用户修改。
func Load() {
    // ...
}
```

### 类型注释

所有公开类型都包含文档注释，说明类型的用途和字段含义：

```go
// Config 应用配置结构，对应 config.yaml 的完整结构。
// 带 Bytes 后缀的字段为运行时解析后的字节数，不参与 YAML 序列化。
type Config struct {
    Port            string `yaml:"port"`       // 服务监听地址（如 ":8080"）
    UploadDir       string `yaml:"uploadDir"`  // 文件存储根目录
    // ...
}
```

### 常量注释

所有公开常量都包含文档注释，说明常量的用途：

```go
// MaxTokenDuration token最长有效期：30分钟
const MaxTokenDuration = 30 * time.Minute
```

## 📝 更新日志

### v1.4.3 (2025-12-20)

#### 文档优化
- 添加详细的项目概述和技术架构说明
- 完善部署说明，添加环境要求和配置文件示例
- 扩展使用说明，添加更多操作细节和安全提示
- 新增代码注释规范章节，说明项目的注释标准
- 更新API文档，添加权限标识和更详细的说明
- 完善安全特性说明，分类展示各项安全措施

#### 代码注释
- 统一所有包的注释风格为 GoDoc 标准格式
- 为所有公开函数、类型和常量添加完整注释
- 添加详细的参数说明和返回值说明
- 补充实现细节和使用示例

### v1.3.0

#### 新增功能
- 用户认证系统：基于角色的访问控制（admin/user），Token 认证 + 自动过期
- 安全配置管理：管理员可在线修改存储容量、预览大小限制
- 用户管理：管理员可新增/编辑/删除用户
- 文件搜索：按文件名搜索，支持递归/当前目录
- 二维码下载：扫码下载文件，手机端友好下载页面
- 创建空文件：支持在线创建空白文件

#### 安全增强
- 密码 bcrypt 哈希存储，明文密码自动迁移
- 三级权限体系（公开/认证/管理员）
- Token 自动过期清理（30 分钟有效期）

#### 后端注释
- 为所有包添加标准化 GoDoc 注释
- 统一注释风格为中文

---

### v1.2.0 (2024-01-21)

#### 架构调整
- 移除 go:embed 嵌入方式，改用文件系统托管静态资源
- 部署时需要确保 static 目录与可执行文件在同一目录
- 简化部署流程，便于前端资源独立更新

#### 文档更新
- 更新部署说明，明确同源部署和跨域独立部署的配置方式
- 更新项目结构说明，标注部署时必需的目录
- 更新后端注释文档，详细说明部署方式和静态资源托管方式

---

### v1.1.0 (2024-01-20)

#### 新增功能
- 文件预览功能增强
  - 添加文件大小检查和提示
  - 为图片、视频、音频、PDF预览添加错误处理
  - 为Markdown和文本文件预览添加错误处理
  - 优化预览错误提示的显示效果

#### 界面优化
- 更新上传文件夹按钮图标
- 添加预览错误状态的样式支持

#### 修复
- 优化文件预览的加载状态显示
- 改进文件信息显示，包含文件大小信息

---

### v1.0.0 (2024-01-15)

#### 初始版本
- 完整的文件管理系统
- 文件上传/下载/删除/移动/复制/重命名
- 文件夹上传和批量下载
- 在线预览和编辑功能
- 存储空间管理
- 操作日志记录
- 并发安全架构
