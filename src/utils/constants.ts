export const STORAGE_KEYS = {
  API_KEY: 'api_key',
  BASE_URL: 'base_url',
} as const;

export const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/**
 * 获取浏览器的默认语言
 * @returns 浏览器语言代码，例如 'zh-CN', 'en-US', 'ja' 等
 */
export function getBrowserLanguage(): string {
  // 优先使用 navigator.language，如果没有则使用 navigator.languages[0]
  // 如果都没有，则使用 'en' 作为后备
  return navigator.language || navigator.languages?.[0] || 'en';
}

/**
 * 检测文章的主要语言
 * @param content 文章内容
 * @returns 检测到的语言代码，如果无法检测则返回浏览器语言
 */
export function detectContentLanguage(content: string): string {
  if (!content || content.length === 0) {
    return getBrowserLanguage();
  }

  // 简单的语言检测：基于常见字符范围
  // 中文字符范围（包括中文标点）
  const chinesePattern = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g;
  // 日文字符范围
  const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/g;
  // 韩文字符范围
  const koreanPattern = /[\uac00-\ud7af]/g;
  
  const chineseCount = (content.match(chinesePattern) || []).length;
  const japaneseCount = (content.match(japanesePattern) || []).length;
  const koreanCount = (content.match(koreanPattern) || []).length;
  const totalChars = content.length;
  
  // 如果中文字符占比超过 5%，认为是中文（降低阈值以提高检测率）
  if (chineseCount > 0 && chineseCount / totalChars > 0.05) {
    return 'zh-CN';
  }
  // 如果日文字符占比超过 5%，认为是日文
  if (japaneseCount > 0 && japaneseCount / totalChars > 0.05) {
    return 'ja';
  }
  // 如果韩文字符占比超过 5%，认为是韩文
  if (koreanCount > 0 && koreanCount / totalChars > 0.05) {
    return 'ko';
  }
  
  // 如果检测到中文字符但未达到阈值，仍然认为是中文
  if (chineseCount > 10) {
    return 'zh-CN';
  }
  
  // 默认返回浏览器语言
  return getBrowserLanguage();
}

/**
 * 将语言代码转换为AI可理解的语言名称
 * @param langCode 语言代码，如 'zh-CN', 'en-US', 'ja' 等
 * @returns AI可理解的语言名称，如 'Chinese', 'English', 'Japanese' 等
 */
export function getLanguageNameForAI(langCode: string): string {
  const lang = langCode.toLowerCase();
  
  if (lang.startsWith('zh')) {
    return 'Chinese';
  } else if (lang.startsWith('ja')) {
    return 'Japanese';
  } else if (lang.startsWith('ko')) {
    return 'Korean';
  } else if (lang.startsWith('fr')) {
    return 'French';
  } else if (lang.startsWith('de')) {
    return 'German';
  } else if (lang.startsWith('es')) {
    return 'Spanish';
  } else if (lang.startsWith('ru')) {
    return 'Russian';
  } else if (lang.startsWith('pt')) {
    return 'Portuguese';
  } else if (lang.startsWith('it')) {
    return 'Italian';
  } else {
    return 'English';
  }
}
