// 洛雪音源插件 — 统一 API 响应封装
//
// 所有 handler 都返回同一个 envelope，方便前端统一处理：
//
//   { code: number, msg: string, data?: any, warning?: string }
//
// 约定：
//   - 成功：HTTP 200，code = 0，msg = 'success'，data 是业务数据
//   - 成功带警告：同上，外加 warning 字段（例如音源已保存但运行时加载失败）
//   - 失败：HTTP <statusCode>（4xx/5xx），code = statusCode，msg = 错误描述
//
// 前端永远只判 result.code === 0；错误显示读 result.msg。

import { jsonResponse } from '@songloft/plugin-sdk';
import type { HTTPResponse } from '@songloft/plugin-sdk';

/** 成功响应：HTTP 200，{code:0, msg:'success', data} */
export function successResponse(data: unknown = null): HTTPResponse {
  return jsonResponse({ code: 0, msg: 'success', data });
}

/** 成功带警告：data 已保存但有非致命问题（例如运行时加载失败） */
export function successWithWarning(data: unknown, warning: string): HTTPResponse {
  return jsonResponse({ code: 0, msg: 'success', data, warning });
}

/** 错误响应：HTTP <statusCode>，{code: statusCode, msg, data: null} */
export function errorResponse(statusCode: number, msg: string): HTTPResponse {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: statusCode, msg, data: null }),
  };
}
