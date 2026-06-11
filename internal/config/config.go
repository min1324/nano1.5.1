// Package config 提供配置加载、解析、持久化和用户管理功能。
//
// 支持从 YAML 配置文件加载配置项，缺失字段自动填充默认值。
// 密码字段自动迁移为 bcrypt 哈希存储，确保安全性。
// 运行时支持动态修改配置并持久化到磁盘。
package config

import (
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"

	"nano/internal/model"

	"golang.org/x/crypto/bcrypt"
	"gopkg.in/yaml.v3"
)

// UserConfig 用户配置项，对应 config.yaml 中的 users 条目。
// Password 字段在首次加载后自动迁移为 bcrypt 哈希值。
type UserConfig struct {
	Username    string `json:"username"    yaml:"username"`    // 用户名（唯一标识）
	Password    string `json:"password"    yaml:"password"`    // 密码（明文或 bcrypt 哈希）
	Type        string `json:"type"        yaml:"type"`        // 用户类型：admin 或 user
	DisplayName string `json:"displayName" yaml:"displayName"` // 显示名称
}

// Config 应用配置结构，对应 config.yaml 的完整结构。
// 带 Bytes 后缀的字段为运行时解析后的字节数，不参与 YAML 序列化。
type Config struct {
	Port                string       `yaml:"port"`           // 服务监听地址（如 ":8080"）
	UploadDir           string       `yaml:"uploadDir"`      // 文件存储根目录
	MaxStorage          string       `yaml:"maxStorage"`     // 存储容量上限（人类可读格式，如 "10GB"）
	MaxStorageBytes     int64        `yaml:"-"`              // 存储容量上限（字节，运行时解析）
	PreviewMaxSize      string       `yaml:"previewMaxSize"` // 在线预览文件大小上限（人类可读格式）
	PreviewMaxSizeBytes int64        `yaml:"-"`              // 预览大小上限（字节，运行时解析）
	LogDir              string       `yaml:"logDir"`         // 日志存储目录
	LogLevel            string       `yaml:"logLevel"`       // 日志级别：debug/info/warn/error
	LogMaxSize          string       `yaml:"logMaxSize"`     // 单个日志文件最大大小（人类可读格式）
	LogMaxSizeBytes     int64        `yaml:"-"`              // 日志文件大小上限（字节，运行时解析）
	LogMaxBackups       int          `yaml:"logMaxBackups"`  // 保留的日志备份数量
	LogMaxAge           int          `yaml:"logMaxAge"`      // 日志保留天数
	Users               []UserConfig `yaml:"users"`          // 用户列表
}

type localIP struct {
	IPv4 string `yaml:"ipv4"`
	IPv6 string `yaml:"ipv6"`
}

// C 全局配置实例，由 Load() 初始化
var (
	C  *Config
	IP localIP
)

func init() {
	// 获取本地IP地址
	ipv4s, ipv6s, err := getLocalIP()
	if err == nil {
		for _, ip := range ipv4s {
			if strings.HasPrefix(ip, "192.168.") {
				IP.IPv4 = ip
				break
			}
		}
	}
	if IP.IPv4 == "" {
		IP.IPv4 = "0,0,0,0"
	}
	if len(ipv6s) > 0 {
		IP.IPv6 = ipv6s[0]
	}
}

// configPath 配置文件路径
const configPath = "config.yaml"

// defaultConfig 返回包含所有默认值的配置实例。
// 当 config.yaml 不存在或字段缺失时使用这些默认值。
func defaultConfig() *Config {
	return &Config{
		Port:           ":8080",
		UploadDir:      "./files",
		MaxStorage:     "10GB",
		PreviewMaxSize: "10MB",
		LogDir:         "./logs",
		LogLevel:       "info",
		LogMaxSize:     "100MB",
		LogMaxBackups:  7,
		LogMaxAge:      30,
		Users: []UserConfig{
			{Username: "root", Password: "123456", Type: "root", DisplayName: "Root"},
			// {Username: "admin", Password: "123456", Type: "admin", DisplayName: "Admin"},
			// {Username: "user", Password: "123456", Type: "user", DisplayName: "User"},
		},
	}
}

// applyDefaults 用默认值填充配置中的空字段。
// 仅在对应字段为零值时才覆盖，确保用户显式配置优先。
func (c *Config) applyDefaults(def *Config) {
	if c.Port == "" {
		c.Port = def.Port
	}
	if c.UploadDir == "" {
		c.UploadDir = def.UploadDir
	}
	if c.MaxStorage == "" {
		c.MaxStorage = def.MaxStorage
	}
	if c.PreviewMaxSize == "" {
		c.PreviewMaxSize = def.PreviewMaxSize
	}
	if c.LogDir == "" {
		c.LogDir = def.LogDir
	}
	if c.LogLevel == "" {
		c.LogLevel = def.LogLevel
	}
	if c.LogMaxSize == "" {
		c.LogMaxSize = def.LogMaxSize
	}
	if c.LogMaxBackups == 0 {
		c.LogMaxBackups = def.LogMaxBackups
	}
	if c.LogMaxAge == 0 {
		c.LogMaxAge = def.LogMaxAge
	}
	if len(c.Users) == 0 {
		c.Users = def.Users
	}
}

// resolveBytes 将人类可读的大小字符串解析为字节数。
// 解析结果存入对应的 Bytes 后缀字段，供运行时使用。
func (c *Config) resolveBytes() {
	c.MaxStorageBytes = parseSize(c.MaxStorage)
	c.PreviewMaxSizeBytes = parseSize(c.PreviewMaxSize)
	c.LogMaxSizeBytes = parseSize(c.LogMaxSize)
}

// Load 从 config.yaml 加载配置，文件不存在时生成默认配置。
// 加载流程：读取文件 → YAML 反序列化 → 填充默认值 → 解析字节数。
// 若配置文件不存在，将默认配置写入磁盘以便用户修改。
func Load() {
	def := defaultConfig()
	data, err := os.ReadFile(configPath)
	if err != nil {
		fmt.Printf("Config file %s not found, using defaults\n", configPath)
		def.resolveBytes()
		C = def
		InitUsers()
		Save()
		return
	}
	cfg := *def
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		fmt.Printf("Parse %s failed: %v, using defaults\n", configPath, err)
		def.resolveBytes()
		C = def
		return
	}

	// 应用默认值
	cfg.applyDefaults(def)
	cfg.resolveBytes()
	fmt.Printf("Loaded config: port=%s, dir=%s, capacity=%s, preview=%s\n", cfg.Port, cfg.UploadDir, cfg.MaxStorage, cfg.PreviewMaxSize)
	C = &cfg

	// 初始化用户数据结构
	InitUsers()
}

// Save 将当前配置序列化为 YAML 并写入 config.yaml。
// 用于运行时修改配置后的持久化。
func Save() error {
	data, err := yaml.Marshal(C)
	if err != nil {
		return fmt.Errorf("marshal config failed: %w", err)
	}
	return os.WriteFile(configPath, data, 0644)
}

// parseSize 将人类可读的大小字符串解析为字节数。
// 支持的单位：B、KB、MB、GB、TB（不区分大小写）。
// 空字符串默认返回 1GB，无法识别的单位默认返回 10GB。
func parseSize(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 1 << 30
	}
	s = strings.ToUpper(s)
	var num float64
	var unit string
	for i, c := range s {
		if (c < '0' || c > '9') && c != '.' {
			num, _ = strconv.ParseFloat(s[:i], 64)
			unit = s[i:]
			break
		}
	}
	if unit == "" {
		n, err := strconv.ParseInt(s, 10, 64)
		if err != nil {
			return 1 << 30
		}
		return n
	}
	mul := map[string]int64{"B": 1, "KB": 1024, "MB": 1024 * 1024, "GB": 1024 * 1024 * 1024, "TB": 1024 * 1024 * 1024 * 1024}
	m, ok := mul[unit]
	if !ok {
		return 10 << 30
	}
	return int64(num * float64(m))
}

// InitUsers 初始化运行时用户数据，将配置中的用户加载到内存。
// 同时将明文密码自动迁移为 bcrypt 哈希，迁移后持久化到配置文件。
func InitUsers() {
	// model.GlobalUsers = model.NewUserStore()
	needSave := false
	for i := range C.Users {
		uc := &C.Users[i]
		if !isHashedPassword(uc.Password) {
			hash, err := bcrypt.GenerateFromPassword([]byte(uc.Password), bcrypt.DefaultCost)
			if err != nil {
				fmt.Printf("Hash password failed(%s): %v", uc.Username, err)
				continue
			}
			C.Users[i].Password = string(hash)
			needSave = true
		}
		model.GlobalUsers.Set(uc.Username, &model.User{
			Username:    uc.Username,
			Password:    C.Users[i].Password,
			Type:        uc.Type,
			DisplayName: uc.DisplayName,
		})
	}
	if needSave {
		if err := Save(); err != nil {
			fmt.Printf("Save migrated config failed: %v", err)
		} else {
			fmt.Println("Migrated plain passwords to bcrypt hashes")
		}
	}
}

// isHashedPassword 检查密码是否已经是 bcrypt 哈希格式。
// 通过前缀 $2a$/$2b$/$2y$ 判断，避免重复哈希。
func isHashedPassword(password string) bool {
	return strings.HasPrefix(password, "$2a$") || strings.HasPrefix(password, "$2b$") || strings.HasPrefix(password, "$2y$")
}

// HashPassword 对明文密码进行 bcrypt 哈希，已是哈希格式则直接返回。
func HashPassword(password string) (string, error) {
	if isHashedPassword(password) {
		return password, nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password failed: %w", err)
	}
	return string(hash), nil
}

// CheckPassword 验证明文密码与 bcrypt 哈希是否匹配。
func CheckPassword(hashedPassword, plainPassword string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(plainPassword)) == nil
}

// UpdateMaxStorage 更新存储容量上限，同时更新人类可读格式和字节数。
func UpdateMaxStorage(sizeStr string) error {
	bytes := parseSize(sizeStr)
	if bytes <= 0 {
		return fmt.Errorf("invalid size: %s", sizeStr)
	}
	C.MaxStorage = sizeStr
	C.MaxStorageBytes = bytes
	return nil
}

// UpdatePreviewMaxSize 更新在线预览文件大小上限。
func UpdatePreviewMaxSize(sizeStr string) error {
	bytes := parseSize(sizeStr)
	if bytes <= 0 {
		return fmt.Errorf("invalid preview size: %s", sizeStr)
	}
	C.PreviewMaxSize = sizeStr
	C.PreviewMaxSizeBytes = bytes
	return nil
}

// UpdateUser 更新已有用户信息或新增用户。
// 若用户名已存在则更新其字段（空值字段不更新）；
// 若用户名不存在则创建新用户（username、password、type 均为必填）。
// root 用户的类型不可修改，其他字段可正常更新。
func UpdateUser(username, password, userType, displayName string) error {
	for i, u := range C.Users {
		if u.Username == username {
			// root 用户的类型不可修改
			if u.Type == "root" && userType != "" && userType != "root" {
				return fmt.Errorf("root 用户类型不可修改")
			}
			if password != "" {
				hashed, err := HashPassword(password)
				if err != nil {
					return err
				}
				C.Users[i].Password = hashed
			}
			// 非 root 用户才允许修改类型
			if userType != "" && u.Type != "root" {
				C.Users[i].Type = userType
			}
			if displayName != "" {
				C.Users[i].DisplayName = displayName
			}
			return nil
		}
	}
	// 新增用户时，不允许创建 root 类型
	if userType == "root" {
		return fmt.Errorf("不允许创建 root 用户")
	}
	if username == "" || password == "" || userType == "" {
		return fmt.Errorf("new user requires username, password and type")
	}
	hashed, err := HashPassword(password)
	if err != nil {
		return err
	}
	C.Users = append(C.Users, UserConfig{Username: username, Password: hashed, Type: userType, DisplayName: displayName})
	return nil
}

// DeleteUser 删除指定用户。root 用户不可删除。
func DeleteUser(username string) error {
	if username == "root" {
		return fmt.Errorf("root 用户不可删除")
	}
	for i, u := range C.Users {
		if u.Username == username {
			C.Users = append(C.Users[:i], C.Users[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("user %s not found", username)
}

// GetAddress 返回配置中监听的地址，默认返回 0.0.0.0:8080。
func GetAddress() string {
	port := C.Port
	if port == "" {
		return "0.0.0.0:8080"
	}

	// 如果是完整的 IP 地址，直接返回
	if strings.Contains(port, ":") {
		return port
	}

	// 如果用户只配置了端口号（如 "8080"），则自动补全为 ":8080"。
	if !strings.HasPrefix(port, ":") {
		return "0.0.0.0:" + port
	}

	return port
}

// getLocalIp 获取本地所有IPv4和IPv6地址
func getLocalIP() (ipv4s, ipv6s []string, err error) {
	// 获取本机所有可用的IPv4地址
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
				// 收集IPv4和IPv6地址，跳过回环地址
				if ip != nil && !ip.IsLoopback() {
					if ip.To4() != nil {
						ipv4s = append(ipv4s, ip.String())
					} else if ip.To16() != nil {
						ipv6s = append(ipv6s, ip.String())
					}
				}
			}
		}
	}
	return ipv4s, ipv6s, nil
}
