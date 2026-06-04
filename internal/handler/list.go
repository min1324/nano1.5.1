package handler

import (
	"net/http"
	"path/filepath"

	"nano/internal/service"
)

// handleList 列出指定目录下的文件和文件夹。
//
// 请求参数：
//   - path: 目录路径，为空时默认为根目录"/"
//
// 响应数据：
//   - files: 文件项列表，包含名称、路径、大小、修改时间等信息
//   - currentPath: 当前目录路径
//   - parentPath: 父目录路径，根目录时为空字符串
//
// 错误处理：
//   - 路径不安全时返回 400 错误
//   - 读取目录失败时返回 500 错误
func handleList(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		path = "/"
	}

	if !service.FM.IsPathSafe(path) {
		respondWithError(w, "无效的路径", http.StatusBadRequest)
		return
	}

	fileItems, err := service.FM.ListDir(path)
	if err != nil {
		respondWithError(w, "无法读取目录", http.StatusInternalServerError)
		return
	}

	parentPath := filepath.ToSlash(filepath.Dir(path))
	if parentPath == "." || parentPath == "/" {
		parentPath = ""
	}

	respondWithSuccess(w, map[string]any{
		"files":       fileItems,
		"currentPath": path,
		"parentPath":  parentPath,
	})
}
