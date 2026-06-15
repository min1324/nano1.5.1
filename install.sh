#!/usr/bin/env bash
# =========================================================
# NanoCloud - 轻量级私有云文件管理系统
# Linux 一键安装脚本
# 功能：编译 → 安装到系统 → 注册 systemd 服务 → 开机自启
# 使用: sudo bash install.sh
# =========================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

log_info()  { echo -e "${CYAN}[信息]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[成功]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[注意]${NC} $1"; }
log_err()   { echo -e "${RED}[错误]${NC} $1"; }

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║     NanoCloud 一键安装程序 (Linux)       ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# ─── 检查 root 权限 ──────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    log_warn "安装需要 root 权限，正在通过 sudo 重新执行..."
    exec sudo bash "$0" "$@"
fi
log_ok "已获取 root 权限"
echo ""

# ─── 全局路径 ─────────────────────────────────────
INSTALL_BIN="/usr/local/bin/nanocloud"
INSTALL_DIR="/usr/local/share/nanocloud"
SERVICE_FILE="/etc/systemd/system/nanocloud.service"
SERVICE_NAME="nanocloud"

# ─── 1. 检查前端资源 ─────────────────────────────
log_info "[1/7] 检查前端静态资源..."
for f in static/index.html static/app.js; do
    if [ ! -f "$f" ]; then
        log_err "缺少 $f，请确认项目完整"
        exit 1
    fi
done
log_ok "前端资源完整"
echo ""

# ─── 2. 检查/创建配置文件 ────────────────────────
log_info "[2/7] 检查配置文件..."
if [ -f "config.yaml" ]; then
    log_ok "检测到现有配置文件 config.yaml"
else
    echo -n "  请输入监听端口 (默认 8080): "; read -r CFG_PORT; CFG_PORT=${CFG_PORT:-8080}
    echo -n "  请输入存储空间上限 (默认 10GB): "; read -r CFG_STORAGE; CFG_STORAGE=${CFG_STORAGE:-10GB}
    cat > config.yaml <<EOF
port: :${CFG_PORT}
uploadDir: ./files
maxStorage: "${CFG_STORAGE}"
previewMaxSize: 10MB
logDir: ./logs
logLevel: info
logMaxSize: 100MB
logMaxBackups: 7
logMaxAge: 30
users:
    - username: root
      password: "123456"
      type: root
      displayName: Root
EOF
    log_ok "配置文件已创建 (默认密码: 123456)"
fi

# 读取端口
APP_PORT=$(grep -E "^port:" config.yaml | sed 's/port: *://' | tr -d ' ')
APP_PORT=${APP_PORT:-8080}
echo ""

# ─── 3. 检查端口 ─────────────────────────────────
log_info "[3/7] 检查端口 ${APP_PORT} 占用..."
if ss -tlnp "sport = :${APP_PORT}" 2>/dev/null | grep -q LISTEN; then
    log_warn "端口 ${APP_PORT} 已被占用！请修改 config.yaml 中的 port"
    exit 1
fi
log_ok "端口 ${APP_PORT} 可用"
echo ""

# ─── 4. 编译 ─────────────────────────────────────
log_info "[4/7] 编译项目..."
if ! command -v go &>/dev/null; then
    log_err "未找到 Go 编译器，请安装 Go 1.16+"
    log_info "  Ubuntu/Debian: sudo apt install golang-go"
    log_info "  CentOS/RHEL:   sudo yum install golang"
    exit 1
fi
log_ok "Go 环境: $(go version)"

log_info "正在编译，请稍候..."
CGO_ENABLED=0 go build -ldflags="-s -w" -o nanocloud .
log_ok "编译成功: nanocloud"
chmod +x nanocloud
echo ""

# ─── 5. 安装到系统 ───────────────────────────────
log_info "[5/7] 安装到系统目录..."

# 停止旧服务
systemctl stop "$SERVICE_NAME" 2>/dev/null || true

# 创建安装目录
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/files"
mkdir -p "$INSTALL_DIR/logs"

# 复制文件
cp -f nanocloud "$INSTALL_BIN"
cp -rf static "$INSTALL_DIR/static"
cp -f config.yaml "$INSTALL_DIR/config.yaml"

chmod 755 "$INSTALL_BIN"
chmod 644 "$INSTALL_DIR/config.yaml"

log_ok "二进制: $INSTALL_BIN"
log_ok "数据目录: $INSTALL_DIR"
echo ""

# ─── 6. 注册 systemd 服务 ────────────────────────
log_info "[6/7] 注册 systemd 服务（开机自启）..."

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=NanoCloud - 轻量级私有云文件管理系统
Documentation=https://github.com/nanocloud
After=network.target

[Service]
Type=simple
User=nobody
Group=nogroup
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_BIN}
Restart=on-failure
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
log_ok "systemd 服务已注册并启用开机自启"
echo ""

# ─── 7. 启动服务 + 防火墙 ────────────────────────
log_info "[7/7] 启动服务..."

systemctl start "$SERVICE_NAME"
sleep 2

if systemctl is-active --quiet "$SERVICE_NAME"; then
    log_ok "服务已启动"
else
    log_warn "服务启动失败，请查看日志: journalctl -u $SERVICE_NAME -n 50"
fi

# 防火墙
if command -v firewall-cmd &>/dev/null; then
    if ! firewall-cmd --list-ports 2>/dev/null | grep -q "${APP_PORT}/tcp"; then
        firewall-cmd --zone=public --add-port="${APP_PORT}/tcp" --permanent 2>/dev/null || true
        firewall-cmd --reload 2>/dev/null || true
        log_ok "firewalld 端口 ${APP_PORT} 已放行"
    fi
elif command -v ufw &>/dev/null; then
    if ! ufw status | grep -q "${APP_PORT}/tcp"; then
        ufw allow "${APP_PORT}/tcp" 2>/dev/null || true
        log_ok "ufw 端口 ${APP_PORT} 已放行"
    fi
fi
echo ""

# ─── 完成 ─────────────────────────────────────────
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════╗"
echo "║      安装完成！                          ║"
echo "╠══════════════════════════════════════════╣"
echo "║  访问地址: http://localhost:${APP_PORT}           ║"
echo "║  管理员:   root                         ║"
echo "║  默认密码: 123456                       ║"
echo "╠══════════════════════════════════════════╣"
echo "║  管理命令:                              ║"
echo "║    sudo systemctl start nanocloud       ║"
echo "║    sudo systemctl stop nanocloud        ║"
echo "║    sudo systemctl status nanocloud      ║"
echo "║    sudo systemctl restart nanocloud     ║"
echo "║                                          ║"
echo "║  管理脚本:                              ║"
echo "║    bash start.sh    - 启动              ║"
echo "║    bash stop.sh     - 停止              ║"
echo "║    bash status.sh   - 查看状态          ║"
echo "║    bash uninstall.sh - 卸载             ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "${YELLOW}安全提示: 首次登录后请立即修改默认密码！${NC}"
echo ""
