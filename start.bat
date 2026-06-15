@echo off
chcp 65001 >nul
title NanoCloud 启动程序
setlocal enabledelayedexpansion

echo ╔══════════════════════════════════════════╗
echo ║     NanoCloud 启动程序                    ║
echo ╚══════════════════════════════════════════╝
echo.

:: ─── 查找安装目录 ────────────────────────────────
set "INSTALL_DIR=%ProgramFiles%\NanoCloud"

if not exist "%INSTALL_DIR%\nano.exe" (
    :: 尝试在当前目录运行
    if exist "nano.exe" (
        set "INSTALL_DIR=%CD%"
    ) else (
        echo [错误] 未找到 nano.exe
        echo   请先运行 install.bat 安装，或将 nano.exe 放到当前目录
        pause
        exit /b 1
    )
)

:: ─── 检查是否已在运行 ──────────────────────────
tasklist /fi "imagename eq nano.exe" /fo csv 2>nul | findstr /i "nano.exe" >nul
if %ERRORLEVEL% equ 0 (
    echo [信息] NanoCloud 正在运行中
    echo.
    :: 显示端口
    for /f "tokens=2 delims=:" %%a in ('findstr /b "port:" "%INSTALL_DIR%\config.yaml"') do set "APP_PORT=%%a"
    set "APP_PORT=%APP_PORT::=%"
    set "APP_PORT=%APP_PORT: =%"
    if "!APP_PORT!"=="" set "APP_PORT=8080"
    echo   访问地址: http://localhost:!APP_PORT!
    pause
    exit /b 0
)

:: ─── 尝试通过服务启动 ────────────────────────────
sc start NanoCloud >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo ✓ 服务已启动
) else (
    :: 直接启动
    cd /d "%INSTALL_DIR%"
    start /B nano.exe
    echo ✓ NanoCloud 已后台启动
)

:: ─── 等待启动 ──────────────────────────────────
echo   正在等待服务就绪...
timeout /t 3 /nobreak >nul

:: ─── 验证 ────────────────────────────────────────
tasklist /fi "imagename eq nano.exe" /fo csv 2>nul | findstr /i "nano.exe" >nul
if %ERRORLEVEL% equ 0 (
    for /f "tokens=2 delims=:" %%a in ('findstr /b "port:" "%INSTALL_DIR%\config.yaml"') do set "APP_PORT=%%a"
    set "APP_PORT=%APP_PORT::=%"
    set "APP_PORT=%APP_PORT: =%"
    if "!APP_PORT!"=="" set "APP_PORT=8080"
    
    echo.
    echo ✓ NanoCloud 已成功启动！
    echo   访问地址: http://localhost:!APP_PORT!
) else (
    echo ⚠ NanoCloud 可能启动失败，请检查日志
)
echo.
pause
