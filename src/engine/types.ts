// 洛雪音源运行时引擎 — 类型定义
// 从 Go 版 plugins/songloft-plugin-lxmusic/engine/types.go 翻译

/** 音源配置（从 JS inited 事件解析） */
export interface SourceConfig {
  sources: Record<string, SourceEntry>;
}

/** 单个音源平台配置 */
export interface SourceEntry {
  name: string;
  type: string;
  actions: string[];
  qualitys: string[];
}

/** 运行时统计信息 */
export interface RuntimeStats {
  totalCalls: number;
  successCalls: number;
}

/** 请求事件的负载 */
export interface RequestPayload {
  source: string;
  action: string;
  info: Record<string, unknown>;
}

/** 脚本元数据（从 JSDoc 注释解析） */
export interface ScriptInfo {
  name: string;
  description: string;
  version: string;
  author: string;
  homepage: string;
}

/** handler 同步调用结果 */
export interface HandlerResult {
  value?: unknown;
  error?: unknown;
}
