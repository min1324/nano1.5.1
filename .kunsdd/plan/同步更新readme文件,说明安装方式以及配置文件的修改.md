看起来我还在 Plan 模式下，无法直接修改文件。让我总结一下，请您确认后切换到 Write 模式。

---

## 📋 完整修改方案总结

### 1️⃣ 更新 `.gitignore`
- 删除 `*.sh` 和 `*.bat` 的全局忽略
- 改为只忽略 `*.exe` 等，保留 `install.*`、`uninstall.*`、`start.*`、`stop.*`、`status.*` 脚本

### 2️⃣ 创建 Windows 脚本（6个）

| 脚本 | 功能 | 核心逻辑 |
|------|------|---------|
| `install.bat` | **一键安装** | 管理员提权 → 检查Go → 编译 → 复制到 `%ProgramFiles%\NanoCloud` → 创建 `run-nano.bat` 包装器（`cd /d %~dp0 && nano.exe`）→ `sc create` 注册服务 → `sc start` → 防火墙放行 |
| `uninstall.bat` | **卸载** | `sc stop` → `sc delete` → `taskkill /f /im nano.exe` → `rmdir /s /q` 删除安装目录 |
| `start.bat` | **启动** | 检查安装目录 → `sc start NanoCloud` 或 `start /B nano.exe` |
| `stop.bat` | **停止** | `sc stop NanoCloud` → `taskkill /f /im nano.exe` |
| `status.bat` | **状态** | 检查进程/netsat端口/服务状态 |
| `install.ps1` | **PowerShell 安装** | 同上，但支持 NSSM 服务 |

### 3️⃣ 创建 Linux 脚本（5个）

| 脚本 | 功能 | 核心逻辑 |
|------|------|---------|
| `install.sh` | **一键安装** | 检查Go → 编译 → 复制到 `/usr/local/bin/nanocloud` → 创建 `/usr/local/share/nanocloud/`（含static/config/files/logs）→ 创建 systemd service（`WorkingDirectory` 设好）→ `systemctl enable --now` |
| `uninstall.sh` | **卸载** | `systemctl stop/disable` → 删除 service 文件 → 删除二进制和共享目录 |
| `start.sh` | **启动** | `systemctl start nanocloud` |
| `stop.sh` | **停止** | `systemctl stop nanocloud` |
| `status.sh` | **状态** | `systemctl status nanocloud` |

### 4️⃣ 更新 `readme.md` 需要修改的段落

| 位置 | 修改内容 |
|------|---------|
| 📁 项目结构 | 在树形图中添加 `install.bat`、`install.sh`、`start.bat`、`stop.bat`、`uninstall.bat` 等 |
| 📦 部署说明 | **新增「一键安装部署」章节**（安装脚本、管理命令、安装目录结构、验证前端可访问） |
| 🚀 安装与运行 | **新增「服务管理」子章节**（start/stop/uninstall/status 命令说明） |
| ⚙️ 配置说明 | **补充「在线修改配置」**（管理员通过 Web UI 修改 `maxStorage`/`previewMaxSize`）+ **「手动修改配置」**（修改 config.yaml 后重启服务） |

### 5️⃣ 清理临时文件
- 删除 `nano_test_build.exe`
- 删除 `build/` 目录
- 清理旧的 `build-all.bat`（替换为新版本）

---

**前端托管保障**：所有安装脚本都会确保：
- Windows 服务用包装 bat 设置工作目录
- Linux systemd 用 `WorkingDirectory` 指令
- 安装后验证 `http://localhost:8080/` 能正确返回前端页面

确认方案，我将立即开始实施？