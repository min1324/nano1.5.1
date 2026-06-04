// Package service 提供文件管理核心服务，封装所有文件操作的底层实现。
//
// FileManager 是核心结构，统一管理文件操作并提供以下保障：
//   - 路径安全：IsPathSafe() 防止路径遍历攻击
//   - 并发安全：LockFile() 按路径粒度加锁，排序加锁防死锁
//   - 存储管控：GetUsedSize() 带缓存的空间计算 + singleflight 防击穿
//   - 容量限制：HasEnoughSpace() 写操作前检查剩余空间
package service

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"nano/internal/config"
	"nano/internal/model"

	"golang.org/x/sync/singleflight"
)

// FileManager 文件管理器，统一管理所有文件操作
// 封装了路径安全检查、存储空间缓存、文件操作锁等机制
type FileManager struct {
	uploadDir       string             // 文件存储根目录
	maxStorage      int64              // 存储容量上限（字节）
	previewMaxSize  int64              // 在线预览文件大小上限（字节）
	fileOpLocks     sync.Map           // 文件操作锁（按路径粒度）
	usedSizeCache   int64              // 已用存储空间缓存
	usedSizeCacheMu sync.RWMutex       // 缓存读写锁
	usedSizeCacheT  time.Time          // 缓存时间戳
	cacheDuration   time.Duration      // 缓存有效期
	sfGroup         singleflight.Group // 存储空间计算 singleflight
}

// NewFileManager 创建文件管理器实例
func NewFileManager() *FileManager {
	return &FileManager{
		uploadDir:      config.C.UploadDir,
		maxStorage:     config.C.MaxStorageBytes,
		previewMaxSize: config.C.PreviewMaxSizeBytes,
		cacheDuration:  30 * time.Second,
	}
}

// ==================== 路径与安全 ====================

// FullPath 将相对路径转换为完整文件系统路径
func (fm *FileManager) FullPath(relativePath string) string {
	return filepath.Join(fm.uploadDir, relativePath)
}

// IsPathSafe 检查路径是否安全，防止路径遍历攻击
// 拒绝包含 ".." 的路径段，确保用户无法访问存储目录之外的文件
func (fm *FileManager) IsPathSafe(path string) bool {
	if path == "" || path == "/" {
		return true
	}
	cleanPath := filepath.Clean(path)
	// 统一用 / 分隔检查，filepath.Clean 会将反斜杠也标准化
	for _, segment := range strings.Split(cleanPath, "/") {
		if segment == ".." {
			return false
		}
	}
	// 同时检查系统路径分隔符（Windows 下 filepath.Clean 可能保留反斜杠）
	if os.PathSeparator != '/' {
		for _, segment := range strings.Split(cleanPath, string(os.PathSeparator)) {
			if segment == ".." {
				return false
			}
		}
	}
	return true
}

// ==================== 文件操作锁 ====================

// LockFile 获取文件操作锁，返回解锁函数
// 同一路径的并发操作会被串行化，避免数据竞争
// 解锁后自动清理不再使用的锁对象，防止内存泄漏
func (fm *FileManager) LockFile(path string) func() {
	mu, _ := fm.fileOpLocks.LoadOrStore(path, &sync.Mutex{})
	lock := mu.(*sync.Mutex)
	lock.Lock()
	return func() {
		lock.Unlock()
		// 尝试清理：如果没有人再等待这把锁，则从map中删除
		// TryLock成功说明没有其他goroutine在等待，可以安全删除
		if lock.TryLock() {
			fm.fileOpLocks.Delete(path)
			lock.Unlock()
		}
	}
}

// FileOpLocksRange 遍历文件操作锁映射（用于调试和测试）
func (fm *FileManager) FileOpLocksRange(fn func(key, value any) bool) {
	fm.fileOpLocks.Range(fn)
}

// ==================== 存储空间管理 ====================

// GetUsedSize 获取已用存储空间大小（带缓存）
// 缓存有效期 30 秒，过期后自动重新遍历计算
// 使用 singleflight 防止缓存过期时多个 goroutine 同时计算
func (fm *FileManager) GetUsedSize() int64 {
	fm.usedSizeCacheMu.RLock()
	if !fm.usedSizeCacheT.IsZero() && time.Since(fm.usedSizeCacheT) < fm.cacheDuration {
		size := fm.usedSizeCache
		fm.usedSizeCacheMu.RUnlock()
		return size
	}
	fm.usedSizeCacheMu.RUnlock()

	// singleflight: 合并并发请求
	result, _, _ := fm.sfGroup.Do("usedSize", func() (any, error) {
		var totalSize int64
		filepath.Walk(fm.uploadDir, func(_ string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if !info.IsDir() {
				totalSize += info.Size()
			}
			return nil
		})

		// 更新缓存
		fm.usedSizeCacheMu.Lock()
		fm.usedSizeCache = totalSize
		fm.usedSizeCacheT = time.Now()
		fm.usedSizeCacheMu.Unlock()

		return totalSize, nil
	})

	return result.(int64)
}

// InvalidateUsedSizeCache 使存储空间缓存失效
// 在文件上传、删除、移动、复制、保存等写操作后调用
func (fm *FileManager) InvalidateUsedSizeCache() {
	fm.usedSizeCacheMu.Lock()
	fm.usedSizeCacheT = time.Time{}
	fm.usedSizeCacheMu.Unlock()
}

// HasEnoughSpace 检查是否有足够的存储空间容纳指定大小的增量
// required > 0 表示新增空间需求，required < 0 表示释放空间（总是返回true）
func (fm *FileManager) HasEnoughSpace(required int64) bool {
	if required <= 0 {
		return true
	}
	return fm.GetUsedSize()+required <= fm.maxStorage
}

// GetMaxStorage 获取存储容量上限
func (fm *FileManager) GetMaxStorage() int64 {
	return fm.maxStorage
}

// GetPreviewMaxSize 获取在线预览文件大小上限
func (fm *FileManager) GetPreviewMaxSize() int64 {
	return fm.previewMaxSize
}

// SetMaxStorage 设置存储容量上限
func (fm *FileManager) SetMaxStorage(bytes int64) {
	fm.maxStorage = bytes
}

// SetPreviewMaxSize 设置在线预览文件大小上限
func (fm *FileManager) SetPreviewMaxSize(bytes int64) {
	fm.previewMaxSize = bytes
}

// ==================== 文件信息查询 ====================

// Stat 获取文件/目录信息
func (fm *FileManager) Stat(relativePath string) (os.FileInfo, error) {
	return os.Stat(fm.FullPath(relativePath))
}

// Exists 检查文件或目录是否存在
func (fm *FileManager) Exists(relativePath string) bool {
	_, err := os.Stat(fm.FullPath(relativePath))
	return err == nil
}

// IsDir 检查路径是否为目录
func (fm *FileManager) IsDir(relativePath string) bool {
	info, err := os.Stat(fm.FullPath(relativePath))
	if err != nil {
		return false
	}
	return info.IsDir()
}

// ==================== 目录操作 ====================

// CreateDir 创建目录（含所有必要的父目录）
func (fm *FileManager) CreateDir(relativePath string) error {
	return os.MkdirAll(fm.FullPath(relativePath), 0755)
}

// ListDir 列出目录内容，返回文件项列表
func (fm *FileManager) ListDir(relativePath string) ([]model.FileItem, error) {
	entries, err := os.ReadDir(fm.FullPath(relativePath))
	if err != nil {
		return nil, err
	}

	items := make([]model.FileItem, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		items = append(items, model.FileItem{
			Name:     entry.Name(),
			Path:     filepath.ToSlash(filepath.Join(relativePath, entry.Name())),
			IsDir:    entry.IsDir(),
			Size:     info.Size(),
			Modified: info.ModTime().Format("2006-01-02 15:04:05"),
		})
	}
	return items, nil
}

// SearchFiles 搜索文件，返回匹配的文件项列表
// query: 搜索关键词
// path: 搜索路径，为空时搜索根目录
// recursive: 是否递归搜索子目录
func (fm *FileManager) SearchFiles(query, path string, recursive bool) ([]model.FileItem, error) {
	if path == "" || path == "/" {
		path = ""
	}

	// 检查路径安全性
	if !fm.IsPathSafe(path) {
		return nil, os.ErrPermission
	}

	searchPath := fm.FullPath(path)
	results := make([]model.FileItem, 0)

	// 将查询词转为小写，用于不区分大小写的匹配
	queryLower := strings.ToLower(query)

	// 遍历目录
	walkFn := func(filePath string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		// 跳过根目录本身
		if filePath == searchPath {
			return nil
		}

		// 获取相对路径
		relPath, err := filepath.Rel(fm.uploadDir, filePath)
		if err != nil {
			return nil
		}
		relPath = filepath.ToSlash(relPath)

		// 获取文件名
		fileName := filepath.Base(filePath)

		// 检查文件名是否匹配查询词
		if strings.Contains(strings.ToLower(fileName), queryLower) {
			results = append(results, model.FileItem{
				Name:     fileName,
				Path:     relPath,
				IsDir:    info.IsDir(),
				Size:     info.Size(),
				Modified: info.ModTime().Format("2006-01-02 15:04:05"),
			})
		}

		// 如果不递归搜索，则只搜索当前目录
		if !recursive && info.IsDir() {
			return filepath.SkipDir
		}

		return nil
	}

	if recursive {
		err := filepath.Walk(searchPath, walkFn)
		if err != nil {
			return nil, err
		}
	} else {
		entries, err := os.ReadDir(searchPath)
		if err != nil {
			return nil, err
		}
		for _, entry := range entries {
			info, err := entry.Info()
			if err != nil {
				continue
			}
			filePath := filepath.Join(searchPath, entry.Name())
			walkFn(filePath, info, nil)
		}
	}

	return results, nil
}

// ==================== 文件读写 ====================

// ReadFile 读取文件全部内容
func (fm *FileManager) ReadFile(relativePath string) ([]byte, error) {
	return os.ReadFile(fm.FullPath(relativePath))
}

// WriteFile 写入文件内容
func (fm *FileManager) WriteFile(relativePath string, content []byte) error {
	return os.WriteFile(fm.FullPath(relativePath), content, 0644)
}

// OpenFile 打开文件用于读取
func (fm *FileManager) OpenFile(relativePath string) (*os.File, error) {
	return os.Open(fm.FullPath(relativePath))
}

// CreateFile 创建文件用于写入
func (fm *FileManager) CreateFile(relativePath string) (*os.File, error) {
	return os.Create(fm.FullPath(relativePath))
}

// ==================== 文件操作（增删改） ====================

// Delete 删除文件或目录
func (fm *FileManager) Delete(relativePath string) error {
	return os.RemoveAll(fm.FullPath(relativePath))
}

// Move 移动/重命名文件或目录
func (fm *FileManager) Move(srcRelPath, dstRelPath string) error {
	return os.Rename(fm.FullPath(srcRelPath), fm.FullPath(dstRelPath))
}

// Copy 复制文件或目录（自动判断类型）
func (fm *FileManager) Copy(srcRelPath, dstRelPath string) error {
	return fm.copyPath(fm.FullPath(srcRelPath), fm.FullPath(dstRelPath))
}

// SaveUploadedFile 保存上传文件，支持文件名包含相对路径，自动创建目录结构
// SaveUploadedFile 保存上传文件，conflict策略: rename(自动重命名), overwrite(覆盖), skip(跳过)
func (fm *FileManager) SaveUploadedFile(fh *multipart.FileHeader, targetPath string, conflict string, renameMap map[string]string) bool {
	fileName := filepath.FromSlash(fh.Filename)
	var destDir string
	var destPath string

	if strings.Contains(fileName, string(os.PathSeparator)) {
		// 文件夹上传：重命名根文件夹
		// 例如 "myfolder/sub/a.txt" -> rootName="myfolder"
		parts := strings.SplitN(fileName, string(os.PathSeparator), 2)
		rootName := parts[0]

		effectiveRootName := rootName
		if conflict == "rename" {
			if newName, ok := renameMap[rootName]; ok {
				effectiveRootName = newName
			} else {
				rootDirPath := fm.FullPath(filepath.Join(targetPath, rootName))
				if _, err := os.Stat(rootDirPath); err == nil {
					// 根目录已存在，重命名文件夹（mydir -> mydir(1)）
					newRootDirPath := fm.autoRenameDir(rootDirPath)
					effectiveRootName = filepath.Base(newRootDirPath)
					renameMap[rootName] = effectiveRootName
				} else {
					// 根目录不存在，无需重命名
					renameMap[rootName] = rootName
				}
			}
		}

		// 用重命名后的根目录名替换原始根目录名
		dirPart := filepath.Dir(fileName)
		if !fm.IsPathSafe(dirPart) {
			return false
		}
		effectiveDirPart := effectiveRootName + dirPart[len(rootName):]
		destDir = fm.FullPath(filepath.Join(targetPath, effectiveDirPart))
		fileName = filepath.Base(fileName)
	} else {
		// 单文件上传：检查目标路径下是否存在同名文件
		destDir = fm.FullPath(targetPath)
		destPath = filepath.Join(destDir, fileName)

		if conflict == "rename" {
			if _, err := os.Stat(destPath); err == nil {
				// 同名文件已存在，重命名文件本身（file.txt -> file(1).txt）
				destPath = fm.autoRename(destPath)
				fileName = filepath.Base(destPath)
			}
		}
	}

	if err := os.MkdirAll(destDir, 0755); err != nil {
		return false
	}

	// 文件夹上传时 destPath 尚未计算，在此处统一计算
	if destPath == "" {
		destPath = filepath.Join(destDir, fileName)
	}

	// 处理文件冲突（overwrite/skip 策略）
	if _, err := os.Stat(destPath); err == nil {
		switch conflict {
		case "skip":
			return true
		case "overwrite":
			// 覆盖：直接使用原路径，os.Create会截断
		}
	}

	src, err := fh.Open()
	if err != nil {
		return false
	}
	defer src.Close()

	dest, err := os.Create(destPath)
	if err != nil {
		return false
	}
	defer dest.Close()

	_, err = io.Copy(dest, src)
	return err == nil
}

// autoRename 自动重命名文件，避免冲突 (file.txt -> file(1).txt)
// 最多尝试 1000 次，超过上限返回原路径
func (fm *FileManager) autoRename(path string) string {
	if _, err := os.Stat(path); err != nil {
		return path
	}
	ext := filepath.Ext(path)
	base := strings.TrimSuffix(path, ext)
	for i := 1; i <= 1000; i++ {
		newPath := fmt.Sprintf("%s(%d)%s", base, i, ext)
		if _, err := os.Stat(newPath); err != nil {
			return newPath
		}
	}
	return path
}

// autoRenameDir 自动重命名目录，避免冲突 (mydir -> mydir(1))
// 最多尝试 1000 次，超过上限返回原路径
func (fm *FileManager) autoRenameDir(path string) string {
	if _, err := os.Stat(path); err != nil {
		return path
	}
	for i := 1; i <= 1000; i++ {
		newPath := fmt.Sprintf("%s(%d)", path, i)
		if _, err := os.Stat(newPath); err != nil {
			return newPath
		}
	}
	return path
}

// ==================== 内部复制实现 ====================

// copyPath 复制路径（自动判断文件或目录）
func (fm *FileManager) copyPath(src, dst string) error {
	info, err := os.Stat(src)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return fm.copyDir(src, dst)
	}
	return fm.copyFile(src, dst)
}

// copyDir 递归复制目录及其所有子项
func (fm *FileManager) copyDir(src, dst string) error {
	// copyPath 已经验证了 src 存在，这里直接读取目录
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	// 获取源目录权限
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dst, srcInfo.Mode()); err != nil {
		return err
	}
	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())
		if entry.IsDir() {
			if err := fm.copyDir(srcPath, dstPath); err != nil {
				return err
			}
		} else {
			if err := fm.copyFile(srcPath, dstPath); err != nil {
				return err
			}
		}
	}
	return nil
}

// copyFile 复制单个文件，保留文件权限
func (fm *FileManager) copyFile(src, dst string) error {
	// 先获取源文件权限，避免复制后再 Stat
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	source, err := os.Open(src)
	if err != nil {
		return err
	}
	defer source.Close()

	// 使用源文件权限创建目标文件，避免额外的 os.Chmod 调用
	destination, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, srcInfo.Mode())
	if err != nil {
		return err
	}
	defer destination.Close()

	_, err = io.Copy(destination, source)
	return err
}

// ==================== 全局实例 ====================

// FM 全局文件管理器实例
var FM *FileManager

// InitFileManager 初始化全局文件管理器
func InitFileManager() {
	FM = NewFileManager()

	// 确保上传目录存在
	FM.CreateDir("/")
}
