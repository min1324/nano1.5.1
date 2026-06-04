package handler

import (
	"encoding/json"
	"net/http"

	"nano/internal/config"
	"nano/internal/model"
	"nano/internal/service"
)

// handleGetConfig 获取安全配置（管理员）
func handleGetConfig(w http.ResponseWriter, r *http.Request) {
	// 构建用户列表（不返回密码）
	users := make([]map[string]string, 0, len(config.C.Users))
	for _, u := range config.C.Users {
		users = append(users, map[string]string{
			"username":    u.Username,
			"type":        u.Type,
			"displayName": u.DisplayName,
		})
	}

	respondWithSuccess(w, map[string]any{
		"maxStorage":     config.C.MaxStorage,
		"previewMaxSize": config.C.PreviewMaxSize,
		"users":          users,
	})
}

// handleUpdateConfig 更新安全配置（管理员）
func handleUpdateConfig(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MaxStorage     string `json:"maxStorage"`
		PreviewMaxSize string `json:"previewMaxSize"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, "无效的请求格式", http.StatusBadRequest)
		return
	}

	// 更新容量上限
	if req.MaxStorage != "" {
		if err := config.UpdateMaxStorage(req.MaxStorage); err != nil {
			respondWithError(w, err.Error(), http.StatusBadRequest)
			return
		}
		service.FM.SetMaxStorage(config.C.MaxStorageBytes)
	}

	// 更新预览大小限制
	if req.PreviewMaxSize != "" {
		if err := config.UpdatePreviewMaxSize(req.PreviewMaxSize); err != nil {
			respondWithError(w, err.Error(), http.StatusBadRequest)
			return
		}
		service.FM.SetPreviewMaxSize(config.C.PreviewMaxSizeBytes)
	}

	// 保存到配置文件
	if err := config.Save(); err != nil {
		respondWithError(w, "保存配置失败: "+err.Error(), http.StatusInternalServerError)
		return
	}

	respondWithSuccess(w, map[string]any{
		"maxStorage":     config.C.MaxStorage,
		"previewMaxSize": config.C.PreviewMaxSize,
	})
}

// userRequest 用户操作请求结构（更新/新增共用）
type userRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	Type        string `json:"type"`
	DisplayName string `json:"displayName"`
}

// validateUserType 校验用户类型是否合法
func validateUserType(w http.ResponseWriter, userType string) bool {
	if userType != "" && userType != "root" && userType != "admin" && userType != "user" {
		respondWithError(w, "用户类型只能是 root、admin 或 user", http.StatusBadRequest)
		return false
	}
	return true
}

// saveUserAndPersist 更新用户数据、同步运行时并持久化配置
func saveUserAndPersist(w http.ResponseWriter, successMsg string) {
	config.InitUsers()
	if err := config.Save(); err != nil {
		respondWithError(w, "保存配置失败: "+err.Error(), http.StatusInternalServerError)
		return
	}
	respondWithSuccess(w, map[string]string{"message": successMsg})
}

// handleUpdateUser 更新用户配置（仅 root）
func handleUpdateUser(w http.ResponseWriter, r *http.Request) {
	var req userRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, "无效的请求格式", http.StatusBadRequest)
		return
	}

	if req.Username == "" {
		respondWithError(w, "用户名不能为空", http.StatusBadRequest)
		return
	}
	if !validateUserType(w, req.Type) {
		return
	}

	// 不允许通过 API 将用户类型修改为 root
	if req.Type == "root" {
		respondWithError(w, "不允许将用户类型修改为 root", http.StatusBadRequest)
		return
	}

	if err := config.UpdateUser(req.Username, req.Password, req.Type, req.DisplayName); err != nil {
		respondWithError(w, err.Error(), http.StatusBadRequest)
		return
	}

	saveUserAndPersist(w, "用户配置已更新")
}

// handleAddUser 新增用户（仅 root）
func handleAddUser(w http.ResponseWriter, r *http.Request) {
	var req userRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, "无效的请求格式", http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Password == "" || req.Type == "" {
		respondWithError(w, "用户名、密码和类型不能为空", http.StatusBadRequest)
		return
	}
	if req.Type == "root" {
		respondWithError(w, "不允许创建 root 用户", http.StatusBadRequest)
		return
	}
	if req.Type != "admin" && req.Type != "user" {
		respondWithError(w, "用户类型只能是 admin 或 user", http.StatusBadRequest)
		return
	}

	// 检查用户名是否已存在
	if _, exists := model.GlobalUsers.Get(req.Username); exists {
		respondWithError(w, "用户名已存在", http.StatusBadRequest)
		return
	}

	if req.DisplayName == "" {
		req.DisplayName = req.Username
	}

	if err := config.UpdateUser(req.Username, req.Password, req.Type, req.DisplayName); err != nil {
		respondWithError(w, err.Error(), http.StatusBadRequest)
		return
	}

	saveUserAndPersist(w, "用户已添加")
}

// handleDeleteUser 删除用户（管理员）
func handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")
	if username == "" {
		respondWithError(w, "用户名不能为空", http.StatusBadRequest)
		return
	}

	if err := config.DeleteUser(username); err != nil {
		respondWithError(w, err.Error(), http.StatusBadRequest)
		return
	}

	saveUserAndPersist(w, "用户已删除")
}
