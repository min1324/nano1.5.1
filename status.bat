@echo off
chcp 65001 >nul
title NanoCloud 状态检查
setlocal enabledelayedexpansion

echo ╔══════════════════════════════════════════╗
echo ║     NanoCloud 运行状态                    ║
echo ╚══════════════════════════════════════════╝
echo.

:: ─── 查找安装目录 ────────────────────────────────
set "INSTALL_DIR=%ProgramFiles%\NanoCloud"

:: ─── 1. 检查进程 ────────────────────────────────
echo ── [1/4] 进程状态 ──────────────────────────
tasklist /fi "imagename eq nano.exe" /fo csv 2>nul | findstr /i "nano.exe" >nul
if %ERRORLEVEL% equ 0 (
    echo   ✅ nano.exe 正在运行
    for /f "skip=2 tokens=2 delims=," %%a in ('tasklist /fi "imagename eq nano.exe" /fo csv 2^>nul') do (
        set "PID=%%~a"
        goto :PID_FOUND
    )
    :PID_FOUND
    echo      PID: %PID%
) else (
    echo   ❌ nano.exe 未运行
)
echo.

:: ─── 2. 检查 Windows 服务 ──────────────────────
echo ── [2/4] 服务状态 ──────────────────────────
sc query NanoCloud | findstr "STATE" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "tokens=4" %%a in ('sc query NanoCloud ^| findstr "STATE"') do (
        if "%%a"=="RUNNING" (
            echo   ✅ 服务 "NanoCloud" 状态: 运行中
        ) else if "%%a"=="STOPPED" (
            echo   ⏹ 服务 "NanoCloud" 状态: 已停止
        ) else (
            echo   🔄 服务 "NanoCloud" 状态: %%a
        )
    )
    for /f "tokens=5" %%a in ('sc query NanoCloud ^| findstr "START_TYPE"') do (
        if "%%a"=="AUTO_START" echo   启动方式: 自动 (开机自启)
        if "%%a"=="DEMAND_START" echo   启动方式: 手动
    )
) else (
    echo   ❌ 服务 "NanoCloud" 未注册
)

schtasks /query /tn "NanoCloud" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo   ✅ 计划任务 "NanoCloud" 已注册
)
echo.

:: ─── 3. 检查端口 ────────────────────────────────
echo ── [3/4] 端口监听 ──────────────────────────
if exist "%INSTALL_DIR%\config.yaml" (
    for /f "tokens=2 delims=:" %%a in ('findstr /b "port:" "%INSTALL_DIR%\config.yaml"') do set "APP_PORT=%%a"
) else if exist "config.yaml" (
    for /f "tokens=2 delims=:" %%a in ('findstr /b "port:" "config.yaml"') do set "APP_PORT=%%a"
)
set "APP_PORT=%APP_PORT::=%"
set "APP_PORT=%APP_PORT: =%"
if "%APP_PORT%"=="" set "APP_PORT=8080"

netstat -ano | findstr ":%APP_PORT% " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo   ✅ 端口 %APP_PORT% 正在监听
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%APP_PORT% " ^| findstr "LISTENING"') do (
        set "LISTEN_PID=%%a"
    )
    echo      PID: %LISTEN_PID%
) else (
    echo   ❌ 端口 %APP_PORT% 未监听
)
echo.

:: ─── 4. 安装目录 ────────────────────────────────
echo ── [4/4] 安装目录 ──────────────────────────
if exist "%INSTALL_DIR%" (
    echo   ✅ 安装目录: %INSTALL_DIR%
    dir /b "%INSTALL_DIR%" 2>nul
) else if exist "nano.exe" (
    echo   📁 当前目录: %CD%
) else (
    echo   ❌ 未找到安装目录
)
echo.

echo ─────────────────────────────────────────────
echo.
pause
