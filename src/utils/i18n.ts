export type Language = 'zh-CN' | 'en-US';

export interface I18nStrings {
  // Popup
  popup: {
    title: string;
    apiKeyLabel: string;
    apiKeyPlaceholder: string;
    baseUrlLabel: string;
    baseUrlPlaceholder: string;
    saveButton: string;
    saveSuccess: string;
    saveError: string;
    apiKeyRequired: string;
    securityHint: string;
  };
  // Panel
    panel: {
      title: string;
      academicMode: string;
      close: string;
      summary: string;
      translate: string;
      ask: string;
      summarizeButton: string;
      summarizePage: string;
      cancel: string;
      translateButton: string;
      immersiveTranslateButton: string;
      startImmersiveTranslation: string;
      targetLanguage: string;
      selectTextHint: string;
      translating: string;
      paused: string;
      cancelled: string;
      completed: string;
      questionPlaceholder: string;
      askButton: string;
      clearHistory: string;
      clearSummaryHistory: string;
      original: string;
      translation: string;
      answer: string;
      keyPoints: string;
      citations: string;
      copy: string;
      copySuccess: string;
      copyFailed: string;
      noSummaryHistory: string;
      immersiveModeActive: string;
      immersiveModeDesc: string;
      clear: string;
      you: string;
      assistant: string;
      processing: string;
    };
  // Selection Translator
    selection: {
      translate: string;
      ask: string;
      summary: string;
      translating: string;
      error: string;
      apiKeyRequired: string;
      copy: string;
      copySuccess: string;
      copyFailed: string;
    };
  // Quick Chat
    quickChat: {
      quickSummary: string;
      quickAsk: string;
      summarizing: string;
      summary: string;
      keyPoints: string;
      selectedText: string;
      yourQuestion: string;
      askQuestion: string;
      answer: string;
      gettingAnswer: string;
      error: string;
      cancelled: string;
      pause: string;
      resume: string;
      cancel: string;
      backgroundHint: string;
      copy: string;
      copySuccess: string;
      copyFailed: string;
    };
}

const translations: Record<Language, I18nStrings> = {
  'zh-CN': {
    popup: {
      title: '阅读助手设置',
      apiKeyLabel: 'API 密钥 *',
      apiKeyPlaceholder: '请输入您的 API 密钥',
      baseUrlLabel: '基础 URL（可选）',
      baseUrlPlaceholder: 'https://api.openai.com/v1',
      saveButton: '保存',
      saveSuccess: '配置已保存！',
      saveError: '保存配置失败',
      apiKeyRequired: '请输入 API 密钥',
      securityHint: 'API key 仅存储在本地，不会同步到云端',
    },
    panel: {
      title: '阅读助手',
      academicMode: '学术模式',
      close: '关闭',
      summary: '摘要',
      translate: '翻译',
      ask: '提问',
      summarizeButton: '生成摘要',
      summarizePage: '总结当前页面',
      cancel: '取消',
      translateButton: '翻译整页',
      immersiveTranslateButton: '沉浸式翻译',
      startImmersiveTranslation: '开始沉浸式翻译',
      targetLanguage: '目标语言',
      selectTextHint: '选择页面上的文本即可快速翻译',
      translating: '翻译中...',
      paused: '已暂停',
      cancelled: '已取消',
      completed: '已完成',
      questionPlaceholder: '询问关于内容的问题...',
      askButton: '提问',
      clearHistory: '清除历史',
      clearSummaryHistory: '清除总结历史',
      original: '原文',
      translation: '翻译',
      answer: '答案',
      keyPoints: '要点',
      citations: '引用',
      copy: '复制',
      copySuccess: '已复制到剪贴板',
      copyFailed: '复制失败',
      noSummaryHistory: '暂无总结历史',
      immersiveModeActive: '沉浸式模式已激活',
      immersiveModeDesc: '翻译内容显示在原文旁边',
      clear: '清除',
      you: '您',
      assistant: '助手',
      processing: '处理中...',
    },
    selection: {
      translate: '翻译',
      ask: '提问',
      summary: '总结',
      translating: '翻译中...',
      error: '错误',
      apiKeyRequired: '请在扩展弹窗中配置 API 密钥',
      copy: '复制',
      copySuccess: '已复制',
      copyFailed: '复制失败',
    },
    quickChat: {
      quickSummary: '快速总结',
      quickAsk: '快速提问',
      summarizing: '正在总结...',
      summary: '摘要',
      keyPoints: '要点',
      selectedText: '选中文本',
      yourQuestion: '您的问题',
      askQuestion: '提问',
      answer: '答案',
      gettingAnswer: '正在获取答案...',
      error: '错误',
      cancelled: '已取消',
      pause: '暂停',
      resume: '继续',
      cancel: '取消',
      backgroundHint: '您可以最小化此窗口并继续浏览。总结将在后台继续。',
      copy: '复制',
      copySuccess: '已复制到剪贴板',
      copyFailed: '复制失败',
    },
  },
  'en-US': {
    popup: {
      title: 'Reader Assistant Settings',
      apiKeyLabel: 'API Key *',
      apiKeyPlaceholder: 'Enter your API key',
      baseUrlLabel: 'Base URL (Optional)',
      baseUrlPlaceholder: 'https://api.openai.com/v1',
      saveButton: 'Save',
      saveSuccess: 'Configuration saved!',
      saveError: 'Failed to save configuration',
      apiKeyRequired: 'Please enter API key',
      securityHint: 'API key is stored locally only and will not sync to cloud',
    },
    panel: {
      title: 'Reader Assistant',
      academicMode: 'Academic Mode',
      close: 'Close',
      summary: 'Summary',
      translate: 'Translate',
      ask: 'Ask',
      summarizeButton: 'Generate Summary',
      summarizePage: 'Summarize Page',
      cancel: 'Cancel',
      translateButton: 'Translate Full Page',
      immersiveTranslateButton: 'Immersive Mode',
      startImmersiveTranslation: 'Start Immersive Translation',
      targetLanguage: 'Target Language',
      selectTextHint: 'Select text on page to translate instantly',
      translating: 'Translating...',
      paused: 'Paused',
      cancelled: 'Cancelled',
      completed: 'Completed',
      questionPlaceholder: 'Ask a question about the content...',
      askButton: 'Ask',
      clearHistory: 'Clear History',
      clearSummaryHistory: 'Clear Summary History',
      original: 'ORIGINAL',
      translation: 'TRANSLATION',
      answer: 'Answer',
      keyPoints: 'Key Points',
      citations: 'Citations',
      copy: 'Copy',
      copySuccess: 'Copied to clipboard',
      copyFailed: 'Copy failed',
      noSummaryHistory: 'No summary history',
      immersiveModeActive: 'Immersive Mode Active',
      immersiveModeDesc: 'Translations are shown inline with the original text',
      clear: 'Clear',
      you: 'You',
      assistant: 'Assistant',
      processing: 'Processing...',
    },
    selection: {
      translate: 'Translate',
      ask: 'Ask',
      summary: 'Summary',
      translating: 'Translating...',
      error: 'Error',
      apiKeyRequired: 'Please configure API key in extension popup',
      copy: 'Copy',
      copySuccess: 'Copied',
      copyFailed: 'Copy failed',
    },
    quickChat: {
      quickSummary: 'Quick Summary',
      quickAsk: 'Quick Ask',
      summarizing: 'Summarizing...',
      summary: 'Summary',
      keyPoints: 'Key Points',
      selectedText: 'Selected Text',
      yourQuestion: 'Your Question',
      askQuestion: 'Ask Question',
      answer: 'Answer',
      gettingAnswer: 'Getting answer...',
      error: 'Error',
      cancelled: 'Cancelled',
      pause: 'Pause',
      resume: 'Resume',
      cancel: 'Cancel',
      backgroundHint: 'You can minimize this window and continue browsing. The summary will continue in the background.',
      copy: 'Copy',
      copySuccess: 'Copied to clipboard',
      copyFailed: 'Copy failed',
    },
  },
};

class I18nService {
  private currentLanguage: Language = 'zh-CN';
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadLanguage();
  }

  async loadLanguage(): Promise<void> {
    const result = await chrome.storage.sync.get('language');
    if (result.language && (result.language === 'zh-CN' || result.language === 'en-US')) {
      this.currentLanguage = result.language;
    } else {
      // 默认使用浏览器语言
      const browserLang = navigator.language || navigator.languages?.[0] || 'en-US';
      this.currentLanguage = browserLang.startsWith('zh') ? 'zh-CN' : 'en-US';
    }
    this.notifyListeners();
  }

  async setLanguage(language: Language): Promise<void> {
    this.currentLanguage = language;
    await chrome.storage.sync.set({ language });
    this.notifyListeners();
  }

  getLanguage(): Language {
    return this.currentLanguage;
  }

  t(): I18nStrings {
    return translations[this.currentLanguage];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

export const i18n = new I18nService();

