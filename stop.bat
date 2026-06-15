@echo off
chcp 65001 >nul
title NanoCloud 停止程序
setlocal enabledelayedexpansion

echo ╔══════════════════════════════════════════╗
echo ║     NanoCloud 停止程序                    ║
echo ╚══════════════════════════════════════════╝
echo.

:: ─── 停止服务 ────────────────────────────────────
echo [1/3] 停止 Windows 服务...
sc stop NanoCloud >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo   ✓ 服务已停止
) else (
    echo   - 服务未运行或不存在
)

schtasks /end /tn "NanoCloud" >nul 2>&1
echo.

:: ─── 终止进程 ────────────────────────────────────
echo [2/3] 终止 nano.exe 进程...
taskkill /f /im nano.exe >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo   ✓ 进程已终止
) else (
    echo   - 未发现运行中的 nano.exe
)
echo.

:: ─── 验证 ────────────────────────────────────────
echo [3/3] 验证...
timeout /t 2 /nobreak >nul
tasklist /fi "imagename eq nano.exe" /fo csv 2>nul | findstr /i "nano.exe" >nul
if %ERRORLEVEL% equ 0 (
    echo   ⚠ nano.exe 仍在运行，请手动结束
) else (
    echo   ✓ NanoCloud 已完全停止
)
echo.
pause
