package handler

import (
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"path/filepath"

	"nano/internal/logger"
	"nano/internal/service"
)

// handleUpload 处理文件上传
func handleUpload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
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

	// 计算总大小并检查存储容量
	var totalSize int64
	for _, fh := range formFiles {
		totalSize += fh.Size
	}
	if !service.FM.HasEnoughSpace(totalSize) {
		respondWithError(w, "存储空间不足，无法上传文件", http.StatusForbidden)
		return
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
	renameMap := make(map[string]string) // 根目录重命名映射，同一批上传共享
	for _, fh := range formFiles {
		// 通过 pathMap 查找完整的相对路径
		if relPath, ok := pathMap[fh.Filename]; ok {
			fh.Filename = relPath
		}

		// 获取文件操作锁，在循环体内显式解锁
		filePath := filepath.Join(path, fh.Filename)
		unlock := service.FM.LockFile(filePath)

		if service.FM.SaveUploadedFile(fh, path, conflict, renameMap) {
			unlock()
			uploadedCount++
			logger.Info(clientIP, "上传", filePath, fh.Filename)
		} else {
			unlock()
			logger.Error(clientIP, "上传", fh.Filename, fh.Filename, nil)
		}
	}

	// 上传操作后使缓存失效
	if uploadedCount > 0 {
		service.FM.InvalidateUsedSizeCache()
	}

	if uploadedCount == 0 {
		respondWithError(w, "所有文件上传失败", http.StatusInternalServerError)
		return
	}

	logger.Info(clientIP, "上传完成", path, fmt.Sprintf("%d/%d", uploadedCount, len(formFiles)))
	respondWithSuccess(w, map[string]any{
		"uploadedCount": uploadedCount,
	})
}
