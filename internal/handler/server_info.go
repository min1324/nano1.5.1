package handler

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"nano/internal/config"
	"nano/internal/service"
)

// handleServerInfo 返回服务器信息，包括IPv4地址和端口
func handleServerInfo(w http.ResponseWriter, r *http.Request) {
	// 获取服务器监听端口
	port := config.C.Port
	if port == "" {
		port = "8080"
	}
	// 移除前缀的冒号或IP地址，只保留端口号
	if strings.Contains(port, ":") {
		parts := strings.Split(port, ":")
		port = parts[len(parts)-1]
	}

	// 获取公网 IPv6 地址
	ipv6, err := getPublicIPv6()
	if err != nil {
		log.Printf("获取公网IPv6地址失败: %v", err)
		ipv6 = config.C.LocalIP.IPv6
	}

	// 返回IPv4、IPv6地址和服务器端口
	respondWithSuccess(w, map[string]any{
		"ipv4": config.C.LocalIP.IPv4,
		"ipv6": ipv6,
		"port": port,
	})
}

// getPublicIPv6 获取公网 IPv6 地址
func getPublicIPv6() (string, error) {
	// 创建强制使用IPv6的HTTP客户端
	dialer := &net.Dialer{
		Timeout: 10 * time.Second,
	}
	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			// 强制使用tcp6，只连接IPv6地址
			return dialer.DialContext(ctx, "tcp6", addr)
		},
	}
	client := &http.Client{Transport: transport, Timeout: 10 * time.Second}

	// 主用
	resp, err := client.Get("https://api6.ipify.org")
	if err == nil {
		defer resp.Body.Close()
		data, _ := io.ReadAll(resp.Body)
		ip := strings.TrimSpace(string(data))
		// 验证是IPv6地址
		if parsed := net.ParseIP(ip); parsed != nil && parsed.To4() == nil {
			return ip, nil
		}
		log.Printf("api6.ipify.org返回非IPv6地址: %s, 尝试备用服务", ip)
	}
	// 备用
	resp2, err2 := client.Get("https://ipv6.icanhazip.com")
	if err2 == nil {
		defer resp2.Body.Close()
		data, _ := io.ReadAll(resp2.Body)
		ip := strings.TrimSpace(string(data))
		if parsed := net.ParseIP(ip); parsed != nil && parsed.To4() == nil {
			return ip, nil
		}
		log.Printf("ipv6.icanhazip.com返回非IPv6地址: %s", ip)
	}
	return "", fmt.Errorf("all IPv6 services failed")
}

// handleStorage 返回存储空间使用情况
func handleStorage(w http.ResponseWriter, r *http.Request) {
	respondWithSuccess(w, map[string]any{
		"usedSize": service.FM.GetUsedSize(),
		"maxSize":  service.FM.GetMaxStorage(),
	})
}
