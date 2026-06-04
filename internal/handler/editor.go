package handler

import (
	"net/http"
	"path/filepath"

	"nano/internal/logger"
	"nano/internal/service"
)

// handleFileContent 获取文件内容用于在线编辑，受 previewMaxSize 大小限制（管理员）。
func handleFileContent(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		respondWithError(w, "路径不能为空", http.StatusBadRequest)
		return
	}
	if !service.FM.IsPathSafe(path) {
		respondWithError(w, "无效的路径", http.StatusBadRequest)
		return
	}

	info, err := service.FM.Stat(path)
	if err != nil {
		respondWithError(w, "文件不存在", http.StatusNotFound)
		return
	}
	if info.IsDir() {
		respondWithError(w, "无法编辑目录", http.StatusBadRequest)
		return
	}
	if info.Size() > service.FM.GetPreviewMaxSize() {
		respondWithError(w, "文件过大，不支持在线编辑", http.StatusBadRequest)
		return
	}

	content, err := service.FM.ReadFile(path)
	if err != nil {
		respondWithError(w, "读取文件失败", http.StatusInternalServerError)
		return
	}

	respondWithSuccess(w, map[string]any{
		"content": string(content),
	})
}

// handleSaveFile 保存在线编辑的文件内容，检查存储空间并使缓存失效（管理员）。
func handleSaveFile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, "请求格式错误", http.StatusBadRequest)
		return
	}

	if !service.FM.IsPathSafe(req.Path) {
		respondWithError(w, "无效的路径", http.StatusBadRequest)
		return
	}

	info, err := service.FM.Stat(req.Path)
	if err != nil {
		respondWithError(w, "文件不存在", http.StatusNotFound)
		return
	}
	if info.IsDir() {
		respondWithError(w, "无法编辑目录", http.StatusBadRequest)
		return
	}

	// 获取文件操作锁
	unlock := service.FM.LockFile(req.Path)
	defer unlock()

	// 检查存储容量
	newSize := int64(len(req.Content))
	if !service.FM.HasEnoughSpace(newSize - info.Size()) {
		respondWithError(w, "存储空间不足，无法保存文件", http.StatusForbidden)
		return
	}

	if err := service.FM.WriteFile(req.Path, []byte(req.Content)); err != nil {
		logger.Error(getClientIP(r), "保存文件", req.Path, filepath.Base(req.Path), err)
		respondWithError(w, "保存文件失败", http.StatusInternalServerError)
		return
	}

	logger.Info(getClientIP(r), "保存文件", req.Path, filepath.Base(req.Path))

	// 保存文件后使缓存失效
	service.FM.InvalidateUsedSizeCache()

	respondWithSuccess(w, nil)
}
