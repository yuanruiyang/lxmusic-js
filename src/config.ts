// 洛雪音源插件 — 配置模块
// 持久化存储插件设置：默认搜索平台、默认音质

/// <reference types="@songloft/plugin-sdk" />

const CONFIG_KEY = 'lxmusic_config';

export interface LxMusicConfig {
  /** 默认搜索平台列表（topone 聚合搜索使用） */
  defaultPlatforms: string[];
  /** 默认音质（topone 忽略调用方传入的 quality，始终使用此值） */
  defaultQuality: string;
}

const DEFAULT_CONFIG: LxMusicConfig = {
  defaultPlatforms: ['kg', 'kw', 'tx', 'wy', 'mg'],
  defaultQuality: '320k',
};

/**
 * 读取配置，与默认值合并（存储中缺少的字段回退到默认值）
 */
export async function getConfig(): Promise<LxMusicConfig> {
  try {
    const raw = await songloft.storage.get(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const stored = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { ...DEFAULT_CONFIG, ...stored };
  } catch (e: any) {
    songloft.log.warn(`getConfig: parse error, using defaults: ${e.message || e}`);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 保存配置
 */
export async function saveConfig(config: LxMusicConfig): Promise<void> {
  await songloft.storage.set(CONFIG_KEY, JSON.stringify(config));
}
