// Package model 定义 API 响应结构和数据模型。
//
// 包含统一响应格式（成功/错误）、文件信息结构和用户模型。
// 所有 API 响应遵循统一的 JSON 格式：{success, message, data}。
package model

import (
	"encoding/json"
	"net/http"
)

// FileItem 文件/文件夹信息结构，用于 API 响应
type FileItem struct {
	Name     string `json:"name"`     // 文件名
	Path     string `json:"path"`     // 相对路径（斜杠分隔）
	IsDir    bool   `json:"isDir"`    // 是否为目录
	Size     int64  `json:"size"`     // 文件大小（字节）
	Modified string `json:"modified"` // 最后修改时间
}

// Response 统一 API 响应结构
type Response struct {
	Success bool   `json:"success"`        // 操作是否成功
	Message string `json:"message"`        // 提示信息
	Data    any    `json:"data,omitempty"` // 响应数据（成功时返回）
}

// SuccessResponse 创建成功响应
func SuccessResponse(data any) Response {
	return Response{Success: true, Message: "Success", Data: data}
}

// ErrorResponse 创建错误响应
func ErrorResponse(message string) Response {
	return Response{Success: false, Message: message}
}

// WriteErrorResponse 写入错误响应到 HTTP 响应流
func WriteErrorResponse(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(ErrorResponse(message))
}

// RespondWithError 写入错误响应（WriteErrorResponse 的简短别名）
func RespondWithError(w http.ResponseWriter, message string, statusCode int) {
	WriteErrorResponse(w, message, statusCode)
}
