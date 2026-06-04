package handler

import (
	"net/http"
	"path/filepath"

	"nano/internal/service"
)

// handleList 列出指定目录下的文件和文件夹
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
