package handler

import (
	"net"
	"net/http"
	"strings"

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

	// 获取本机所有可用的IPv4地址
	var ipv4s []string
	interfaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range interfaces {
			// 跳过回环接口和未启用的接口
			if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
				continue
			}
			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}
			for _, addr := range addrs {
				var ip net.IP
				switch v := addr.(type) {
				case *net.IPNet:
					ip = v.IP
				case *net.IPAddr:
					ip = v.IP
				}
				// 只收集IPv4地址，跳过回环地址
				if ip != nil && ip.To4() != nil && !ip.IsLoopback() {
					ipv4s = append(ipv4s, ip.String())
				}
			}
		}
	}

	// 如果没有找到任何IPv4地址，使用请求的Host作为备选
	var ipv4 string
	if len(ipv4s) > 0 {
		ipv4 = ipv4s[0]
	} else {
		// 从请求的Host中提取IP
		host := r.Host
		if strings.Contains(host, ":") {
			ipv4 = strings.Split(host, ":")[0]
		} else {
			ipv4 = host
		}
	}

	// 返回IPv4地址和服务器端口
	respondWithSuccess(w, map[string]any{
		"ipv4": ipv4,
		"port": port,
	})
}

// handleStorage 返回存储空间使用情况
func handleStorage(w http.ResponseWriter, r *http.Request) {
	respondWithSuccess(w, map[string]any{
		"usedSize": service.FM.GetUsedSize(),
		"maxSize":  service.FM.GetMaxStorage(),
	})
}
