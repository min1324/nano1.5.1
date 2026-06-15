@echo off
chcp 65001 >nul
title NanoCloud 卸载程序 (Windows)
setlocal enabledelayedexpansion

echo ╔══════════════════════════════════════════╗
echo ║     NanoCloud 卸载程序 (Windows)         ║
echo ╚══════════════════════════════════════════╝
echo.

:: ─── 检查管理员权限 ──────────────────────────────
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [权限] 卸载需要管理员权限，正在请求提权...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
echo [权限] ✓ 已获取管理员权限
echo.

:: ─── 停止服务 ────────────────────────────────────
echo [1/5] 停止正在运行的服务...
sc stop NanoCloud >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo   ✓ 服务已停止
) else (
    echo   - 服务未运行或不存在
)

schtasks /end /tn "NanoCloud" >nul 2>&1

taskkill /f /im nano.exe >nul 2>&1
echo.
timeout /t 2 /nobreak >nul

:: ─── 删除服务 ────────────────────────────────────
echo [2/5] 删除服务注册...
sc delete NanoCloud >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo   ✓ Windows 服务已删除
) else (
    echo   - 服务不存在或已删除
)

schtasks /delete /tn "NanoCloud" /f >nul 2>&1
echo.

:: ─── 删除防火墙规则 ──────────────────────────────
echo [3/5] 清理防火墙规则...
netsh advfirewall firewall delete rule name="NanoCloud Web" >nul 2>&1
echo   ✓ 防火墙规则已清理
echo.

:: ─── 删除安装目录 ────────────────────────────────
echo [4/5] 删除安装目录...
set "INSTALL_DIR=%ProgramFiles%\NanoCloud"

if exist "%INSTALL_DIR%" (
    :: 询问是否保留用户数据
    echo [选项] 是否保留用户文件（files/ 目录下的上传文件）? (Y/N，默认 Y)
    set /p KEEP_FILES="请选择: "
    if /i "!KEEP_FILES!"=="N" (
        rmdir /s /q "%INSTALL_DIR%"
        echo   ✓ 安装目录已完全删除
    ) else (
        :: 保留 files 目录，删除其余
        if exist "%INSTALL_DIR%\files" (
            xcopy /E /I /Y "%INSTALL_DIR%\files" "%USERPROFILE%\Desktop\NanoCloud_Backup_files\" >nul
            echo   ✓ 用户文件已备份到桌面 NanoCloud_Backup_files
        )
        rmdir /s /q "%INSTALL_DIR%"
        echo   ✓ 安装目录已删除（用户文件已备份）
    )
) else (
    echo   - 安装目录不存在
)
echo.

:: ─── 清理当前目录的临时文件 ──────────────────
echo [5/5] 清理当前目录编译文件...
if exist "nano.exe" (
    del /f /q "nano.exe" >nul 2>&1
    echo   ✓ 已删除当前目录的 nano.exe
)
echo.

echo ╔══════════════════════════════════════════╗
echo ║     卸载完成！                           ║
echo ╚══════════════════════════════════════════╝
echo.
pause
