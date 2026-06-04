package handler

import (
	"encoding/json"
	"net/http"
	"path/filepath"

	"nano/internal/logger"
	"nano/internal/service"
)

// batchResult 批量文件操作结果
//
// 用于记录批量操作的成功和失败统计
type batchResult struct {
	successCount int // 成功操作的数量
	failedCount  int // 失败操作的数量
	totalCount   int // 总操作数量
}

// batchOp 执行批量文件操作
//
// 参数：
//   - paths: 要操作的文件路径列表
//   - opFunc: 操作函数，返回 true 表示成功，false 表示失败
//
// 返回值：
//   - batchResult: 包含成功和失败统计的结果对象
//
// 功能：
//   - 对每个路径执行路径安全检查
//   - 调用操作函数执行实际操作
//   - 如果有操作成功，使存储空间缓存失效
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

// respondBatchResult 根据批量操作结果写入HTTP响应
//
// 参数：
//   - w: HTTP响应写入器
//   - result: 批量操作结果
//   - countKey: 成功计数的响应字段名
//   - failMsg: 全部失败时的错误消息
//
// 功能：
//   - 如果全部失败，返回错误响应
//   - 否则返回包含统计信息的成功响应
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

// normalizePaths 标准化路径参数
//
// 参数：
//   - paths: 批量路径数组
//   - single: 单一路径字符串
//
// 返回值：
//   - 统一后的路径切片
//
// 功能：
//   - 优先返回批量路径数组
//   - 如果批量路径为空，返回包含单一路径的数组
//   - 如果都为空，返回 nil
func normalizePaths(paths []string, single string) []string {
	if len(paths) > 0 {
		return paths
	}
	if single != "" {
		return []string{single}
	}
	return nil
}

// handleCreateFolder 创建新文件夹
//
// 请求参数：
//   - path: 父目录路径
//   - folderName: 文件夹名称
//
// 错误处理：
//   - 路径不安全时返回 400 错误
//   - 创建失败时返回 500 错误
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

// handleCreateFile 创建空文件
//
// 请求参数：
//   - path: 父目录路径
//   - fileName: 文件名称
//
// 错误处理：
//   - 路径不安全时返回 400 错误
//   - 创建失败时返回 500 错误
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
