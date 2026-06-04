package handler

import (
	"net/http"
	"strconv"
)

// getClientIP 获取客户端 IP 地址
// 优先从 X-Real-IP / X-Forwarded-For 头获取（反向代理场景），兜底使用 RemoteAddr
func getClientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return ip
	}
	return r.RemoteAddr
}

// formatSize 将字节数格式化为人类可读的大小字符串（B/KB/MB/GB）。
func formatSize(size int64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)
	switch {
	case size >= GB:
		return strconv.FormatInt(size/GB, 10) + "GB"
	case size >= MB:
		return strconv.FormatInt(size/MB, 10) + "MB"
	case size >= KB:
		return strconv.FormatInt(size/KB, 10) + "KB"
	default:
		return strconv.FormatInt(size, 10) + "B"
	}
}
