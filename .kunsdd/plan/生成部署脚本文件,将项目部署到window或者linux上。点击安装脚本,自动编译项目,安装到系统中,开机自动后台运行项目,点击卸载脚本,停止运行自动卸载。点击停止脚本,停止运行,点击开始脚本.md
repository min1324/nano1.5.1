# NanoCloud 跨平台部署脚本方案

## 需求分析

用户需要一套完整的 **安装/卸载/启动/停止** 脚本，覆盖 **Windows** 和 **Linux** 两个平台：

| 操作 | 行为 |
|------|------|
| 安装 | 自动编译 → 安装到系统 → 后台运行 → 开机自启 |
| 卸载 | 停止运行 → 删除服务 → 清理文件 |
| 开始 | 后台启动程序 |
| 停止 | 停止正在运行的程序 |

---

## 方案设计

### 一、Windows 平台 (PowerShell 脚本，.bat 包装实现双击运行)

因为 `sc.exe` / `New-Service` 创建的 Windows 服务无法直接与桌面交互，且 Go 程序不是典型的 Windows 服务，最佳方案有两种：

**方案 A：任务计划程序（推荐）**  
- 用户登录时自动启动
- 双击 `.bat` 即可运行
- 不需要额外工具（NSSM）

**方案 B：NSSM 注册为 Windows 服务**  
- 系统级服务，开机自启（无需登录）
- 需要额外下载 NSSM

我选择 **方案 A（任务计划程序）** 作为主力方案，同时提供 NSSM 选项。

文件清单（共 6 个）：

| 文件名 | 说明 | 双击可运行 |
|--------|------|-----------|
| `install.bat` | 安装向导（检测环境 → 编译 → 安装到 `%ProgramFiles%\NanoCloud` → 注册任务计划 → 启动） | ✅ |
| `uninstall.bat` | 卸载（停止服务 → 删除任务计划 → 清理安装目录） | ✅ |
| `start.bat` | 后台启动程序（隐藏窗口模式） | ✅ |
| `stop.bat` | 停止程序（查找并终止进程） | ✅ |
| `status.bat` | 查看运行状态 | ✅ |
| `install.ps1` | PowerShell 高级安装脚本（含 NSSM 服务选项） | 右键→用 PowerShell 运行 |

### 二、Linux 平台 (Shell 脚本)

使用 systemd 管理服务，最符合 Linux 习惯。

文件清单（共 5 个）：

| 文件名 | 说明 | 运行方式 |
|--------|------|---------|
| `install.sh` | 安装（编译 → 复制到 `/usr/local/bin` → 创建 systemd 服务 → 启用开机自启 → 启动） | `sudo bash install.sh` |
| `uninstall.sh` | 卸载（停止 → 禁用 → 删除 systemd 服务 → 删除二进制） | `sudo bash uninstall.sh` |
| `start.sh` | 启动服务 | `bash start.sh` |
| `stop.sh` | 停止服务 | `bash stop.sh` |
| `status.sh` | 查看服务状态 | `bash status.sh` |

### 三、.gitignore 调整

当前 `.gitignore` 已通过 `!install.*` 保留 install 开头的脚本，还需要保留 `start.*`、`stop.*`、`uninstall.*`、`status.*` 等脚本不被忽略。

---

## 详细实现步骤

### Step 1：更新 `.gitignore`

- 移除 `*.sh` 和 `*.bat` 的全局忽略规则
- 改用精确的忽略列表，或保留 `!install.*`、`!start.*`、`!stop.*`、`!uninstall.*`、`!status.*` 白名单

### Step 2：创建 Windows 脚本（6 个）

#### 2.1 `install.bat` — Windows 安装脚本

功能流程：
1. 以 **管理员权限** 运行（检查，如不是则自动提权）
2. 检查 `config.yaml`，如不存在则创建默认配置
3. 检查 `static/` 目录是否完整
4. 检查 Go 环境 → 自动编译 `nano.exe`
5. 创建目标目录: `%ProgramFiles%\NanoCloud\`
6. 复制: nano.exe, static/, config.yaml, logs/, files/
7. 注册任务计划: `schtasks /create /tn "NanoCloud" /tr "..." /ru SYSTEM /rl HIGHEST /sc ONSTART /f`
8. 启动服务: `schtasks /run /tn "NanoCloud"`
9. 添加防火墙放行规则（可选）
10. 输出完成信息

#### 2.2 `uninstall.bat` — Windows 卸载脚本

功能流程：
1. 以管理员权限运行
2. 停止任务计划: `schtasks /end /tn "NanoCloud"`
3. 删除任务计划: `schtasks /delete /tn "NanoCloud" /f`
4. 终止所有 nano.exe 进程: `taskkill /f /im nano.exe`
5. 删除安装目录: `rmdir /s /q "%ProgramFiles%\NanoCloud"`
6. 删除防火墙规则（可选）
7. 输出完成信息

#### 2.3 `start.bat` — Windows 启动脚本

功能流程：
1. 查找安装目录（先检查当前目录，再检查 `%ProgramFiles%\NanoCloud`）
2. 如已运行则提示，否则启动 nano.exe（隐藏窗口: `start /b nano.exe`）
3. 等待 2 秒后验证是否启动成功
4. 输出访问地址

#### 2.4 `stop.bat` — Windows 停止脚本

功能流程：
1. 查找并终止 nano.exe 进程: `taskkill /f /im nano.exe`
2. 如果已注册任务计划，也停止计划任务
3. 输出停止结果

#### 2.5 `status.bat` — Windows 状态检查

功能流程：
1. 检查 nano.exe 进程是否存在
2. 检查计划任务是否存在
3. 检查监听端口（使用 `netstat -ano | findstr :PORT`）
4. 输出当前状态

#### 2.6 `install.ps1` — PowerShell 高级安装（保留已有脚本，补充 NSSM 服务支持）

### Step 3：创建 Linux 脚本（5 个）

#### 3.1 `install.sh` — Linux 安装脚本

功能流程：
1. 检查是否为 root（或自动 sudo）
2. 检查 config.yaml，如不存在则创建
3. 检查 Go 环境 → 编译
4. 复制到 `/usr/local/bin/nanocloud`
5. 复制 static/ 到 `/usr/local/share/nanocloud/static`
6. 创建 systemd service 文件: `/etc/systemd/system/nanocloud.service`
   ```ini
   [Unit]
   Description=NanoCloud - 轻量级私有云文件管理系统
   After=network.target
   
   [Service]
   Type=simple
   User=nobody
   Group=nogroup
   WorkingDirectory=/usr/local/share/nanocloud
   ExecStart=/usr/local/bin/nanocloud
   Restart=on-failure
   RestartSec=5
   
   [Install]
   WantedBy=multi-user.target
   ```
7. 创建必要目录: `/usr/local/share/nanocloud/{files,logs}`
8. `systemctl daemon-reload && systemctl enable nanocloud && systemctl start nanocloud`
9. 防火墙放行（firewalld/ufw/iptables）
10. 输出完成信息

#### 3.2 `uninstall.sh` — Linux 卸载脚本

功能流程：
1. 停止服务: `systemctl stop nanocloud`
2. 禁用服务: `systemctl disable nanocloud`
3. 删除服务文件: `rm /etc/systemd/system/nanocloud.service`
4. 重载: `systemctl daemon-reload`
5. 删除二进制: `rm /usr/local/bin/nanocloud`
6. 询问是否删除数据（files/、logs/、config.yaml）
7. 删除共享目录: `rm -rf /usr/local/share/nanocloud`

#### 3.3 `start.sh` — Linux 启动脚本

```
#!/bin/bash
systemctl start nanocloud && echo "NanoCloud 已启动" || echo "启动失败"
```

#### 3.4 `stop.sh` — Linux 停止脚本

```
#!/bin/bash
systemctl stop nanocloud && echo "NanoCloud 已停止" || echo "停止失败"
```

#### 3.5 `status.sh` — Linux 状态检查

```
#!/bin/bash
systemctl status nanocloud
```

### Step 4：清理已存在的构建产物

- 删除 `nano_test_build.exe`（临时测试文件）
- 删除 `build/` 目录（旧的测试构建产物）
- 保留 `nano.exe` 和 `nano_new.exe`（预编译二进制）

---

## 风险与注意事项

1. **Windows 管理员权限**：安装/卸载/停止服务都需要管理员权限，脚本中需要自动提权（`runas /user:Administrator` 或通过 PowerShell `Start-Process -Verb RunAs`）
2. **路径兼容性**：Windows 路径含空格时需用引号包裹
3. **Go 环境缺失处理**：如果系统没有 Go，安装脚本应提供清晰的提示和替代方案
4. **端口冲突**：安装前应检查默认端口 8080 是否已被占用
5. **数据安全**：卸载脚本应询问是否保留用户数据（files/ 下的用户文件）
6. **Linux systemd 兼容性**：不同发行版 systemd 路径一致，但 `User=nobody` 可能因发行版而异（有的叫 `nogroup`）

---

## 测试验证

1. **Windows 本地测试**：在 Windows 上运行 install.bat → 验证编译成功 → 验证计划任务创建 → 验证访问 http://localhost:8080 → 运行 stop.bat → 运行 start.bat → 运行 uninstall.bat → 验证清理干净
2. **Linux 测试**：同上的流程在 Linux 环境中验证
