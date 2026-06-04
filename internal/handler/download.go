package handler

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"nano/internal/logger"
	"nano/internal/service"
)

// 文件复制缓冲区大小
const (
	bufferSize = 32 * 1024 // 32KB
)

// 缓冲区池，用于并发安全的缓冲区管理
var bufferPool = sync.Pool{
	New: func() interface{} {
		return make([]byte, bufferSize)
	},
}

// getBuffer 从池中获取缓冲区
func getBuffer() []byte {
	return bufferPool.Get().([]byte)
}

// putBuffer 将缓冲区放回池中
func putBuffer(buf []byte) {
	bufferPool.Put(buf)
}


// handleDownload 下载文件或目录。目录自动打包为 ZIP，单文件支持 asZip 参数打包。
func handleDownload(w http.ResponseWriter, r *http.Request) {
	path, err := requireFilePath(w, r)
	if err != nil {
		return
	}

	info, err := service.FM.Stat(path)
	if err != nil {
		respondWithError(w, "文件不存在", http.StatusNotFound)
		return
	}

	// 检查是否请求目录下载为zip
	asZip := r.URL.Query().Get("asZip")

	if info.IsDir() {
		// 目录下载：打包为zip
		zipName := info.Name() + ".zip"
		w.Header().Set("Content-Disposition", "attachment; filename="+zipName)
		w.Header().Set("Content-Type", "application/zip")

		zipWriter := zip.NewWriter(w)
		defer zipWriter.Close()

		fullPath := service.FM.FullPath(path)
		if err := addDirToZip(zipWriter, fullPath, info.Name()); err != nil {
			return
		}

		return
	}

	// asZip参数也可以用于单个文件
	if asZip == "true" {
		zipName := info.Name() + ".zip"
		w.Header().Set("Content-Disposition", "attachment; filename="+zipName)
		w.Header().Set("Content-Type", "application/zip")

		zipWriter := zip.NewWriter(w)
		defer zipWriter.Close()

		f, err := service.FM.OpenFile(path)
		if err != nil {
			respondWithError(w, "无法打开文件", http.StatusInternalServerError)
			return
		}
		defer f.Close()

		zw, err := zipWriter.Create(info.Name())
		if err != nil {
			respondWithError(w, "创建zip条目失败", http.StatusInternalServerError)
			return
		}

		// 使用缓冲区提高复制性能
		buf := getBuffer()
		defer putBuffer(buf)
		_, err = io.CopyBuffer(zw, f, buf)
		if err != nil {
			logger.Error(getClientIP(r), "下载目录", path, filepath.Base(path), err)
			return
		}

		logger.Info(getClientIP(r), "下载目录", path, filepath.Base(path))
		return
	}

	// 普通文件下载
	f, err := service.FM.OpenFile(path)
	if err != nil {
		respondWithError(w, "无法打开文件", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(path))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	logger.Info(getClientIP(r), "下载文件", path, filepath.Base(path))
	
	// 使用缓冲区提高复制性能
	buf := getBuffer()
	defer putBuffer(buf)
	io.CopyBuffer(w, f, buf)
}

// handleBatchDownload 批量下载文件，支持 GET（逗号分隔路径）和 POST（JSON 路径数组），统一打包为 ZIP。
func handleBatchDownload(w http.ResponseWriter, r *http.Request) {
	var paths []string

	if r.Method == http.MethodGet {
		// GET请求：从query参数获取paths（逗号分隔）
		pathsParam := r.URL.Query().Get("paths")
		if pathsParam == "" {
			respondWithError(w, "未指定下载文件", http.StatusBadRequest)
			return
		}
		paths = strings.Split(pathsParam, ",")
	} else {
		// POST请求：从JSON body获取paths
		var req struct {
			Paths []string `json:"paths"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondWithError(w, "请求格式错误", http.StatusBadRequest)
			return
		}
		paths = req.Paths
	}

	if len(paths) == 0 {
		respondWithError(w, "未指定下载文件", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=download.zip")
	w.Header().Set("Content-Type", "application/zip")

	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	for _, path := range paths {
		if !service.FM.IsPathSafe(path) {
			continue
		}

		info, err := service.FM.Stat(path)
		if err != nil {
			continue
		}

		if info.IsDir() {
			// 目录打包
			fullPath := service.FM.FullPath(path)
			if err := addDirToZip(zipWriter, fullPath, info.Name()); err != nil {
				continue
			}
		} else {
			// 文件打包
			f, err := service.FM.OpenFile(path)
			if err != nil {
				continue
			}
			defer f.Close()

			zw, err := zipWriter.Create(info.Name())
			if err != nil {
				continue
			}

			// 使用缓冲区提高复制性能
			buf := getBuffer()
			defer putBuffer(buf)
			io.CopyBuffer(zw, f, buf)
		}
	}

	logger.Info(getClientIP(r), "批量下载", strings.Join(paths, ","), fmt.Sprintf("%d个文件", len(paths)))
}

// handleDownloadPage 生成手机扫码后的下载页面，重定向到前端静态页面并传递文件名和下载链接。
func handleDownloadPage(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	pathsParam := r.URL.Query().Get("paths")

	// 确定下载文件名
	var fileName string
	var downloadURL string
	if path != "" {
		// 单文件/目录
		info, err := service.FM.Stat(path)
		if err != nil {
			respondWithError(w, "文件不存在", http.StatusNotFound)
			return
		}
		if info.IsDir() {
			fileName = info.Name() + ".zip"
		} else {
			fileName = info.Name()
		}
		downloadURL = "/api/download?path=" + url.QueryEscape(path)
	} else if pathsParam != "" {
		fileName = "download.zip"
		downloadURL = "/api/batch-download?paths=" + url.QueryEscape(pathsParam)
	} else {
		respondWithError(w, "未指定下载文件", http.StatusBadRequest)
		return
	}

	// 重定向到前端下载页面，通过 URL 参数传递文件名和下载链接
	redirectURL := "/download.html?name=" + url.QueryEscape(fileName) + "&url=" + url.QueryEscape(downloadURL)
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// addDirToZip 将目录递归添加到 zip 写入器中
// baseName 为 zip 内的根目录名，fullPath 为文件系统上的实际目录路径
func addDirToZip(zipWriter *zip.Writer, fullPath string, baseName string) error {
	// 从池中获取缓冲区
	buf := getBuffer()
	defer putBuffer(buf)

	return filepath.Walk(fullPath, func(filePath string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 计算zip内的相对路径
		relPath, err := filepath.Rel(fullPath, filePath)
		if err != nil {
			return err
		}
		// 使用正斜杠作为zip路径分隔符（跨平台兼容）
		zipPath := filepath.ToSlash(filepath.Join(baseName, relPath))

		if fi.IsDir() {
			_, err = zipWriter.Create(zipPath + "/")
			return err
		}

		// 写入文件
		f, err := os.Open(filePath)
		if err != nil {
			return err
		}
		defer f.Close()

		zw, err := zipWriter.Create(zipPath)
		if err != nil {
			return err
		}

		// 使用缓冲区提高复制性能
		_, err = io.CopyBuffer(zw, f, buf)
		return err
	})
}
