// Package handler 实现 HTTP 请求处理器，处理所有 API 路由的业务逻辑。
//
// 按功能划分为多个文件：
//   - auth.go      — 用户认证（登录/登出/令牌验证）
//   - list.go      — 文件列表查询
//   - upload.go    — 文件上传
//   - file_ops.go  — 文件操作（创建/删除/移动/复制/重命名）
//   - preview.go   — 文件预览
//   - download.go  — 文件下载（单文件/批量/目录ZIP/下载页面）
//   - editor.go    — 文件在线编辑（读取/保存）
//   - search.go    — 文件搜索
//   - security.go  — 安全配置与用户管理（管理员）
//   - server_info.go — 服务器信息
//   - mime.go      — MIME 类型映射
//   - response.go  — 统一响应处理
//   - routes.go    — 路由注册与方法守卫
//   - util.go      — 通用工具函数（getClientIP、formatSize）
package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"nano/internal/config"
	"nano/internal/middleware"
	"nano/internal/model"
)

// loginAttempt 记录登录失败次数和锁定时间
type loginAttempt struct {
	count       int       // 连续失败次数
	lockedUntil time.Time // 锁定截止时间
}

// loginAttemptStore 按 IP+用户名 记录登录失败次数，用于防暴力破解
var loginAttemptStore sync.Map

const (
	loginMaxAttempts  = 5               // 连续失败最大次数
	loginLockDuration = 5 * time.Minute // 锁定时长
	loginMinInterval  = 2 * time.Second // 每次登录最小间隔
)

// handleLogin 处理登录请求
func handleLogin(w http.ResponseWriter, r *http.Request) {
	var req model.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, "无效的请求格式", http.StatusBadRequest)
		return
	}

	// 登录频率限制：按 IP 控制
	clientIP := getClientIP(r)
	loginKey := clientIP + "|" + req.Username

	if attempt, exists := loginAttemptStore.Load(loginKey); exists {
		a := attempt.(*loginAttempt)
		// 检查是否在锁定期内
		if !a.lockedUntil.IsZero() && time.Now().Before(a.lockedUntil) {
			remaining := time.Until(a.lockedUntil)
			respondWithError(w, fmt.Sprintf("登录失败次数过多，请等待 %d 分钟 %d 秒后再试", int(remaining.Minutes()), int(remaining.Seconds())%60), http.StatusTooManyRequests)
			return
		}
		// 锁定期已过，重置失败计数
		if !a.lockedUntil.IsZero() && time.Now().After(a.lockedUntil) {
			loginAttemptStore.Delete(loginKey)
		}
	}

	// 验证用户
	user, exists := model.GlobalUsers.Get(req.Username)
	if !exists {
		remaining := recordLoginFailure(loginKey)
		msg := "用户名或密码错误"
		if remaining > 0 {
			msg = fmt.Sprintf("用户名或密码错误，还可尝试 %d 次", remaining)
		}
		respondWithError(w, msg, http.StatusUnauthorized)
		return
	}

	// 验证密码
	if !config.CheckPassword(user.Password, req.Password) {
		remaining := recordLoginFailure(loginKey)
		msg := "用户名或密码错误"
		if remaining > 0 {
			msg = fmt.Sprintf("用户名或密码错误，还可尝试 %d 次", remaining)
		}
		respondWithError(w, msg, http.StatusUnauthorized)
		return
	}

	// 登录成功，清除失败记录
	loginAttemptStore.Delete(loginKey)

	// 生成token
	token := middleware.GenerateToken()
	middleware.SetTokenUser(token, user)

	// 返回响应
	respondWithSuccess(w, model.LoginResponse{
		Token: token,
		User:  user,
	})
}

// handleLogout 处理登出请求
func handleLogout(w http.ResponseWriter, r *http.Request) {
	// 获取token并删除
	if token, ok := middleware.ExtractBearerToken(r); ok {
		middleware.DeleteToken(token)
	}

	respondWithSuccess(w, map[string]string{"message": "登出成功"})
}

// recordLoginFailure 记录登录失败，达到上限则锁定，返回剩余尝试次数
func recordLoginFailure(key string) int {
	attempt, exists := loginAttemptStore.Load(key)
	var a *loginAttempt
	if exists {
		a = attempt.(*loginAttempt)
	} else {
		a = &loginAttempt{}
	}
	a.count++
	remaining := loginMaxAttempts - a.count
	if remaining <= 0 {
		a.lockedUntil = time.Now().Add(loginLockDuration)
		remaining = 0
	}
	loginAttemptStore.Store(key, a)
	return remaining
}

// handleVerifyToken 验证token
func handleVerifyToken(w http.ResponseWriter, r *http.Request) {
	// 获取并验证token
	token, ok := middleware.ExtractBearerToken(r)
	if !ok {
		respondWithError(w, "未提供有效的认证令牌", http.StatusUnauthorized)
		return
	}

	user, exists := middleware.GetTokenUser(token)
	if !exists {
		respondWithError(w, "无效的认证令牌", http.StatusUnauthorized)
		return
	}

	respondWithSuccess(w, user)
}

// passwordChangeStore 记录每个用户最后一次修改密码的时间，用于间隔保护
var passwordChangeStore sync.Map

// passwordChangeInterval 修改密码的最小间隔时间
const passwordChangeInterval = 2 * time.Second

// handleUpdateProfile 修改当前登录用户的个人信息（密码、显示名称）
// 仅允许修改自己的信息，不可修改用户名和类型
// 修改密码时需要验证旧密码，并有间隔保护
func handleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromRequest(r)
	if !ok || user == nil {
		respondWithError(w, "未登录", http.StatusUnauthorized)
		return
	}

	var req struct {
		OldPassword string `json:"oldPassword"` // 旧密码，修改密码时必填
		Password    string `json:"password"`    // 新密码，留空则不修改
		DisplayName string `json:"displayName"` // 显示名称，留空则不修改
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, "无效的请求格式", http.StatusBadRequest)
		return
	}

	// 至少需要修改一个字段
	if req.Password == "" && req.DisplayName == "" {
		respondWithError(w, "请至少修改一个字段", http.StatusBadRequest)
		return
	}

	// 修改密码时需要验证旧密码 + 间隔保护
	if req.Password != "" {
		if req.OldPassword == "" {
			respondWithError(w, "修改密码需要提供旧密码", http.StatusBadRequest)
			return
		}
		if !config.CheckPassword(user.Password, req.OldPassword) {
			respondWithError(w, "旧密码不正确", http.StatusBadRequest)
			return
		}
		// 间隔保护：防止频繁修改密码
		if lastChange, exists := passwordChangeStore.Load(user.Username); exists {
			elapsed := time.Since(lastChange.(time.Time))
			if elapsed < passwordChangeInterval {
				remaining := passwordChangeInterval - elapsed
				respondWithError(w, fmt.Sprintf("操作过于频繁，请等待 %d 秒后再试", int(remaining.Seconds())+1), http.StatusTooManyRequests)
				return
			}
		}
	}

	if err := config.UpdateUser(user.Username, req.Password, "", req.DisplayName); err != nil {
		respondWithError(w, err.Error(), http.StatusBadRequest)
		return
	}

	// 记录密码修改时间
	if req.Password != "" {
		passwordChangeStore.Store(user.Username, time.Now())
	}

	// 更新内存中的用户信息
	if req.DisplayName != "" {
		user.DisplayName = req.DisplayName
		model.GlobalUsers.Set(user.Username, user)
	}

	// 更新 token 中的用户信息
	if token, ok := middleware.ExtractBearerToken(r); ok {
		middleware.SetTokenUser(token, user)
	}

	respondWithSuccess(w, map[string]string{"message": "个人信息已更新"})
}
