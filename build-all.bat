@echo off
chcp 65001 >nul
title NanoCloud 跨平台构建工具

setlocal enabledelayedexpansion

echo ============================================
echo    NanoCloud 跨平台构建工具
echo ============================================
echo.

:: 检查 Go 环境
where go >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Go 编译器，请先安装 Go 1.16+
    echo   下载地址: https://go.dev/dl/
    pause
    exit /b 1
)

echo [信息] Go 编译器版本:
go version
echo.

:: 设置版本信息（可选）
set "BUILD_TIME=%date% %time%"
set "BUILD_FLAGS=-ldflags=-s -w"

:: ---- Windows amd64 ----
echo [1/4] 编译 Windows amd64...
set GOOS=windows
set GOARCH=amd64
go build %BUILD_FLAGS% -o build/nano-windows-amd64.exe .
if %ERRORLEVEL% equ 0 (
    echo   ✓ build/nano-windows-amd64.exe
) else (
    echo   ✗ 编译失败
)
echo.

:: ---- Linux amd64 ----
echo [2/4] 编译 Linux amd64...
set GOOS=linux
set GOARCH=amd64
go build %BUILD_FLAGS% -o build/nano-linux-amd64 .
if %ERRORLEVEL% equ 0 (
    echo   ✓ build/nano-linux-amd64
) else (
    echo   ✗ 编译失败
)
echo.

:: ---- Linux arm64 (树莓派等) ----
echo [3/4] 编译 Linux arm64...
set GOOS=linux
set GOARCH=arm64
go build %BUILD_FLAGS% -o build/nano-linux-arm64 .
if %ERRORLEVEL% equ 0 (
    echo   ✓ build/nano-linux-arm64
) else (
    echo   ✗ 编译失败
)
echo.

:: ---- macOS amd64 ----
echo [4/4] 编译 macOS amd64...
set GOOS=darwin
set GOARCH=amd64
go build %BUILD_FLAGS% -o build/nano-darwin-amd64 .
if %ERRORLEVEL% equ 0 (
    echo   ✓ build/nano-darwin-amd64
) else (
    echo   ✗ 编译失败
)
echo.

:: ---- 复制静态资源和配置模板 ----
echo [附加] 复制部署所需的辅助文件...
if not exist build\static mkdir build\static
xcopy /E /I /Y static build\static >nul 2>&1
echo   - static/ 资源已复制

if not exist build\files mkdir build\files
echo   - files/ 目录已创建

if not exist build\logs mkdir build\logs
echo   - logs/ 目录已创建

:: 创建各平台的配置模板
echo port: :8080> build\config.yaml
echo uploadDir: ./files>> build\config.yaml
echo maxStorage: "10GB">> build\config.yaml
echo previewMaxSize: 10MB>> build\config.yaml
echo logDir: ./logs>> build\config.yaml
echo logLevel: info>> build\config.yaml
echo logMaxSize: 100MB>> build\config.yaml
echo logMaxBackups: 7>> build\config.yaml
echo logMaxAge: 30>> build\config.yaml
echo users:>> build\config.yaml
echo     - username: root>> build\config.yaml
echo       password: "123456">> build\config.yaml
echo       type: root>> build\config.yaml
echo       displayName: Root>> build\config.yaml
echo   - 配置文件模板已创建 (默认密码: 123456)

echo.
echo ============================================
echo    构建完成!
echo ============================================
echo.
echo 构建产物位于 build/ 目录:
echo   nano-windows-amd64.exe  - Windows 64位
echo   nano-linux-amd64        - Linux 64位
echo   nano-linux-arm64        - Linux ARM64 (树莓派等)
echo   nano-darwin-amd64       - macOS Intel
echo.
echo 各平台部署:
echo   Windows: 直接运行 build/nano-windows-amd64.exe
echo   Linux:   chmod +x build/nano-linux-amd64 ^&^& ./build/nano-linux-amd64
echo.
echo 更多部署方式请参考:
echo   install.bat  - Windows 安装脚本
echo   install.ps1  - Windows PowerShell 安装脚本
echo   install.sh   - Linux 安装脚本
echo   docker-compose.yml - Docker 部署
echo.
pause
