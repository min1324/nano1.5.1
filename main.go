/**
 * NanoCloud - 轻量级文件管理系统
 *
 * 前后端分离架构，后端提供 API 服务，同时托管前端静态资源。
 * 前端通过 API_BASE 变量配置后端地址（同源部署时留空）。
 * 通过 CORS 中间件支持跨域访问，前端也可独立部署到其他域名/端口。
 *
 * 部署方式：
 *   1. 同源部署（默认）
 *      - 后端直接托管前端静态资源
 *      - 前端 app.js 中 API_BASE 留空
 *      - 部署时需要确保 static 目录与可执行文件在同一目录
 *
 *   2. 跨域独立部署
 *      - 前端部署到独立的 Web 服务器（如 Nginx）
 *      - 修改 app.js 中的 API_BASE 为后端地址
 *      - 后端通过 CORS 中间件自动允许跨域请求
 *
 * 项目结构：
 *   main.go                        - 入口文件
 *   config.yaml                    - 配置文件
 *   internal/
 *     ├── config/config.go         - 配置加载、解析与用户管理
 *     ├── handler/
 *     │   ├── routes.go            - API 路由注册与方法守卫
 *     │   ├── auth.go              - 用户认证（登录/登出/令牌验证）
 *     │   ├── list.go              - 文件列表查询
 *     │   ├── upload.go            - 文件上传
 *     │   ├── file_ops.go          - 文件操作（创建/删除/移动/复制/重命名）
 *     │   ├── preview.go           - 文件预览
 *     │   ├── download.go          - 文件下载（单文件/批量/目录ZIP/下载页面）
 *     │   ├── editor.go            - 文件在线编辑（读取/保存）
 *     │   ├── search.go            - 文件搜索
 *     │   ├── security.go          - 安全配置与用户管理（管理员）
 *     │   ├── server_info.go       - 服务器信息与存储空间
 *     │   ├── mime.go              - MIME 类型映射
 *     │   ├── response.go          - 统一响应处理
 *     │   └── util.go              - 通用工具函数
 *     ├── logger/logger.go         - 日志系统
 *     ├── middleware/
 *     │   ├── auth.go              - 认证与权限中间件
 *     │   └── cors.go              - CORS 跨域中间件
 *     ├── model/
 *     │   ├── response.go          - API 响应结构
 *     │   └── user.go              - 用户模型与存储
 *     └── service/file_manager.go  - 文件管理器（并发安全 + 存储缓存 + 路径安全）
 *   static/                        - 前端静态资源（index.html、app.js、style.css、download.html）
 *   logs/                          - 日志目录（运行时自动创建）
 *   files/                         - 文件存储目录（运行时自动创建）
 *
 * API 路由一览：
 *   GET  /api/list          - 列出指定目录下的文件和文件夹
 *   POST /api/upload        - 上传文件（支持子路径保持文件夹结构）
 *   POST /api/create-folder - 创建文件夹
 *   DELETE /api/delete      - 删除文件或文件夹
 *   POST /api/move          - 移动文件或文件夹
 *   POST /api/copy          - 复制文件或文件夹
 *   GET  /api/download      - 下载文件
 *   GET  /api/preview       - 预览文件
 *   POST /api/rename        - 重命名文件或文件夹
 *   GET  /api/storage       - 获取存储空间使用情况
 *   GET  /api/file-content  - 获取文件内容（用于在线编辑）
 *   POST /api/save-file     - 保存文件内容（用于在线编辑）
 */
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"nano/internal/config"
	"nano/internal/handler"
	"nano/internal/logger"
	"nano/internal/service"
)

// neuteredFileSystem 禁用目录列表的文件系统包装器
type neuteredFileSystem struct {
	fs http.FileSystem
}

func (nfs neuteredFileSystem) Open(name string) (http.File, error) {
	f, err := nfs.fs.Open(name)
	if err != nil {
		return nil, err
	}
	stat, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	if stat.IsDir() {
		return noDirListingFile{f}, nil
	}
	return f, nil
}

// noDirListingFile 包装 http.File，禁止目录列表（Readdir 返回空）
type noDirListingFile struct {
	http.File
}

func (f noDirListingFile) Readdir(count int) ([]os.FileInfo, error) {
	return nil, nil
}

func main() {
	// 加载配置
	config.Load()

	config.InitUsers()

	// 初始化日志系统
	if err := logger.Init(
		config.C.LogDir,
		config.C.LogLevel,
		config.C.LogMaxSizeBytes,
		config.C.LogMaxBackups,
		config.C.LogMaxAge,
	); err != nil {
		fmt.Printf("初始化日志系统失败: %v\n", err)
		os.Exit(1)
	}
	defer logger.Stop()

	// 获取监听地址（默认为 0.0.0.0:8080）
	address := config.GetAddress()

	// 初始化文件管理器
	service.InitFileManager()

	// 注册 API 路由
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// 托管前端静态资源（禁用目录列表）
	fileServer := http.FileServer(neuteredFileSystem{http.Dir("./static")})
	mux.Handle("/", fileServer)

	logger.Info("system", "启动", address, config.C.UploadDir)
	fmt.Printf("服务已启动，监听地址: %s\n", address)

	// 使用 http.Server 支持优雅关闭
	srv := &http.Server{Addr: address, Handler: mux}

	// 在 goroutine 中启动服务
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("服务启动失败: %v\n", err)
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("system", "关闭", "正在停止服务...", "")
	fmt.Println("\n正在停止服务...")

	// 给予 5 秒时间完成正在处理的请求
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("服务强制关闭: %v\n", err)
	}

	fmt.Println("服务已停止")
}
