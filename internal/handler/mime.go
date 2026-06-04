package handler

import (
	"path/filepath"
	"strings"
)

// 代码文件扩展名统一使用 text/plain 类型
var codeExtensions = map[string]bool{
	".py": true, ".java": true, ".go": true, ".c": true, ".cpp": true, ".h": true,
	".hpp": true, ".cs": true, ".rs": true, ".swift": true, ".php": true, ".rb": true,
	".sql": true, ".sh": true, ".bat": true, ".ps1": true, ".lua": true, ".r": true,
	".dart": true, ".kt": true, ".scala": true, ".pl": true, ".ex": true, ".erl": true,
	".clj": true, ".hs": true, ".ml": true, ".fs": true, ".vim": true,
	".vue": true, ".jsx": true, ".tsx": true, ".svelte": true,
	".scss": true, ".sass": true, ".less": true,
	".ts": true, ".conf": true, ".env": true, ".properties": true,
	".diff": true, ".patch": true, ".toml": true, ".ini": true, ".cfg": true,
	".log": true, ".yml": true, ".yaml": true,
}

// 特殊 MIME 类型映射（非 text/plain 的代码/文本文件）
var specialMimeTypes = map[string]string{
	".html": "text/html; charset=utf-8",
	".htm":  "text/html; charset=utf-8",
	".css":  "text/css; charset=utf-8",
	".js":   "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".xml":  "text/xml; charset=utf-8",
	".md":   "text/markdown; charset=utf-8",
	".csv":  "text/csv; charset=utf-8",
	".txt":  "text/plain; charset=utf-8",
}

// mediaMimeTypes 媒体文件 MIME 类型映射
var mediaMimeTypes = map[string]string{
	// 图片
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".gif":  "image/gif",
	".bmp":  "image/bmp",
	".webp": "image/webp",
	".svg":  "image/svg+xml",
	".ico":  "image/x-icon",
	".tiff": "image/tiff",
	".tif":  "image/tiff",
	".avif": "image/avif",
	// 视频
	".mp4":  "video/mp4",
	".webm": "video/webm",
	".ogg":  "video/ogg",
	".mov":  "video/quicktime",
	".avi":  "video/x-msvideo",
	".mkv":  "video/x-matroska",
	// 音频
	".mp3":  "audio/mpeg",
	".wav":  "audio/wav",
	".flac": "audio/flac",
	".aac":  "audio/aac",
	".m4a":  "audio/mp4",
	".wma":  "audio/x-ms-wma",
	// 文档
	".pdf":  "application/pdf",
	".doc":  "application/msword",
	".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".xls":  "application/vnd.ms-excel",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".ppt":  "application/vnd.ms-powerpoint",
	".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

// getContentType 根据文件扩展名返回 MIME 类型
func getContentType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))

	// 1. 检查媒体/文档类型
	if mt, ok := mediaMimeTypes[ext]; ok {
		return mt
	}

	// 2. 检查特殊文本类型
	if mt, ok := specialMimeTypes[ext]; ok {
		return mt
	}

	// 3. 检查代码文件
	if codeExtensions[ext] {
		return "text/plain; charset=utf-8"
	}

	// 4. 兜底：默认二进制流
	return "application/octet-stream"
}
