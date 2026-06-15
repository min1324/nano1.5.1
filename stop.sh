#!/usr/bin/env bash
# NanoCloud - 停止服务
set -euo pipefail

SERVICE_NAME="nanocloud"

if ! systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "NanoCloud 未在运行"
    exit 0
fi

sudo systemctl stop "$SERVICE_NAME"
sleep 1

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "✗ 停止失败，请手动检查: sudo systemctl status $SERVICE_NAME"
else
    echo "✓ NanoCloud 已停止"
fi
