package handler

import (
	"net/http"
	"path/filepath"
	"strings"

	"nano/internal/service"
)

// handlePreview 预览文件，根据扩展名设置 Content-Type，以 inline 方式返回文件内容。
// 使用 http.ServeContent 自动支持 Range 请求、ETag 缓存协商和内容类型检测，
// 确保视频/音频等媒体文件可以正确加载和拖动进度条。
func handlePreview(w http.ResponseWriter, r *http.Request) {
	path, err := requireFilePath(w, r)
	if err != nil {
		return
	}

	info, err := service.FM.Stat(path)
	if err != nil {
		respondWithError(w, "文件不存在", http.StatusNotFound)
		return
	}
	if info.IsDir() {
		respondWithError(w, "无法预览目录", http.StatusBadRequest)
		return
	}

	f, err := service.FM.OpenFile(path)
	if err != nil {
		respondWithError(w, "无法打开文件", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	fullPath := service.FM.FullPath(path)
	contentType := getContentType(fullPath)

	// 设置 Content-Disposition 为 inline，使浏览器内联显示而非下载
	w.Header().Set("Content-Disposition", `inline; filename="`+filepath.Base(path)+`"`)

	// 对于媒体文件，设置适当的缓存策略以支持视频缓冲和拖动进度条
	// 对于非媒体文件，禁止缓存以防止浏览器使用旧的错误缓存
	if strings.HasPrefix(contentType, "video/") || strings.HasPrefix(contentType, "audio/") {
		// 媒体文件允许缓存，支持视频缓冲
		w.Header().Set("Cache-Control", "public, max-age=3600")
	} else {
		// no-cache 表示每次使用前必须重新验证，但仍允许本地存储
		w.Header().Set("Cache-Control", "no-cache")
	}

	// 预先设置自定义 Content-Type，确保视频等媒体文件使用正确的 MIME 类型
	// http.ServeContent 在响应头中已有 Content-Type 时不会覆盖
	w.Header().Set("Content-Type", contentType)

	// 使用 http.ServeContent 自动处理 Range 请求、ETag/If-None-Match 缓存协商
	// 它会根据请求头自动返回 206 Partial Content 或 304 Not Modified
	http.ServeContent(w, r, filepath.Base(path), info.ModTime(), f)
}

// requireFilePath 从查询参数获取并校验文件路径
func requireFilePath(w http.ResponseWriter, r *http.Request) (string, error) {
	path := r.URL.Query().Get("path")
	if path == "" {
		respondWithError(w, "路径不能为空", http.StatusBadRequest)
		return "", errBadRequest
	}
	if !service.FM.IsPathSafe(path) {
		respondWithError(w, "无效的路径", http.StatusBadRequest)
		return "", errBadRequest
	}
	return path, nil
}
