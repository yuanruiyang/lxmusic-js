// 洛雪音源插件 — 内部类型定义

/// <reference types="@songloft/plugin-sdk" />

/** 导入歌曲请求 */
export interface ImportSongsRequest {
  songs: ImportSongItem[];
  quality: string;
  playlist_id?: number;
  new_playlist_name?: string;
}

/** 导入歌曲条目 */
export interface ImportSongItem {
  name: string;
  singer: string;
  source: string;
  musicId: string;
  album?: string;
  albumId?: string;
  duration?: number;
  img?: string;
  types?: Array<{ type: string; size?: string; hash?: string }>;
  hash?: string;
  copyrightId?: string;
  strMediaMid?: string;
  albumMid?: string;
  songmid?: string;
}

/** 导入结果 */
export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  results: Array<{ name: string; success: boolean; error?: string }>;
  playlist_id?: number;
  playlist_name?: string;
}
