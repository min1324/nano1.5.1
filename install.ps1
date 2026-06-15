<#
.SYNOPSIS
    NanoCloud - 轻量级私有云文件管理系统
    Windows PowerShell 高级安装脚本
.DESCRIPTION
    支持编译安装、Windows 服务注册（sc.exe / NSSM）、任务计划程序。
    开机自启，后台运行。
#>

#Requires -Version 5.1

$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptPath

$host.UI.RawUI.WindowTitle = "NanoCloud 安装程序 (PowerShell)"

Write-Host @" 
╔══════════════════════════════════════════╗
║  NanoCloud 安装程序 (PowerShell)         ║
╚══════════════════════════════════════════╝
"@ -ForegroundColor Cyan
Write-Host ""

# ─── 管理员权限检查 ────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[权限] 安装需要管理员权限，正在提权..." -ForegroundColor Yellow
    $proc = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs -PassThru
    exit
}
Write-Host "[权限] ✓ 已获取管理员权限" -ForegroundColor Green
Write-Host ""

# ─── 配置参数 ──────────────────────────────────────
$INSTALL_DIR = "${env:ProgramFiles}\NanoCloud"
$SERVICE_NAME = "NanoCloud"

# ─── 1. 检查静态资源 ──────────────────────────────
Write-Host "[1/7] 检查前端静态资源..." -ForegroundColor Yellow
$requiredFiles = @("static\index.html", "static\app.js", "static\style.css", "static\download.html")
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Error "缺少必需文件: $file"
        Read-Host "按 Enter 退出"
        exit 1
    }
}
Write-Host "  ✓ 前端资源完整" -ForegroundColor Green
Write-Host ""

# ─── 2. 配置文件 ──────────────────────────────────
Write-Host "[2/7] 检查配置文件..." -ForegroundColor Yellow
if (-not (Test-Path "config.yaml")) {
    $port = Read-Host "  请输入监听端口 (默认 8080)"
    if ([string]::IsNullOrWhiteSpace($port)) { $port = "8080" }
    $maxStorage = Read-Host "  请输入存储空间上限 (默认 10GB)"
    if ([string]::IsNullOrWhiteSpace($maxStorage)) { $maxStorage = "10GB" }
    
    @"
port: :$port
uploadDir: ./files
maxStorage: "$maxStorage"
previewMaxSize: 10MB
logDir: ./logs
logLevel: info
logMaxSize: 100MB
logMaxBackups: 7
logMaxAge: 30
users:
    - username: root
      password: "123456"
      type: root
      displayName: Root
"@ | Out-File -FilePath "config.yaml" -Encoding utf8
    Write-Host "  ✓ 配置文件已创建" -ForegroundColor Green
} else {
    Write-Host "  ✓ 检测到现有配置文件" -ForegroundColor Green
}
Write-Host ""

# ─── 读取端口 ──────────────────────────────────────
$configContent = Get-Content "config.yaml" -Raw
if ($configContent -match 'port:\s*:(\d+)') {
    $APP_PORT = $Matches[1]
} else { $APP_PORT = "8080" }

# ─── 3. 端口检查 ─────────────────────────────────
Write-Host "[3/7] 检查端口 $APP_PORT 占用..." -ForegroundColor Yellow
$connections = netstat -ano | Select-String ":$APP_PORT "
if ($connections) {
    Write-Warning "端口 $APP_PORT 已被占用！请修改 config.yaml 中的 port 配置"
    Read-Host "按 Enter 退出"
    exit 1
}
Write-Host "  ✓ 端口 $APP_PORT 可用" -ForegroundColor Green
Write-Host ""

# ─── 4. 编译 ──────────────────────────────────────
Write-Host "[4/7] 编译项目..." -ForegroundColor Yellow
try {
    $goVersion = go version
    Write-Host "  ✓ Go 环境: $goVersion" -ForegroundColor Green
} catch {
    Write-Error "未找到 Go 编译器。请从 https://go.dev/dl/ 安装"
    Read-Host "按 Enter 退出"
    exit 1
}

Write-Host "  [正在编译，请稍候...]"
$buildResult = go build -ldflags="-s -w" -o nano.exe .
if ($LASTEXITCODE -ne 0) {
    Write-Error "编译失败"
    Read-Host "按 Enter 退出"
    exit 1
}
Write-Host "  ✓ 编译成功: nano.exe" -ForegroundColor Green
Write-Host ""

# ─── 5. 安装到系统目录 ────────────────────────────
Write-Host "[5/7] 安装到系统目录..." -ForegroundColor Yellow

# 停止旧服务
sc.exe stop $SERVICE_NAME 2>$null | Out-Null
sc.exe delete $SERVICE_NAME 2>$null | Out-Null
Stop-Process -Name "nano" -Force -ErrorAction SilentlyContinue

# 清理并创建安装目录
if (Test-Path $INSTALL_DIR) {
    Remove-Item -Recurse -Force $INSTALL_DIR
}
New-Item -ItemType Directory -Path "$INSTALL_DIR\files" -Force | Out-Null
New-Item -ItemType Directory -Path "$INSTALL_DIR\logs" -Force | Out-Null

Copy-Item "nano.exe" $INSTALL_DIR -Force
Copy-Item "config.yaml" $INSTALL_DIR -Force
Copy-Item -Recurse "static" "$INSTALL_DIR\static\" -Force

Write-Host "  ✓ 已安装到: $INSTALL_DIR" -ForegroundColor Green
Write-Host ""

# ─── 6. 注册服务 ──────────────────────────────────
Write-Host "[6/7] 选择服务注册方式..." -ForegroundColor Yellow
Write-Host "  [1] Windows 服务 (sc.exe，内置于系统)"
Write-Host "  [2] NSSM 服务 (推荐，需下载 https://nssm.cc)"
Write-Host "  [3] 任务计划程序 (开机登录后启动)"
$serviceChoice = Read-Host "请选择 (默认 1)"
if ([string]::IsNullOrWhiteSpace($serviceChoice)) { $serviceChoice = "1" }

switch ($serviceChoice) {
    "1" {
        # sc.exe 方式 - 使用 cmd /c cd 切换工作目录
        $binPath = "cmd /c cd /d `"$INSTALL_DIR`" && nano.exe"
        sc.exe create $SERVICE_NAME binPath= "`"$binPath`"" start= auto displayname= "NanoCloud 文件管理系统"
        sc.exe failure $SERVICE_NAME reset= 60 actions= restart/5000/restart/10000/restart/30000
        Write-Host "  ✓ Windows 服务已注册 (开机自启，失败自动重启)" -ForegroundColor Green
    }
    "2" {
        # NSSM 方式 - 原生支持设置工作目录
        $nssmPath = Read-Host "请输入 nssm.exe 路径 (例如 C:\tools\nssm.exe)"
        if ([string]::IsNullOrWhiteSpace($nssmPath)) {
            Write-Warning "未指定 NSSM 路径，回退到 sc.exe"
            $binPath = "cmd /c cd /d `"$INSTALL_DIR`" && nano.exe"
            sc.exe create $SERVICE_NAME binPath= "`"$binPath`"" start= auto displayname= "NanoCloud 文件管理系统"
        } else {
            & $nssmPath install $SERVICE_NAME "$INSTALL_DIR\nano.exe"
            & $nssmPath set $SERVICE_NAME AppDirectory $INSTALL_DIR
            & $nssmPath set $SERVICE_NAME AppStdout "$INSTALL_DIR\logs\nssm-stdout.log"
            & $nssmPath set $SERVICE_NAME AppStderr "$INSTALL_DIR\logs\nssm-stderr.log"
            & $nssmPath set $SERVICE_NAME Start SERVICE_AUTO_START
            Write-Host "  ✓ NSSM 服务已注册 (开机自启，工作目录已设置)" -ForegroundColor Green
        }
    }
    "3" {
        # 任务计划程序
        $action = New-ScheduledTaskAction -Execute "$INSTALL_DIR\nano.exe" -WorkingDirectory $INSTALL_DIR
        $trigger = New-ScheduledTaskTrigger -AtStartup
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        Register-ScheduledTask -TaskName $SERVICE_NAME -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force
        Write-Host "  ✓ 计划任务已创建 (开机自启)" -ForegroundColor Green
    }
}
Write-Host ""

# ─── 7. 启动服务 + 防火墙 ────────────────────────
Write-Host "[7/7] 启动服务 + 防火墙配置..." -ForegroundColor Yellow

# 启动
switch ($serviceChoice) {
    "1" { sc.exe start $SERVICE_NAME }
    "2" { 
        if ($nssmPath) { & $nssmPath start $SERVICE_NAME }
        else { Start-Process -FilePath "$INSTALL_DIR\nano.exe" -WorkingDirectory $INSTALL_DIR -WindowStyle Hidden }
    }
    "3" { Start-ScheduledTask -TaskName $SERVICE_NAME }
}
Write-Host "  ✓ 服务已启动" -ForegroundColor Green

# 防火墙
$fwRule = Get-NetFirewallRule -DisplayName "NanoCloud Web" -ErrorAction SilentlyContinue
if (-not $fwRule) {
    New-NetFirewallRule -DisplayName "NanoCloud Web" -Direction Inbound -Protocol TCP -LocalPort $APP_PORT -Action Allow
    Write-Host "  ✓ 防火墙规则已添加 (端口 $APP_PORT)" -ForegroundColor Green
}
Write-Host ""

# ─── 完成 ─────────────────────────────────────────
Write-Host @" 
╔══════════════════════════════════════════╗
║      安装完成！                          ║
╠══════════════════════════════════════════╣
║  访问地址: http://localhost:$APP_PORT    ║
║  管理员:   root                         ║
║  默认密码: 123456                       ║
╠══════════════════════════════════════════╣
║  安装目录: $INSTALL_DIR                 ║
╚══════════════════════════════════════════╝
"@ -ForegroundColor Cyan
Write-Host ""
Write-Host "安全提示: 首次登录后请立即修改默认密码！" -ForegroundColor Red
Write-Host ""
Read-Host "按 Enter 退出"
