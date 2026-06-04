package model

import "sync"

// User 用户模型
type User struct {
	Username    string `json:"username"`
	Password    string `json:"-"` // 不序列化密码
	Type        string `json:"type"`        // "root"、"admin" 或 "user"
	DisplayName string `json:"displayName"`
}

// IsRoot 判断用户是否为 root（最高权限，唯一且不可修改类型）
func (u *User) IsRoot() bool {
	return u != nil && u.Type == "root"
}

// IsAdmin 判断用户是否拥有管理员及以上权限（root 或 admin）
func (u *User) IsAdmin() bool {
	return u != nil && (u.Type == "root" || u.Type == "admin")
}

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
}

// UserStore 用户存储，并发安全
type UserStore struct {
	mu    sync.RWMutex
	users map[string]*User
}

// NewUserStore 创建新的用户存储实例
func NewUserStore() *UserStore {
	return &UserStore{users: make(map[string]*User)}
}

// GlobalUsers 全局用户存储实例
var GlobalUsers = NewUserStore()

// Set 设置用户
func (s *UserStore) Set(username string, user *User) {
	s.mu.Lock()
	s.users[username] = user
	s.mu.Unlock()
}

// Get 获取用户
func (s *UserStore) Get(username string) (*User, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.users[username]
	return u, ok
}

// Range 遍历所有用户
func (s *UserStore) Range(fn func(username string, user *User) bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for k, v := range s.users {
		if !fn(k, v) {
			break
		}
	}
}
