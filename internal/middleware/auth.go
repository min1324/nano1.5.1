// Package middleware 提供 HTTP 中间件功能，包括认证、权限校验和跨域处理。
//
// 包含以下中间件：
//   - AuthMiddleware   — 用户认证，验证 Bearer Token 有效性
//   - AdminMiddleware  — 管理员权限校验，在认证基础上检查用户类型
//   - CORS            — 跨域资源共享，支持前后端分离部署
//
// Token 管理采用 sync.Map 并发安全存储，自动清理过期 Token。
package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"sync"
	"time"

	"nano/internal/model"
)

// contextKey 自定义 context key 类型，避免跨包冲突
type contextKey string

const userContextKey contextKey = "user"

// tokenEntry token存储条目，存储用户副本避免数据竞争
type tokenEntry struct {
	user      model.User // 存储副本而非指针，避免并发修改风险
	expiresAt time.Time
}

// tokenStore 使用 sync.Map 存储token和用户的映射（并发安全）
var tokenStore sync.Map

// MaxTokenDuration token最长有效期：30分钟
const MaxTokenDuration = 30 * time.Minute

// cleanupCancel 用于优雅停止清理 goroutine
var cleanupCancel context.CancelFunc

// GetTokenUser 从 TokenStore 中获取用户信息，过期返回不存在
func GetTokenUser(token string) (*model.User, bool) {
	val, ok := tokenStore.Load(token)
	if !ok {
		return nil, false
	}
	entry, ok := val.(tokenEntry)
	if !ok {
		return nil, false
	}
	if time.Now().After(entry.expiresAt) {
		DeleteToken(token)
		return nil, false
	}
	// 返回副本的指针，调用方修改不影响存储
	return &entry.user, true
}

// SetTokenUser 向 TokenStore 中设置用户信息，过期时间为30分钟
func SetTokenUser(token string, user *model.User) {
	tokenStore.Store(token, tokenEntry{
		user:      *user, // 存储副本
		expiresAt: time.Now().Add(MaxTokenDuration),
	})
}

// DeleteToken 从 TokenStore 中删除 token
func DeleteToken(token string) {
	tokenStore.Delete(token)
}

// StopCleanup 停止清理 goroutine，用于优雅关闭
func StopCleanup() {
	if cleanupCancel != nil {
		cleanupCancel()
	}
}

// init 启动清理过期token的定时任务
func init() {
	ctx, cancel := context.WithCancel(context.Background())
	cleanupCancel = cancel
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				cleanExpiredTokens()
			}
		}
	}()
}

// cleanExpiredTokens 清理所有过期的token
func cleanExpiredTokens() {
	now := time.Now()
	tokenStore.Range(func(key, value any) bool {
		entry, ok := value.(tokenEntry)
		if !ok {
			tokenStore.Delete(key)
			return true
		}
		if now.After(entry.expiresAt) {
			tokenStore.Delete(key)
		}
		return true
	})
}

// GenerateToken 生成安全的随机 token
// crypto/rand 读取失败说明系统熵不足，直接 panic
func GenerateToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand failed: " + err.Error())
	}
	return hex.EncodeToString(b)
}

// ExtractBearerToken 从请求头中提取 Bearer token
func ExtractBearerToken(r *http.Request) (string, bool) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return "", false
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		return "", false
	}
	return parts[1], true
}

// authenticateRequest 从请求中提取并验证token，返回用户信息
// 供 AuthMiddleware 和 AdminMiddleware 复用
// 支持两种认证方式：
//   1. Authorization: Bearer <token> 请求头
//   2. ?token=<token> URL 查询参数（用于 img/video/audio/iframe 等无法设置请求头的场景）
func authenticateRequest(w http.ResponseWriter, r *http.Request) (*model.User, bool) {
	token, ok := ExtractBearerToken(r)
	if !ok {
		// 尝试从 URL 查询参数中获取 token
		if t := r.URL.Query().Get("token"); t != "" {
			token = t
			ok = true
		}
	}
	if !ok {
		model.RespondWithError(w, "未提供认证令牌", http.StatusUnauthorized)
		return nil, false
	}

	user, exists := GetTokenUser(token)
	if !exists {
		model.RespondWithError(w, "无效的认证令牌", http.StatusUnauthorized)
		return nil, false
	}

	return user, true
}

// AuthMiddleware 认证中间件
func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := authenticateRequest(w, r)
		if !ok {
			return
		}

		// 将用户信息存入请求上下文
		ctx := context.WithValue(r.Context(), userContextKey, user)
		r = r.WithContext(ctx)

		next(w, r)
	}
}

// AdminMiddleware 管理员权限中间件，允许 root 和 admin 通过
func AdminMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := authenticateRequest(w, r)
		if !ok {
			return
		}
		if !user.IsAdmin() {
			model.RespondWithError(w, "需要管理员权限", http.StatusForbidden)
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, user)
		r = r.WithContext(ctx)

		next(w, r)
	}
}

// RootMiddleware root 权限中间件，仅允许 root 用户通过
func RootMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := authenticateRequest(w, r)
		if !ok {
			return
		}
		if !user.IsRoot() {
			model.RespondWithError(w, "需要 root 权限", http.StatusForbidden)
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, user)
		r = r.WithContext(ctx)

		next(w, r)
	}
}

// GetUserFromRequest 从请求中获取用户信息
func GetUserFromRequest(r *http.Request) (*model.User, bool) {
	user, ok := r.Context().Value(userContextKey).(*model.User)
	return user, ok
}


