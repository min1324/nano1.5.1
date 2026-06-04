package handler

import (
	"net/http"
	"strconv"

	"nano/internal/service"
)

// handleSearch 搜索文件
func handleSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		respondWithError(w, "搜索关键词不能为空", http.StatusBadRequest)
		return
	}

	path := r.URL.Query().Get("path")
	if path == "" {
		path = "/"
	}

	// 获取递归搜索参数，默认为true
	recursiveStr := r.URL.Query().Get("recursive")
	recursive := true
	if recursiveStr != "" {
		var err error
		recursive, err = strconv.ParseBool(recursiveStr)
		if err != nil {
			recursive = true
		}
	}

	if !service.FM.IsPathSafe(path) {
		respondWithError(w, "无效的路径", http.StatusBadRequest)
		return
	}

	fileItems, err := service.FM.SearchFiles(query, path, recursive)
	if err != nil {
		respondWithError(w, "搜索失败: "+err.Error(), http.StatusInternalServerError)
		return
	}

	respondWithSuccess(w, map[string]any{
		"files":    fileItems,
		"query":    query,
		"path":     path,
		"count":    len(fileItems),
	})
}
