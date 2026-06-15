@echo off
chcp 65001 >nul
title NanoCloud 一键安装程序 (Windows)
setlocal enabledelayedexpansion

:: ─────────────────────────────────────────────────
:: NanoCloud - 轻量级私有云文件管理系统
:: Windows 一键安装脚本
:: 功能：编译 → 安装到系统 → 注册服务 → 开机自启 → 启动
:: ─────────────────────────────────────────────────

echo ╔══════════════════════════════════════════╗
echo ║     NanoCloud 一键安装程序 (Windows)     ║
echo ╚══════════════════════════════════════════╝
echo.

:: ─── 检查管理员权限 ──────────────────────────────
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [权限] 安装需要管理员权限，正在请求提权...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
echo [权限] ✓ 已获取管理员权限
echo.

:: ─── 获取脚本所在目录 ────────────────────────────
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
cd /d "%SCRIPT_DIR%"

:: ─── 步骤1: 检查前端静态资源 ────────────────────
echo [1/8] 检查前端静态资源...
if not exist "static\index.html" (
    echo [错误] 缺少 static\index.html，请确认项目完整
    pause
    exit /b 1
)
if not exist "static\app.js" (
    echo [错误] 缺少 static\app.js，请确认项目完整
    pause
    exit /b 1
)
echo   ✓ 前端资源完整 (static/index.html, app.js, style.css, download.html)
echo.

:: ─── 步骤2: 检查/创建配置文件 ──────────────────
echo [2/8] 检查配置文件...
if exist "config.yaml" (
    echo   ✓ 检测到现有配置文件 config.yaml
) else (
    echo   [配置] 创建默认配置文件...
    set /p "CFG_PORT=  请输入监听端口 (默认 8080): "
    if "!CFG_PORT!"=="" set "CFG_PORT=8080"
    set /p "CFG_STORAGE=  请输入存储空间上限 (默认 10GB): "
    if "!CFG_STORAGE!"=="" set "CFG_STORAGE=10GB"
    (
        echo port: :!CFG_PORT!
        echo uploadDir: ./files
        echo maxStorage: "!CFG_STORAGE!"
        echo previewMaxSize: 10MB
        echo logDir: ./logs
        echo logLevel: info
        echo logMaxSize: 100MB
        echo logMaxBackups: 7
        echo logMaxAge: 30
        echo users:
        echo     - username: root
        echo       password: "123456"
        echo       type: root
        echo       displayName: Root
    ) > config.yaml
    echo   ✓ 配置文件已创建 (默认密码: 123456，请登录后修改)
)
echo.

:: ─── 读取端口 ────────────────────────────────────
for /f "tokens=2 delims=:" %%a in ('findstr /b "port:" config.yaml') do set "APP_PORT=%%a"
set "APP_PORT=%APP_PORT::=%"
set "APP_PORT=%APP_PORT: =%"
if "%APP_PORT%"=="" set "APP_PORT=8080"

:: ─── 步骤3: 检查端口冲突 ────────────────────────
echo [3/8] 检查端口 %APP_PORT% 占用情况...
netstat -ano | findstr ":%APP_PORT% " >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo   ⚠ 端口 %APP_PORT% 已被占用！请修改 config.yaml 中的 port 配置
    echo   或关闭占用该端口的程序后重试
    pause
    exit /b 1
)
echo   ✓ 端口 %APP_PORT% 可用
echo.

:: ─── 步骤4: 编译项目 ────────────────────────────
echo [4/8] 编译项目...
where go >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [错误] 未找到 Go 编译器
    echo   请从 https://go.dev/dl/ 安装 Go 1.16+
    echo   或将预编译的 nano.exe 放到当前目录
    pause
    exit /b 1
)
echo   ✓ Go 环境: 
for /f "tokens=*" %%a in ('go version') do echo   %%a

echo   正在编译，请稍候...
go build -ldflags="-s -w" -o nano.exe .
if %ERRORLEVEL% neq 0 (
    echo   [错误] 编译失败，请检查 Go 环境
    pause
    exit /b 1
)
echo   ✓ 编译成功: nano.exe
echo.

:: ─── 步骤5: 安装到系统目录 ─────────────────────
echo [5/8] 安装到系统目录...
set "INSTALL_DIR=%ProgramFiles%\NanoCloud"

:: 停止可能正在运行的旧服务
sc stop NanoCloud >nul 2>&1
sc delete NanoCloud >nul 2>&1
taskkill /f /im nano.exe >nul 2>&1

:: 清理并创建安装目录
if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%"
)
mkdir "%INSTALL_DIR%"
mkdir "%INSTALL_DIR%\files"
mkdir "%INSTALL_DIR%\logs"

:: 复制文件
copy /y "nano.exe" "%INSTALL_DIR%\" >nul
xcopy /E /I /Y "static" "%INSTALL_DIR%\static\" >nul
copy /y "config.yaml" "%INSTALL_DIR%\" >nul

echo   ✓ 已安装到: %INSTALL_DIR%
echo.

:: ─── 步骤6: 创建启动包装脚本 ────────────────────
echo [6/8] 创建服务启动包装器...
(
echo @echo off
echo chcp 65001 ^>nul
echo cd /d "%~dp0"
echo start /B /W nano.exe
) > "%INSTALL_DIR%\run-nano.bat"

:: 创建启动脚本（供用户手动使用）
(
echo @echo off
echo chcp 65001 ^>nul
echo title NanoCloud
echo cd /d "%~dp0"
echo start /B nano.exe
echo echo NanoCloud 已后台启动，访问 http://localhost:%APP_PORT%
) > "%INSTALL_DIR%\start.bat"

echo   ✓ 启动包装器已创建
echo.

:: ─── 步骤7: 注册系统服务 ────────────────────────
echo [7/8] 注册 Windows 服务（开机自启）...
sc create NanoCloud binPath= "cmd /c cd /d \"%INSTALL_DIR%\" && nano.exe" start= auto displayname= "NanoCloud 文件管理系统" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   ⚠ sc 服务注册失败，尝试使用计划任务...
    schtasks /create /tn "NanoCloud" /tr "\"%INSTALL_DIR%\nano.exe\"" /ru SYSTEM /rl HIGHEST /sc ONSTART /f >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        echo   ✓ 计划任务已创建 (开机自启)
    ) else (
        echo   ⚠ 自动启动注册失败，请手动添加开机启动项
    )
) else (
    echo   ✓ Windows 服务已注册: NanoCloud (开机自启)
    :: 配置服务恢复选项（失败自动重启）
    sc failure NanoCloud reset= 60 actions= restart/5000/restart/10000/restart/30000 >nul 2>&1
    echo   ✓ 服务恢复配置完成（失败自动重启）
)
echo.

:: ─── 步骤8: 启动服务 + 防火墙 ──────────────────
echo [8/8] 启动服务...

:: 先尝试 sc start
sc start NanoCloud >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo   ✓ 服务已启动
) else (
    :: 回退：直接启动
    start /B "%INSTALL_DIR%\nano.exe"
    echo   ✓ 程序已启动 (直接运行)
)

:: 防火墙
netsh advfirewall firewall show rule name="NanoCloud Web" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    netsh advfirewall firewall add rule name="NanoCloud Web" dir=in action=allow protocol=TCP localport=%APP_PORT% >nul 2>&1
    echo   ✓ 防火墙规则已添加 (端口 %APP_PORT%)
)

echo.
echo ╔══════════════════════════════════════════╗
echo ║      安装完成！                          ║
echo ╠══════════════════════════════════════════╣
echo ║  访问地址: http://localhost:%APP_PORT%    ║
echo ║  管理员:   root                         ║
echo ║  默认密码: 123456                       ║
echo ╠══════════════════════════════════════════╣
echo ║  安装目录: %INSTALL_DIR%    ║
echo ║  管理脚本:                              ║
echo ║    start.bat   - 启动                   ║
echo ║    stop.bat    - 停止                   ║
echo ║    status.bat  - 查看状态               ║
echo ║    uninstall.bat - 卸载                 ║
echo ╚══════════════════════════════════════════╝
echo.
echo 安全提示: 首次登录后请立即修改默认密码！
echo.
pause
