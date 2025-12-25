import { AISummary, AIResponse, Message } from '../utils/types';

/**
 * 安全的 AI 服务代理
 * API key 只在 Service Worker 中使用，不暴露到 Content Script
 */
export class SecureAIService {
  private requestId: number = 0;

  async summarize(
    content: string,
    isPDF: boolean = false,
    onChunk?: (chunk: string) => void,
    targetLanguage?: string | null
  ): Promise<AISummary> {
    return this.sendRequest('summarize', {
      content,
      isPDF,
      targetLanguage,
      stream: !!onChunk,
    }, onChunk);
  }

  async translate(content: string, targetLang: string | null = null): Promise<string> {
    const result = await this.sendRequest('translate', {
      content,
      targetLang,
    });
    return result.translated;
  }

  async translateLines(
    lines: string[],
    targetLang: string | null = null,
    onProgress?: (current: number, total: number) => void,
    shouldCancel?: () => boolean
  ): Promise<string[]> {
    return this.sendRequest('translateLines', {
      lines,
      targetLang,
      onProgress: !!onProgress,
      shouldCancel: !!shouldCancel,
    }, undefined, onProgress, shouldCancel);
  }

  async answerQuestion(
    question: string,
    content: string,
    isPDF: boolean = false
  ): Promise<AIResponse> {
    return this.sendRequest('answerQuestion', {
      question,
      content,
      isPDF,
    });
  }

  async answerWithHistory(
    question: string,
    content: string,
    history: Message[] = [],
    isPDF: boolean = false,
    onChunk?: (chunk: string) => void
  ): Promise<AIResponse> {
    return this.sendRequest('answerWithHistory', {
      question,
      content,
      history,
      isPDF,
      stream: !!onChunk,
    }, onChunk);
  }

  cancel(): void {
    chrome.runtime.sendMessage({
      type: 'ai-cancel',
    });
  }

  private async sendRequest(
    method: string,
    params: any,
    onChunk?: (chunk: string) => void,
    onProgress?: (current: number, total: number) => void,
    shouldCancel?: () => boolean
  ): Promise<any> {
    const id = ++this.requestId;
    
    return new Promise((resolve, reject) => {
      // 设置消息监听器
      const messageListener = (message: any) => {
        if (message.type === `ai-response-${id}`) {
          chrome.runtime.onMessage.removeListener(messageListener);
          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message.data);
          }
        } else if (message.type === `ai-chunk-${id}` && onChunk) {
          onChunk(message.chunk);
        } else if (message.type === `ai-progress-${id}` && onProgress) {
          onProgress(message.current, message.total);
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);

      // 发送请求到 Service Worker
      chrome.runtime.sendMessage({
        type: 'ai-request',
        id,
        method,
        params,
      }).catch((error) => {
        chrome.runtime.onMessage.removeListener(messageListener);
        reject(error);
      });

      // 如果支持取消，定期检查
      if (shouldCancel) {
        const checkInterval = setInterval(() => {
          if (shouldCancel()) {
            clearInterval(checkInterval);
            chrome.runtime.onMessage.removeListener(messageListener);
            this.cancel();
            reject(new Error('Request cancelled'));
          }
        }, 100);
      }
    });
  }
}

