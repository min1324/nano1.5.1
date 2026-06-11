# NanoCloud Docker 部署指南

## 快速开始

### 1. 使用 Docker Compose 部署（推荐）

```bash
# 构建并启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 2. 使用 Docker 命令部署

```bash
# 构建镜像
docker build -t nanocloud:latest .

# 运行容器
docker run -d \
  --name nanocloud \
  -p 8080:8080 \
  -v $(pwd)/files:/app/files \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/config.yaml:/app/config.yaml \
  --restart unless-stopped \
  nanocloud:latest
```

## 配置说明

### 端口映射
- 默认端口：8080
- 可在 `config.yaml` 中修改 `port` 配置项

### 数据持久化
- `files` 目录：存储上传的文件
- `logs` 目录：存储应用日志
- `config.yaml`：应用配置文件

### 环境变量
- `TZ=Asia/Shanghai`：时区设置（默认上海时区）

## 常用命令

```bash
# 查看容器状态
docker-compose ps

# 查看实时日志
docker-compose logs -f nanocloud

# 重启服务
docker-compose restart

# 停止并删除容器
docker-compose down

# 停止并删除容器及数据卷
docker-compose down -v
```

## 注意事项

1. 首次部署前，确保 `files` 目录存在且有正确的权限
2. 修改配置后需要重启容器才能生效
3. 默认管理员账号：root，密码：123456（请在首次登录后修改）
4. 建议定期备份 `files` 和 `config.yaml` 目录

## 故障排查

### 容器无法启动
```bash
# 查看容器日志
docker-compose logs nanocloud
```

### 文件上传失败
- 检查 `files` 目录权限
- 检查磁盘空间是否充足
- 查看 `config.yaml` 中的 `maxStorage` 配置

### 无法访问服务
- 检查端口是否被占用
- 检查防火墙设置
- 确认容器是否正常运行
