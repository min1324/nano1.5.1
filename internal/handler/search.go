package handler

import (
	"net/http"
	"strconv"

	"nano/internal/service"
)

// handleSearch 搜索文件
//
// 请求参数：
//   - q: 搜索关键词（必填）
//   - path: 搜索路径，为空时默认为根目录"/"
//   - recursive: 是否递归搜索子目录，默认为 true
//
// 响应数据：
//   - files: 匹配的文件项列表
//   - query: 搜索关键词
//   - path: 搜索路径
//   - count: 匹配的文件数量
//
// 错误处理：
//   - 搜索关键词为空时返回 400 错误
//   - 路径不安全时返回 400 错误
//   - 搜索失败时返回 500 错误
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
