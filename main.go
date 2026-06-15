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
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"nano/internal/config"
	"nano/internal/handler"
	"nano/internal/logger"
	"nano/internal/service"
)

func main() {

	// 加载配置
	config.Load()

	// 初始化日志系统
	if err := logger.Init(config.C); err != nil {
		fmt.Printf("初始化日志系统失败: %v\n", err)
		os.Exit(1)
	}

	// 获取监听地址（默认为 0.0.0.0:8080）
	address := config.GetAddress()

	// 初始化文件管理器
	service.InitFileManager()

	// 注册 API 路由
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// 托管前端静态资源（禁用目录列表，设置缓存头）
	fileServer := http.FileServer(neuteredFileSystem{http.Dir("./static")})
	mux.Handle("/", cacheControlMiddleware(fileServer))

	// 使用带 gzip 压缩的 HTTP 处理器
	gzipHandler := gzipMiddleware(mux)
	logger.Info("system", "启动", address, config.C.UploadDir)
	fmt.Printf("服务已启动，监听地址:[%s],本机IPV4:%s\n", address, config.IP.IPv4)

	// 使用 http.Server 支持优雅关闭
	srv := &http.Server{
		Addr:         address,
		Handler:      gzipHandler,
		ReadTimeout:  10 * time.Minute,
		WriteTimeout: 10 * time.Minute,
		IdleTimeout:  120 * time.Second,
	}

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
	logger.Info("system", "关闭", "收到关闭信号，正在优雅关闭服务...", "")
	gracefulShutdown(srv)
}

// 在main.go的Shutdown流程中添加
func gracefulShutdown(srv *http.Server) {
	// 1. 停止后台任务
	handler.StopBackgroundTasks()

	// 2. 给予5秒时间完成正在处理的请求
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 3. 关闭HTTP服务器
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("服务强制关闭: %v\n", err)
	}

	// 4. 停止日志系统
	logger.Stop()

	// 5. 清理文件操作锁（可选）
	service.FM.CleanupLocks()

	fmt.Println("服务器已关闭")
}

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

// ===== gzip 压缩中间件 =====

// gzipResponseWriter 包装 http.ResponseWriter，启用 gzip 压缩
type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
	statusCode int
}

func (w *gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}

func (w *gzipResponseWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

// gzipMiddleware 对支持 gzip 的客户端启用响应压缩
// 跳过媒体文件（视频/音频/图片）和 API 预览/下载路径，
// 因为这些请求依赖 Range 头实现流式播放，gzip 会破坏字节范围定位
func gzipMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 仅对 GET 请求和接受 gzip 的客户端启用
		if r.Method != http.MethodGet {
			next.ServeHTTP(w, r)
			return
		}

		// 跳过媒体预览/下载路径 — 这些路径可能返回视频/音频流
		path := r.URL.Path
		if strings.HasPrefix(path, "/api/preview") || strings.HasPrefix(path, "/api/download") {
			next.ServeHTTP(w, r)
			return
		}

		// 跳过已知的媒体文件扩展名
		if strings.HasSuffix(path, ".mp4") || strings.HasSuffix(path, ".webm") ||
			strings.HasSuffix(path, ".ogg") || strings.HasSuffix(path, ".mov") ||
			strings.HasSuffix(path, ".avi") || strings.HasSuffix(path, ".mkv") ||
			strings.HasSuffix(path, ".mp3") || strings.HasSuffix(path, ".wav") ||
			strings.HasSuffix(path, ".flac") || strings.HasSuffix(path, ".aac") ||
			strings.HasSuffix(path, ".jpg") || strings.HasSuffix(path, ".jpeg") ||
			strings.HasSuffix(path, ".png") || strings.HasSuffix(path, ".gif") ||
			strings.HasSuffix(path, ".webp") || strings.HasSuffix(path, ".ico") ||
			strings.HasSuffix(path, ".svg") {
			next.ServeHTTP(w, r)
			return
		}

		acceptEncoding := r.Header.Get("Accept-Encoding")
		if !strings.Contains(acceptEncoding, "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		gz, err := gzip.NewWriterLevel(w, gzip.BestSpeed)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}
		defer gz.Close()

		gzw := &gzipResponseWriter{
			Writer:         gz,
			ResponseWriter: w,
		}
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Del("Content-Length")

		next.ServeHTTP(gzw, r)
	})
}

// cacheControlMiddleware 为静态资源添加缓存控制头
// HTML：no-cache（确保即时更新），JS/CSS/图片：1 天缓存
func cacheControlMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 设置适用于所有静态资源的缓存头
		w.Header().Set("Vary", "Accept-Encoding")

		// 根据文件类型设置不同的缓存策略
		if strings.HasSuffix(r.URL.Path, ".html") {
			w.Header().Set("Cache-Control", "no-cache, must-revalidate")
		} else if strings.HasSuffix(r.URL.Path, ".js") ||
			strings.HasSuffix(r.URL.Path, ".css") ||
			strings.HasSuffix(r.URL.Path, ".png") ||
			strings.HasSuffix(r.URL.Path, ".jpg") ||
			strings.HasSuffix(r.URL.Path, ".svg") ||
			strings.HasSuffix(r.URL.Path, ".ico") {
			w.Header().Set("Cache-Control", "public, max-age=86400")
		}

		next.ServeHTTP(w, r)
	})
}
