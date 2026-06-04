package handler

import (
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"nano/internal/logger"
	"nano/internal/service"
)

// 全局重命名映射，用于跨批次上传时保持文件夹结构一致
// key: 会话ID:原始文件夹名, value: 重命名后的文件夹名
var (
	globalRenameMap      = make(map[string]string)
	renameMapMutex       sync.RWMutex
	renameMapLastUpdated time.Time
)

// 清理过期的重命名映射（超过1小时未使用）
func cleanupExpiredRenameMaps() {
	renameMapMutex.Lock()
	defer renameMapMutex.Unlock()

	now := time.Now()
	if now.Sub(renameMapLastUpdated) > time.Hour {
		globalRenameMap = make(map[string]string)
		renameMapLastUpdated = now
	}
}

// 初始化时启动清理任务
func init() {
	go func() {
		for {
			time.Sleep(time.Hour)
			cleanupExpiredRenameMaps()
		}
	}()
}

// handleUpload 处理文件上传
func handleUpload(w http.ResponseWriter, r *http.Request) {
	// 增加内存限制以支持更多文件上传，但使用流式处理避免内存溢出
	if err := r.ParseMultipartForm(128 << 20); err != nil {
		respondWithError(w, "解析表单失败", http.StatusBadRequest)
		return
	}

	path := r.FormValue("path")
	if !service.FM.IsPathSafe(path) {
		respondWithError(w, "无效的路径", http.StatusBadRequest)
		return
	}

	// 获取冲突策略：rename(自动重命名), overwrite(覆盖), skip(跳过)
	conflict := r.FormValue("conflict")
	if conflict != "overwrite" && conflict != "skip" {
		conflict = "rename" // 默认自动重命名
	}

	formFiles := r.MultipartForm.File["files"]
	if len(formFiles) == 0 {
		file, handler, err := r.FormFile("file")
		if err != nil {
			respondWithError(w, "未提供文件", http.StatusBadRequest)
			return
		}
		if err := file.Close(); err != nil {
			logger.Error(getClientIP(r), "关闭文件", handler.Filename, handler.Filename, err)
		}
		formFiles = []*multipart.FileHeader{handler}
	}

	// 获取路径映射
	// Go 的 multipart 解析器会自动对 fh.Filename 调用 filepath.Base()，丢弃目录部分
	// 因此前端通过 pathMap 字段传递 JSON 格式的 {indexedName: relativePath} 映射
	pathMap := make(map[string]string)
	if pathMapStr := r.FormValue("pathMap"); pathMapStr != "" {
		json.Unmarshal([]byte(pathMapStr), &pathMap)
	}

	clientIP := getClientIP(r)
	uploadedCount := 0
	failedCount := 0

	// 获取上传会话ID，用于隔离不同上传操作的重命名映射
	uploadSessionID := r.FormValue("uploadSessionId")
	if uploadSessionID == "" {
		uploadSessionID = fmt.Sprintf("%d", time.Now().UnixNano())
	}

	// 使用全局重命名映射，确保跨批次的文件夹结构一致
	// 这里的key是"会话ID:原始文件夹名"，value是重命名后的文件夹名
	renameMapMutex.Lock()
	renameMapLastUpdated = time.Now()
	renameMapMutex.Unlock()

	// 获取当前会话的重命名映射
	renameMap := make(map[string]string)
	renameMapMutex.RLock()
	prefix := uploadSessionID + ":"
	for k, v := range globalRenameMap {
		if strings.HasPrefix(k, prefix) {
			// 去掉会话ID前缀，只保留文件夹名
			folderName := k[len(prefix):]
			renameMap[folderName] = v
		}
	}
	renameMapMutex.RUnlock()

	// 分批处理文件，避免一次性加载过多数据
	batchSize := 100 // 每批处理100个文件
	totalBatches := (len(formFiles) + batchSize - 1) / batchSize

	for batch := 0; batch < totalBatches; batch++ {
		start := batch * batchSize
		end := start + batchSize
		if end > len(formFiles) {
			end = len(formFiles)
		}

		// 计算当前批次文件总大小并检查存储容量
		var batchTotalSize int64
		for i := start; i < end; i++ {
			batchTotalSize += formFiles[i].Size
		}
		if !service.FM.HasEnoughSpace(batchTotalSize) {
			respondWithError(w, "存储空间不足，无法上传文件", http.StatusForbidden)
			return
		}

		// 处理当前批次
		for i := start; i < end; i++ {
			fh := formFiles[i]

			// 通过 pathMap 查找完整的相对路径
			if relPath, ok := pathMap[fh.Filename]; ok {
				fh.Filename = relPath
			}

			// 获取文件操作锁，在循环体内显式解锁
			filePath := filepath.Join(path, fh.Filename)
			unlock := service.FM.LockFile(filePath)

			// 使用共享的renameMap确保所有批次使用相同的重命名映射
			if service.FM.SaveUploadedFile(fh, path, conflict, renameMap) {
				unlock()
				uploadedCount++
				logger.Info(clientIP, "上传", filePath, fh.Filename)
			} else {
				unlock()
				failedCount++
				logger.Error(clientIP, "上传", fh.Filename, fh.Filename, nil)
			}
		}

		// 每批次完成后更新缓存
		if uploadedCount > 0 {
			service.FM.InvalidateUsedSizeCache()
		}
	}

	// 上传完成后，更新全局重命名映射
	renameMapMutex.Lock()
	prefix = uploadSessionID + ":"
	for k, v := range renameMap {
		globalRenameMap[prefix+k] = v
	}
	renameMapMutex.Unlock()

	if uploadedCount == 0 {
		respondWithError(w, "所有文件上传失败", http.StatusInternalServerError)
		return
	}

	logger.Info(clientIP, "上传完成", path, fmt.Sprintf("成功:%d, 失败:%d, 总计:%d", uploadedCount, failedCount, len(formFiles)))
	respondWithSuccess(w, map[string]any{
		"uploadedCount": uploadedCount,
		"failedCount":   failedCount,
		"totalCount":    len(formFiles),
	})
}
