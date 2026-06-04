package handler

import (
	"encoding/json"
	"net/http"
	"path/filepath"

	"nano/internal/logger"
	"nano/internal/service"
)

// batchResult holds the result of a batch file operation
type batchResult struct {
	successCount int
	failedCount  int
	totalCount   int
}

// batchOp executes a batch file operation with path safety checks and cache invalidation
func batchOp(paths []string, opFunc func(string) bool) batchResult {
	failedCount := 0
	for _, p := range paths {
		if !service.FM.IsPathSafe(p) || !opFunc(p) {
			failedCount++
		}
	}
	if failedCount < len(paths) {
		service.FM.InvalidateUsedSizeCache()
	}
	return batchResult{
		successCount: len(paths) - failedCount,
		failedCount:  failedCount,
		totalCount:   len(paths),
	}
}

// respondBatchResult writes HTTP response based on batch operation result
func respondBatchResult(w http.ResponseWriter, result batchResult, countKey, failMsg string) {
	if result.failedCount == result.totalCount {
		respondWithError(w, failMsg, http.StatusInternalServerError)
		return
	}
	respondWithSuccess(w, map[string]any{
		countKey:      result.successCount,
		"failedCount": result.failedCount,
		"totalCount":  result.totalCount,
	})
}

// normalizePaths normalizes single path and batch paths into a single slice
func normalizePaths(paths []string, single string) []string {
	if len(paths) > 0 {
		return paths
	}
	if single != "" {
		return []string{single}
	}
	return nil
}

// handleCreateFolder creates a new folder
func handleCreateFolder(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path       string `json:"path"`
		FolderName string `json:"folderName"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, "请求格式错误", http.StatusBadRequest)
		return
	}

	if !service.FM.IsPathSafe(req.Path) || !service.FM.IsPathSafe(req.FolderName) {
		respondWithError(w, "无效的路径或文件夹名称", http.StatusBadRequest)
		return
	}

	relPath := filepath.Join(req.Path, req.FolderName)
	unlock := service.FM.LockFile(relPath)
	defer unlock()

	if err := service.FM.CreateDir(relPath); err != nil {
		logger.Error(getClientIP(r), "创建文件夹", relPath, req.FolderName, err)
		respondWithError(w, "创建文件夹失败", http.StatusInternalServerError)
		return
	}

	logger.Info(getClientIP(r), "创建文件夹", relPath, req.FolderName)
	respondWithSuccess(w, nil)
}

// handleCreateFile 创建空文件（管理员）
func handleCreateFile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path     string `json:"path"`
		FileName string `json:"fileName"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, "请求格式错误", http.StatusBadRequest)
		return
	}
	if !service.FM.IsPathSafe(req.Path) || !service.FM.IsPathSafe(req.FileName) {
		respondWithError(w, "无效的路径或文件名称", http.StatusBadRequest)
		return
	}
	relPath := filepath.Join(req.Path, req.FileName)
	unlock := service.FM.LockFile(relPath)
	defer unlock()
	if err := service.FM.WriteFile(relPath, []byte{}); err != nil {
		logger.Error(getClientIP(r), "创建文件", relPath, req.FileName, err)
		respondWithError(w, "创建文件失败", http.StatusInternalServerError)
		return
	}
	logger.Info(getClientIP(r), "创建文件", relPath, req.FileName)
	service.FM.InvalidateUsedSizeCache()
	respondWithSuccess(w, nil)
}

// handleDelete deletes files or folders (supports single and batch)
func handleDelete(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path  string   `json:"path"`
		Paths []string `json:"paths"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, "请求格式错误", http.StatusBadRequest)
		return
	}

	paths := normalizePaths(req.Paths, req.Path)
	if len(paths) == 0 {
		respondWithError(w, "未指定删除路径", http.StatusBadRequest)
		return
	}

	clientIP := getClientIP(r)
	result := batchOp(paths, func(p string) bool {
		unlock := service.FM.LockFile(p)
		if err := service.FM.Delete(p); err != nil {
			unlock()
			logger.Error(clientIP, "删除", p, filepath.Base(p), err)
			return false
		}
		unlock()
		logger.Info(clientIP, "删除", p, filepath.Base(p))
		return true
	})

	respondBatchResult(w, result, "deletedCount", "删除失败")
}

// handleMove moves files or folders (supports single and batch)
func handleMove(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SourcePath      string   `json:"sourcePath"`
		SourcePaths     []string `json:"sourcePaths"`
		DestinationPath string   `json:"destinationPath"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, "请求格式错误", http.StatusBadRequest)
		return
	}

	if !service.FM.IsPathSafe(req.DestinationPath) {
		respondWithError(w, "无效的目标路径", http.StatusBadRequest)
		return
	}

	paths := normalizePaths(req.SourcePaths, req.SourcePath)
	if len(paths) == 0 {
		respondWithError(w, "未指定源路径", http.StatusBadRequest)
		return
	}

	clientIP := getClientIP(r)
	result := batchOp(paths, func(srcPath string) bool {
		dstPath := filepath.Join(req.DestinationPath, filepath.Base(srcPath))
		first, second := srcPath, dstPath
		if first > second {
			first, second = second, first
		}
		unlockFirst := service.FM.LockFile(first)
		unlockSecond := service.FM.LockFile(second)
		if err := service.FM.Move(srcPath, dstPath); err != nil {
			unlockSecond()
			unlockFirst()
			logger.Error(clientIP, "移动", srcPath, filepath.Base(srcPath), err, dstPath)
			return false
		}
		unlockSecond()
		unlockFirst()
		logger.Info(clientIP, "移动", srcPath, filepath.Base(srcPath), dstPath)
		return true
	})

	respondBatchResult(w, result, "movedCount", "移动失败")
}

// handleCopy copies files or folders (supports single and batch)
func handleCopy(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SourcePath      string   `json:"sourcePath"`
		SourcePaths     []string `json:"sourcePaths"`
		DestinationPath string   `json:"destinationPath"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, "请求格式错误", http.StatusBadRequest)
		return
	}

	if !service.FM.IsPathSafe(req.DestinationPath) {
		respondWithError(w, "无效的目标路径", http.StatusBadRequest)
		return
	}

	paths := normalizePaths(req.SourcePaths, req.SourcePath)
	if len(paths) == 0 {
		respondWithError(w, "未指定源路径", http.StatusBadRequest)
		return
	}

	clientIP := getClientIP(r)
	result := batchOp(paths, func(srcPath string) bool {
		dstPath := filepath.Join(req.DestinationPath, filepath.Base(srcPath))
		first, second := srcPath, dstPath
		if first > second {
			first, second = second, first
		}
		unlockFirst := service.FM.LockFile(first)
		unlockSecond := service.FM.LockFile(second)
		if err := service.FM.Copy(srcPath, dstPath); err != nil {
			unlockSecond()
			unlockFirst()
			logger.Error(clientIP, "复制", srcPath, filepath.Base(srcPath), err, dstPath)
			return false
		}
		unlockSecond()
		unlockFirst()
		logger.Info(clientIP, "复制", srcPath, filepath.Base(srcPath), dstPath)
		return true
	})

	respondBatchResult(w, result, "copiedCount", "复制失败")
}

// handleRename renames a file or folder
func handleRename(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OldPath string `json:"oldPath"`
		NewName string `json:"newName"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, "请求格式错误", http.StatusBadRequest)
		return
	}

	if !service.FM.IsPathSafe(req.OldPath) || !service.FM.IsPathSafe(req.NewName) {
		respondWithError(w, "无效的路径或名称", http.StatusBadRequest)
		return
	}

	newRelPath := filepath.Join(filepath.Dir(req.OldPath), req.NewName)
	unlockOld := service.FM.LockFile(req.OldPath)
	unlockNew := service.FM.LockFile(newRelPath)
	defer unlockOld()
	defer unlockNew()

	if err := service.FM.Move(req.OldPath, newRelPath); err != nil {
		logger.Error(getClientIP(r), "重命名", req.OldPath, req.NewName, err, req.NewName)
		respondWithError(w, "重命名失败", http.StatusInternalServerError)
		return
	}

	logger.Info(getClientIP(r), "重命名", req.OldPath, req.NewName, req.NewName)
	service.FM.InvalidateUsedSizeCache()
	respondWithSuccess(w, nil)
}


// decodeJSON 解码请求体中的 JSON 数据到目标结构体
func decodeJSON(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}
