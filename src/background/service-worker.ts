import { Config } from '../utils/types';
import { STORAGE_KEYS, DEFAULT_BASE_URL } from '../utils/constants';
import { AIService } from '../services/ai-service';

// 全局 AI Service 实例（只在 Service Worker 中）
let aiService: AIService | null = null;
let currentRequestId: number = 0;
const activeRequests = new Map<number, AbortController>();

// 初始化 AI Service
async function initAIService(): Promise<void> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.BASE_URL,
  ]);
  
  if (result[STORAGE_KEYS.API_KEY]) {
    const config: Config = {
      apiKey: result[STORAGE_KEYS.API_KEY],
      baseUrl: result[STORAGE_KEYS.BASE_URL] || DEFAULT_BASE_URL,
    };
    aiService = new AIService(config);
  }
}

// 监听存储变化，更新 AI Service
chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEYS.API_KEY] || changes[STORAGE_KEYS.BASE_URL]) {
    initAIService();
  }
});

// 处理 AI 请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ai-request') {
    // 保存 sender 信息以便后续回复
    const tabId = sender.tab?.id;
    handleAIRequest(message, tabId).catch((error) => {
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: `ai-response-${message.id}`,
          error: error.message,
        }).catch(() => {});
      }
    });
    return true; // 保持消息通道开放
  } else if (message.type === 'ai-cancel') {
    // 取消所有活动请求
    activeRequests.forEach((controller) => {
      controller.abort();
    });
    activeRequests.clear();
    if (aiService) {
      aiService.cancel();
    }
  }
  return false;
});

async function handleAIRequest(message: any, tabId?: number): Promise<void> {
  if (!aiService) {
    await initAIService();
    if (!aiService) {
      throw new Error('API key not configured');
    }
  }

  const { id, method, params } = message;
  const abortController = new AbortController();
  activeRequests.set(id, abortController);

  try {
    switch (method) {
      case 'summarize': {
        const result = await aiService.summarize(
          params.content,
          params.isPDF,
          params.stream && tabId ? (chunk: string) => {
            chrome.tabs.sendMessage(tabId, {
              type: `ai-chunk-${id}`,
              chunk,
            }).catch(() => {});
          } : undefined,
          params.targetLanguage,
          () => abortController.signal.aborted
        );
        chrome.tabs.sendMessage(message.tabId || 0, {
          type: `ai-response-${id}`,
          data: result,
        }).catch(() => {});
        break;
      }
      case 'translate': {
        const translated = await aiService.translate(
          params.content,
          params.targetLang
        );
        if (tabId) {
          chrome.tabs.sendMessage(tabId, {
            type: `ai-response-${id}`,
            data: { translated },
          }).catch(() => {});
        }
        break;
      }
      case 'translateLines': {
        const results = await aiService.translateLines(
          params.lines,
          params.targetLang,
          params.onProgress && tabId ? (current: number, total: number) => {
            chrome.tabs.sendMessage(tabId, {
              type: `ai-progress-${id}`,
              current,
              total,
            }).catch(() => {});
          } : undefined,
          () => abortController.signal.aborted
        );
        if (tabId) {
          chrome.tabs.sendMessage(tabId, {
            type: `ai-response-${id}`,
            data: results,
          }).catch(() => {});
        }
        break;
      }
      case 'answerQuestion': {
        const result = await aiService.answerQuestion(
          params.question,
          params.content,
          params.isPDF
        );
        chrome.tabs.sendMessage(message.tabId || 0, {
          type: `ai-response-${id}`,
          data: result,
        }).catch(() => {});
        break;
      }
      case 'answerWithHistory': {
        const result = await aiService.answerWithHistory(
          params.question,
          params.content,
          params.history,
          params.isPDF,
          params.stream && tabId ? (chunk: string) => {
            chrome.tabs.sendMessage(tabId, {
              type: `ai-chunk-${id}`,
              chunk,
            }).catch(() => {});
          } : undefined
        );
        chrome.tabs.sendMessage(message.tabId || 0, {
          type: `ai-response-${id}`,
          data: result,
        }).catch(() => {});
        break;
      }
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: `ai-response-${id}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      }).catch(() => {});
    }
  } finally {
    activeRequests.delete(id);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Reader Assistant installed');
  initAIService();
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
  }
});

// 初始化
initAIService();

