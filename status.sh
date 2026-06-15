#!/usr/bin/env bash
# NanoCloud - 查看服务状态
set -euo pipefail

echo "╔══════════════════════════════════════════╗"
echo "║     NanoCloud 运行状态                    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

SERVICE_NAME="nanocloud"
INSTALL_DIR="/usr/local/share/nanocloud"
INSTALL_BIN="/usr/local/bin/nanocloud"

# 1. systemd 服务状态
echo "── [1/4] systemd 服务 ──────────────────────────"
if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "  ✅ 服务已注册 (开机自启)"
else
    echo "  ❌ 服务未注册"
fi

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "  ✅ 状态: 运行中"
else
    echo "  ❌ 状态: 未运行"
fi
echo ""

# 2. 进程
echo "── [2/4] 进程状态 ──────────────────────────"
PID=$(pgrep -f "nanocloud" 2>/dev/null || true)
if [ -n "$PID" ]; then
    echo "  ✅ nanocloud 进程运行中 (PID: $PID)"
else
    echo "  ❌ nanocloud 进程未运行"
fi
echo ""

# 3. 端口
echo "── [3/4] 端口监听 ──────────────────────────"
if [ -f "$INSTALL_DIR/config.yaml" ]; then
    APP_PORT=$(grep -E "^port:" "$INSTALL_DIR/config.yaml" | sed 's/port: *://' | tr -d ':' | tr -d ' ')
else
    APP_PORT="8080"
fi

if ss -tlnp "sport = :${APP_PORT}" 2>/dev/null | grep -q LISTEN; then
    echo "  ✅ 端口 ${APP_PORT} 正在监听"
    ss -tlnp "sport = :${APP_PORT}" 2>/dev/null | head -1
else
    echo "  ❌ 端口 ${APP_PORT} 未监听"
fi
echo ""

# 4. 安装文件
echo "── [4/4] 安装文件 ──────────────────────────"
[ -f "$INSTALL_BIN" ] && echo "  ✅ 二进制: $INSTALL_BIN" || echo "  ❌ 二进制: 未找到"
[ -d "$INSTALL_DIR" ] && echo "  ✅ 数据目录: $INSTALL_DIR" || echo "  ❌ 数据目录: 未找到"
echo ""
