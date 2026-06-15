#!/usr/bin/env bash
# =========================================================
# NanoCloud - Linux 卸载脚本
# 功能：停止服务 → 禁用开机自启 → 删除服务文件 → 删除文件
# 使用: sudo bash uninstall.sh
# =========================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log_info() { echo -e "${CYAN}[信息]${NC} $1"; }
log_ok()   { echo -e "${GREEN}[成功]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[注意]${NC} $1"; }

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║     NanoCloud 卸载程序 (Linux)           ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ─── 检查 root ──────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    log_warn "卸载需要 root 权限，正在通过 sudo 重新执行..."
    exec sudo bash "$0" "$@"
fi
log_ok "已获取 root 权限"
echo ""

SERVICE_NAME="nanocloud"
INSTALL_BIN="/usr/local/bin/nanocloud"
INSTALL_DIR="/usr/local/share/nanocloud"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# ─── 1. 停止服务 ────────────────────────────────
log_info "[1/5] 停止服务..."
systemctl stop "$SERVICE_NAME" 2>/dev/null && log_ok "服务已停止" || log_info "服务未运行"
echo ""

# ─── 2. 禁用并删除服务 ──────────────────────────
log_info "[2/5] 禁用并删除 systemd 服务..."
systemctl disable "$SERVICE_NAME" 2>/dev/null || true
rm -f "$SERVICE_FILE"
systemctl daemon-reload
log_ok "systemd 服务已删除"
echo ""

# ─── 3. 删除二进制 ──────────────────────────────
log_info "[3/5] 删除二进制文件..."
rm -f "$INSTALL_BIN"
log_ok "已删除: $INSTALL_BIN"
echo ""

# ─── 4. 删除数据目录 ────────────────────────────
log_info "[4/5] 数据目录处理..."
if [ -d "$INSTALL_DIR" ]; then
    echo -n "是否保留用户文件 (files/ 下的上传文件)? [Y/n]: "
    read -r KEEP_FILES
    if [[ "$KEEP_FILES" =~ ^[Nn] ]]; then
        rm -rf "$INSTALL_DIR"
        log_ok "数据目录已完全删除: $INSTALL_DIR"
    else
        # 备份 files 目录
        if [ -d "$INSTALL_DIR/files" ] && [ "$(ls -A "$INSTALL_DIR/files" 2>/dev/null)" ]; then
            BACKUP_DIR="$HOME/NanoCloud_Backup_$(date +%Y%m%d_%H%M%S)"
            mkdir -p "$BACKUP_DIR"
            cp -r "$INSTALL_DIR/files" "$BACKUP_DIR/"
            log_ok "用户文件已备份到: $BACKUP_DIR/files"
        fi
        rm -rf "$INSTALL_DIR"
        log_ok "数据目录已删除（用户文件已备份）"
    fi
else
    log_info "数据目录不存在"
fi
echo ""

# ─── 5. 清理当前目录编译产物 ─────────────────
log_info "[5/5] 清理当前目录编译产物..."
rm -f nanocloud
log_ok "清理完成"
echo ""

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════╗"
echo "║     卸载完成！                           ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"
