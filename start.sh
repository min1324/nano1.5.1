#!/usr/bin/env bash
# NanoCloud - 启动服务
set -euo pipefail

SERVICE_NAME="nanocloud"

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "NanoCloud 已在运行中"
    systemctl status "$SERVICE_NAME" --no-pager | head -10
    exit 0
fi

# 检查是否已安装服务
if [ ! -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
    echo "[错误] NanoCloud 未安装，请先运行 sudo bash install.sh"
    exit 1
fi

sudo systemctl start "$SERVICE_NAME"
sleep 2

if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✓ NanoCloud 已启动"
    APP_PORT=$(grep -E "^port:" /usr/local/share/nanocloud/config.yaml 2>/dev/null | sed 's/port: *://' | tr -d ':' | tr -d ' ')
    echo "  访问地址: http://localhost:${APP_PORT:-8080}"
else
    echo "✗ 启动失败，查看日志: journalctl -u $SERVICE_NAME -n 50"
fi
