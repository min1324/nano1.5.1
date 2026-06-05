// Package logger 提供分级日志系统，支持文件输出、自动轮转和过期清理。
//
// 日志级别：debug < info < warn < error，低于当前级别的日志将被忽略。
// 轮转策略：当日志文件超过 maxSize 时自动切割并编号备份。
// 清理策略：定期删除超过 maxAge 天的旧日志文件。
//
// 典型用法：
//
//	logger.Init(logDir, level, maxSize, maxBackup, maxAge)
//	logger.Info(ip, "上传", path, filename)
//	logger.Error(ip, "删除", path, filename, err)
//	logger.Stop()  // 优雅关闭
package logger

import (
	"fmt"
	"nano/internal/config"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// levelWeight 日志级别权重映射，数值越大级别越高
var levelWeight = map[string]int{
	"debug": 0,
	"info":  1,
	"warn":  2,
	"error": 3,
}

var (
	file      *os.File      // 当前日志文件句柄
	mu        sync.Mutex    // 日志写入互斥锁
	curLevel  int           // 当前日志级别权重
	maxSize   int64         // 单个日志文件最大字节数
	maxBackup int           // 保留的备份数量
	maxAge    int           // 保留天数
	logDir    string        // 日志目录
	logPath   string        // 当前日志文件路径
	done      chan struct{} // 用于停止日志轮转 goroutine
)

func Init(config *config.Config) error {
	return initLogger(config.LogDir, config.LogLevel, config.LogMaxSizeBytes, config.LogMaxBackups, config.LogMaxAge)
}

// Init 初始化日志系统
func initLogger(dir string, level string, size int64, backup int, age int) error {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建日志目录失败: %w", err)
	}

	logDir = dir
	logPath = filepath.Join(dir, "nanocloud.log")
	maxSize = size
	maxBackup = backup
	maxAge = age

	// 解析日志级别
	w, ok := levelWeight[level]
	if !ok {
		w = 1 // 默认info
	}
	curLevel = w

	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("打开日志文件失败: %w", err)
	}

	mu.Lock()
	file = f
	mu.Unlock()

	// 初始化停止通道
	done = make(chan struct{})

	// 启动日志轮转和清理
	go rotateLoop()

	return nil
}

// shouldLog 判断是否应该记录该级别日志
func shouldLog(level string) bool {
	w, ok := levelWeight[level]
	if !ok {
		return true
	}
	return w >= curLevel
}

// rotateIfNeeded 检查并执行日志轮转
func rotateIfNeeded() {
	if file == nil || maxSize <= 0 {
		return
	}
	info, err := file.Stat()
	if err != nil || info.Size() < maxSize {
		return
	}

	// 关闭当前文件
	file.Close()

	// 轮转：nanocloud.log -> nanocloud.1.log, nanocloud.1.log -> nanocloud.2.log, ...
	for i := maxBackup - 1; i >= 1; i-- {
		oldPath := filepath.Join(logDir, fmt.Sprintf("nanocloud.%d.log", i))
		newPath := filepath.Join(logDir, fmt.Sprintf("nanocloud.%d.log", i+1))
		os.Rename(oldPath, newPath)
	}
	backupPath := filepath.Join(logDir, "nanocloud.1.log")
	os.Rename(logPath, backupPath)

	// 重新打开日志文件
	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return
	}
	file = f
}

// cleanOldLogs 清理过期的日志备份
func cleanOldLogs() {
	if maxAge <= 0 {
		return
	}
	cutoff := time.Now().AddDate(0, 0, -maxAge)
	entries, err := os.ReadDir(logDir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) && entry.Name() != "nanocloud.log" {
			os.Remove(filepath.Join(logDir, entry.Name()))
		}
	}
}

// rotateLoop 定期检查日志轮转和清理
func rotateLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			mu.Lock()
			rotateIfNeeded()
			cleanOldLogs()
			mu.Unlock()
		case <-done:
			return
		}
	}
}

// writeLog 写入日志行
func writeLog(level string, operator string, operation string, path string, filename string, destPath string, errMsg string) {
	mu.Lock()
	defer mu.Unlock()

	if file == nil {
		return
	}

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	name := filepath.Base(filename)
	line := fmt.Sprintf("%s %s %s %s %s %s", timestamp, level, operator, operation, name, path)
	if destPath != "" {
		line += " " + destPath
	}
	if errMsg != "" {
		line += " " + errMsg
	}
	line += "\n"
	if _, err := file.WriteString(line); err != nil {
		fmt.Fprintf(os.Stderr, "日志写入失败: %v\n", err)
	}
}

// Info 记录信息日志
func Info(operator string, operation string, path string, filename string, destPath ...string) {
	if !shouldLog("info") {
		return
	}
	dp := ""
	if len(destPath) > 0 {
		dp = destPath[0]
	}
	writeLog("info", operator, operation, path, filename, dp, "")
}

// Error 记录错误日志
func Error(operator string, operation string, path string, filename string, err error, destPath ...string) {
	if !shouldLog("error") {
		return
	}
	dp := ""
	if len(destPath) > 0 {
		dp = destPath[0]
	}
	errMsg := ""
	if err != nil {
		errMsg = err.Error()
	}
	writeLog("error", operator, operation, path, filename, dp, errMsg)
}

// Sync 同步日志缓冲区
func Sync() {
	mu.Lock()
	defer mu.Unlock()
	if file != nil {
		file.Sync()
	}
}

// Stop 停止日志轮转goroutine并关闭日志文件
func Stop() {
	if done != nil {
		close(done)
		done = nil
	}
	Close()
}

// Close 关闭日志文件
func Close() {
	mu.Lock()
	defer mu.Unlock()
	if file != nil {
		file.Close()
		file = nil
	}
}
