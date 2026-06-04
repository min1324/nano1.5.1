package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"nano/internal/model"
)

// 常用错误
var (
	errBadRequest = errors.New("bad request")
)

// respondWithSuccess 返回成功响应
func respondWithSuccess(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := json.NewEncoder(w).Encode(model.SuccessResponse(data)); err != nil {
		http.Error(w, "响应编码失败", http.StatusInternalServerError)
	}
}

// respondWithError 返回错误响应
func respondWithError(w http.ResponseWriter, message string, statusCode int) {
	model.RespondWithError(w, message, statusCode)
}
