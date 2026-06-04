package handler

import (
	"net/http"

	"nano/internal/middleware"
)

// ===== 路由定义 =====

// middlewareLevel 中间件级别
type middlewareLevel int

const (
	levelPublic middlewareLevel = iota // 公开路由，无需认证
	levelAuth                          // 需要登录认证
	levelAdmin                         // 需要管理员权限（root 或 admin）
	levelRoot                          // 需要 root 权限（仅 root 用户）
)

// routeDef 路由定义，包含路径、处理器、允许的 HTTP 方法和所需中间件级别
type routeDef struct {
	path    string           // 路由路径
	handler http.HandlerFunc // 处理函数
	methods []string         // 允许的 HTTP 方法，nil 表示不限制
	auth    middlewareLevel  // 认证级别
}

// routes 所有 API 路由定义（有序）
// 按功能分组：认证 → 文件浏览 → 文件传输 → 文件操作 → 系统管理
var routes = []routeDef{
	// ── 认证 ──────────────────────────────────────────────
	{"/api/login", handleLogin, []string{http.MethodPost}, levelPublic},
	{"/api/logout", handleLogout, []string{http.MethodPost}, levelPublic},
	{"/api/verify-token", handleVerifyToken, []string{http.MethodGet}, levelPublic},
	{"/api/profile", handleUpdateProfile, []string{http.MethodPut}, levelAuth},

	// ── 文件浏览（公开/认证） ─────────────────────────────
	{"/api/list", handleList, []string{http.MethodGet}, levelPublic},
	{"/api/server-info", handleServerInfo, []string{http.MethodGet}, levelPublic},
	{"/api/search", handleSearch, []string{http.MethodGet}, levelAuth},

	// ── 文件传输（认证） ──────────────────────────────────
	{"/api/upload", handleUpload, []string{http.MethodPost}, levelAuth},
	{"/api/download", handleDownload, nil, levelAuth},
	{"/api/batch-download", handleBatchDownload, nil, levelAuth},
	{"/api/d", handleDownloadPage, []string{http.MethodGet}, levelAuth},
	{"/api/preview", handlePreview, []string{http.MethodGet}, levelAuth},
	{"/api/storage", handleStorage, []string{http.MethodGet}, levelAuth},

	// ── 文件操作（管理员） ────────────────────────────────
	{"/api/create-folder", handleCreateFolder, []string{http.MethodPost}, levelAdmin},
	{"/api/create-file", handleCreateFile, []string{http.MethodPost}, levelAdmin},
	{"/api/delete", handleDelete, []string{http.MethodDelete, http.MethodPost}, levelAdmin},
	{"/api/move", handleMove, []string{http.MethodPost}, levelAdmin},
	{"/api/copy", handleCopy, []string{http.MethodPost}, levelAdmin},
	{"/api/rename", handleRename, []string{http.MethodPost}, levelAdmin},
	{"/api/file-content", handleFileContent, []string{http.MethodGet}, levelAdmin},
	{"/api/save-file", handleSaveFile, []string{http.MethodPost}, levelAdmin},

	// ── 系统管理（仅 root） ────────────────────────────────
	{"/api/admin/config", handleGetConfig, []string{http.MethodGet}, levelRoot},
	{"/api/admin/update-config", handleUpdateConfig, []string{http.MethodPut, http.MethodPost}, levelRoot},
	{"/api/admin/update-user", handleUpdateUser, []string{http.MethodPut, http.MethodPost}, levelRoot},
	{"/api/admin/add-user", handleAddUser, []string{http.MethodPost}, levelRoot},
	{"/api/admin/delete-user", handleDeleteUser, []string{http.MethodDelete}, levelRoot},
}

// ===== 中间件链 =====

// methodGuard HTTP 方法守卫中间件，只允许指定的方法通过
func methodGuard(methods []string, next http.HandlerFunc) http.HandlerFunc {
	if len(methods) == 0 {
		return next
	}
	return func(w http.ResponseWriter, r *http.Request) {
		for _, m := range methods {
			if r.Method == m {
				next(w, r)
				return
			}
		}
		respondWithError(w, "请求方法不允许", http.StatusMethodNotAllowed)
	}
}

// chainMiddlewares 根据认证级别组装中间件链
// 公开路由：CORS → 方法守卫 → handler
// 认证路由：CORS → 认证 → 方法守卫 → handler
// 管理路由：CORS → 管理员认证 → 方法守卫 → handler
// Root路由：CORS → Root认证 → 方法守卫 → handler
func chainMiddlewares(def routeDef) http.HandlerFunc {
	h := methodGuard(def.methods, def.handler)
	switch def.auth {
	case levelRoot:
		h = middleware.RootMiddleware(h)
	case levelAdmin:
		h = middleware.AdminMiddleware(h)
	case levelAuth:
		h = middleware.AuthMiddleware(h)
	}
	return middleware.CORS(h)
}

// ===== 路由注册 =====

// RegisterRoutes 注册所有 API 路由
func RegisterRoutes(mux *http.ServeMux) {
	for _, def := range routes {
		mux.HandleFunc(def.path, chainMiddlewares(def))
	}
}
