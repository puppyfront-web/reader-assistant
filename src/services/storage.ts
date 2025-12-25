import { Config } from '../utils/types';
import { STORAGE_KEYS } from '../utils/constants';

/**
 * 存储服务
 * 使用 chrome.storage.local 而不是 sync，避免 API key 同步到云端
 * 如果需要跨设备同步，建议用户使用加密存储或手动配置
 */
export class StorageService {
  /**
   * 获取配置
   * 注意：返回的 config 中 apiKey 可能为空（如果使用安全模式）
   */
  static async getConfig(): Promise<Config> {
    // 优先使用 local storage（不跨设备同步，更安全）
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.API_KEY,
      STORAGE_KEYS.BASE_URL,
    ]);
    
    return {
      apiKey: result[STORAGE_KEYS.API_KEY] || '',
      baseUrl: result[STORAGE_KEYS.BASE_URL] || '',
    };
  }

  /**
   * 保存配置
   * 使用 local storage 避免 API key 同步到云端
   */
  static async saveConfig(config: Config): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.API_KEY]: config.apiKey,
      [STORAGE_KEYS.BASE_URL]: config.baseUrl || '',
    });
  }

  /**
   * 检查 API key 是否存在（不返回实际值）
   */
  static async hasApiKey(): Promise<boolean> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
    return !!result[STORAGE_KEYS.API_KEY];
  }

  /**
   * 清除所有配置（包括 API key）
   */
  static async clearConfig(): Promise<void> {
    await chrome.storage.local.remove([
      STORAGE_KEYS.API_KEY,
      STORAGE_KEYS.BASE_URL,
    ]);
  }

  /**
   * 获取指定URL的历史记录
   */
  static async getHistory(url: string): Promise<any> {
    const key = `history_${url}`;
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  }

  /**
   * 保存指定URL的历史记录
   */
  static async saveHistory(url: string, data: any): Promise<void> {
    const key = `history_${url}`;
    await chrome.storage.local.set({ [key]: data });
  }

  /**
   * 清除指定URL的历史记录
   */
  static async clearHistory(url: string): Promise<void> {
    const key = `history_${url}`;
    await chrome.storage.local.remove(key);
  }
}
