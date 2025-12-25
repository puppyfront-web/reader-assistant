import { AIService } from '../services/ai-service';
import { QuickChat } from '../ui/quick-chat';
import { getBrowserLanguage } from '../utils/constants';
import { i18n } from '../utils/i18n';
import { copyToClipboard, showCopySuccess, processMathFormulas } from '../utils/copy-utils';

export class SelectionTranslator {
  private bubble: HTMLDivElement | null = null;
  private aiService: AIService | null = null;
  private targetLang: string = getBrowserLanguage();
  private isTranslating: boolean = false;
  private selectedText: string = '';
  private onAskCallback: ((text: string) => void) | null = null;
  private quickChat: QuickChat | null = null;

  constructor(aiService: AIService | null, targetLang: string | null = null) {
    this.aiService = aiService;
    this.targetLang = targetLang || getBrowserLanguage();
    this.quickChat = new QuickChat(aiService);
    this.init();
  }

  setAskCallback(callback: (text: string) => void): void {
    this.onAskCallback = callback;
  }

  setTargetLang(lang: string): void {
    this.targetLang = lang;
  }

  setAIService(aiService: AIService): void {
    this.aiService = aiService;
    if (this.quickChat) {
      this.quickChat.setAIService(aiService);
    }
  }

  private init(): void {
    document.addEventListener('mouseup', (e) => this.handleSelection(e));
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Escape') {
        this.hideBubble();
      }
    });
    
    document.addEventListener('click', (e) => {
      if (this.bubble && !this.bubble.contains(e.target as Node)) {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim().length === 0) {
          this.hideBubble();
          // 只有在真正隐藏气泡时才清除选中状态
          window.getSelection()?.removeAllRanges();
        }
      }
    });
  }

  private handleSelection(_event: MouseEvent): void {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText || selectedText.length < 2) {
        this.hideBubble();
        return;
      }

      if (this.isTranslating) {
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      this.selectedText = selectedText;
      this.showActionBubble(selectedText, rect);
    }, 100);
  }

  private showActionBubble(text: string, rect: DOMRect): void {
    this.createActionBubble(rect);
    this.selectedText = text;
  }

  private createActionBubble(rect: DOMRect): void {
    // 移除所有现有的气泡，避免重复显示
    this.hideBubble();
    const existingBubble = document.getElementById('reader-assistant-action-bubble');
    if (existingBubble) existingBubble.remove();
    const existingResultBubble = document.getElementById('reader-assistant-result-bubble');
    if (existingResultBubble) existingResultBubble.remove();

    this.bubble = document.createElement('div');
    this.bubble.id = 'reader-assistant-action-bubble';
    // 先设置临时位置，adjustBubblePosition 会调整到正确位置
    this.bubble.style.cssText = `
      position: fixed;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: auto;
      display: flex;
      gap: 4px;
      padding: 6px;
    `;

    const t = i18n.t();
    const actions = [
      { icon: '🌐', label: t.selection.translate, handler: () => this.handleTranslate() },
      { icon: '💬', label: t.selection.ask, handler: () => this.handleAsk() },
      { icon: '📝', label: t.selection.summary, handler: () => this.handleSummary() },
    ];

    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.innerHTML = `<span style="font-size: 16px;">${action.icon}</span>`;
      btn.title = action.label;
      btn.style.cssText = `
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 40px;
        height: 40px;
      `;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        action.handler();
      });
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#f3f4f6';
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#ffffff';
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = 'none';
      });
      this.bubble?.appendChild(btn);
    });

    if (this.bubble) {
      document.body.appendChild(this.bubble);
      this.adjustBubblePosition(rect);
    }
  }

  private async handleTranslate(): Promise<void> {
    if (!this.selectedText) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    await this.showTranslationBubble(this.selectedText, rect);
  }

  private handleAsk(): void {
    if (!this.selectedText) return;
    
    const t = i18n.t();
    if (!this.aiService) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      this.showErrorBubble(t.selection.apiKeyRequired, rect);
      return;
    }
    
    this.hideBubble();

    if (this.quickChat) {
      this.quickChat.show(this.selectedText, 'ask');
    } else if (this.onAskCallback) {
      this.onAskCallback(this.selectedText);
    }
  }

  private handleSummary(): void {
    if (!this.selectedText) return;
    
    const t = i18n.t();
    if (!this.aiService) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      this.showErrorBubble(t.selection.apiKeyRequired, rect);
      return;
    }
    
    this.hideBubble();

    if (this.quickChat) {
      this.quickChat.show(this.selectedText, 'summarize');
    } else if (this.onAskCallback) {
      this.onAskCallback(`Please summarize the following text: ${this.selectedText}`);
    }
  }

  private async showTranslationBubble(text: string, rect: DOMRect): Promise<void> {
    const t = i18n.t();
    if (!this.aiService) {
      this.showErrorBubble(t.selection.apiKeyRequired, rect);
      return;
    }

    this.isTranslating = true;
    this.createResultBubble(rect, t.selection.translating, true);

    try {
      const translated = await this.aiService.translate(text, this.targetLang);
      this.createResultBubble(rect, `
        <div style="margin-bottom: 8px;">
          <div style="font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 6px;">${i18n.t().panel.original}</div>
          <div style="color: #374151; line-height: 1.5;">${text}</div>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 8px;">
          <div style="font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 6px;">${i18n.t().panel.translation}</div>
          <div style="color: #111827; line-height: 1.5; font-weight: 500;">${translated.replace(/\n/g, '<br>')}</div>
        </div>
      `, false);
    } catch (error) {
      const t = i18n.t();
      const errorMsg = error instanceof Error ? error.message : t.selection.error;
      this.createResultBubble(rect, `${t.selection.error}: ${errorMsg}`, false, true);
    } finally {
      this.isTranslating = false;
    }
  }

  private createResultBubble(rect: DOMRect, content: string, isLoading: boolean, isError: boolean = false): void {
    // 移除所有现有的气泡，避免重复显示
    this.hideBubble();
    const existingBubble = document.getElementById('reader-assistant-action-bubble');
    if (existingBubble) existingBubble.remove();
    const existingResultBubble = document.getElementById('reader-assistant-result-bubble');
    if (existingResultBubble) existingResultBubble.remove();

    this.bubble = document.createElement('div');
    this.bubble.id = 'reader-assistant-result-bubble';
    // 先设置临时位置，adjustBubblePosition 会调整到正确位置
    this.bubble.style.cssText = `
      position: fixed;
      max-width: 500px;
      min-width: 300px;
      padding: 14px 16px;
      background: ${isError ? '#fef2f2' : '#ffffff'};
      border: 1px solid ${isError ? '#ef4444' : '#e5e7eb'};
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: ${isError ? '#dc2626' : '#111827'};
      pointer-events: auto;
      opacity: 1;
      transform: translateY(0) scale(1);
      transition: opacity 0.4s ease-out, transform 0.4s ease-out;
    `;

    // 按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 4px;
      align-items: center;
    `;

    // 复制按钮
    const copyBtn = document.createElement('button');
    const t = i18n.t();
    copyBtn.innerHTML = '📋';
    copyBtn.title = t.selection.copy;
    copyBtn.style.cssText = `
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 14px;
      color: #6b7280;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    `;
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      // 查找内容区域（排除按钮容器）
      const contentDiv = this.bubble?.querySelector('div[style*="padding-right"]') as HTMLElement;
      if (contentDiv) {
        const htmlContent = processMathFormulas(contentDiv.innerHTML);
        const plainText = contentDiv.textContent || contentDiv.innerText || '';
        const success = await copyToClipboard(htmlContent, plainText);
        if (success) {
          showCopySuccess(copyBtn, t.selection.copySuccess);
        }
      } else {
        // 如果没有找到内容 div，尝试复制整个气泡的文本内容（排除按钮）
        const bubbleText = this.bubble?.cloneNode(true) as HTMLElement;
        if (bubbleText) {
          // 移除按钮容器
          const buttonContainer = bubbleText.querySelector('div[style*="display: flex"]');
          if (buttonContainer) {
            buttonContainer.remove();
          }
          const htmlContent = processMathFormulas(bubbleText.innerHTML);
          const plainText = bubbleText.textContent || bubbleText.innerText || '';
          const success = await copyToClipboard(htmlContent, plainText);
          if (success) {
            showCopySuccess(copyBtn, t.selection.copySuccess);
          }
        }
      }
    });
    copyBtn.addEventListener('mouseenter', () => {
      copyBtn.style.background = '#f3f4f6';
      copyBtn.style.transform = 'scale(1.1)';
    });
    copyBtn.addEventListener('mouseleave', () => {
      copyBtn.style.background = 'transparent';
      copyBtn.style.transform = 'scale(1)';
    });

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 20px;
      color: #6b7280;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.2s;
    `;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.hideBubble();
    });
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#f3f4f6';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent';
    });

    buttonContainer.appendChild(copyBtn);
    buttonContainer.appendChild(closeBtn);
    this.bubble.appendChild(buttonContainer);

    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = 'padding-right: 24px;';

    if (isLoading) {
      contentDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; color: #6b7280;">
          <div style="
            width: 16px;
            height: 16px;
            border: 2px solid #e5e7eb;
            border-top-color: #22c55e;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            flex-shrink: 0;
          "></div>
          <span>${content}</span>
        </div>
      `;
    } else {
      // 如果是错误提示，添加图标和更好的样式
      if (isError) {
        contentDiv.innerHTML = `
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <div style="
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #fee2e2;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              margin-top: 2px;
            ">
              <span style="color: #dc2626; font-size: 14px; font-weight: bold;">!</span>
            </div>
            <div style="flex: 1; line-height: 1.6; color: #dc2626;">
              ${content}
            </div>
          </div>
        `;
      } else {
        contentDiv.innerHTML = content;
      }
    }

    this.bubble.appendChild(contentDiv);
    document.body.appendChild(this.bubble);
    this.adjustBubblePosition(rect);
  }


  private adjustBubblePosition(rect: DOMRect): void {
    if (!this.bubble) return;

    const bubbleRect = this.bubble.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 计算水平位置：居中显示在选中文本上方
    let left = rect.left + window.scrollX + (rect.width / 2) - (bubbleRect.width / 2);
    
    // 计算垂直位置：显示在选中文本上方
    let top = rect.top + window.scrollY - bubbleRect.height - 8;

    // 水平边界检查
    if (left + bubbleRect.width > viewportWidth + window.scrollX) {
      left = viewportWidth + window.scrollX - bubbleRect.width - 16;
    }

    if (left < window.scrollX) {
      left = window.scrollX + 16;
    }

    // 垂直边界检查：如果上方空间不足，则显示在下方
    if (top < window.scrollY) {
      top = rect.bottom + window.scrollY + 8;
      // 如果下方也不够，则调整到可见区域
      if (top + bubbleRect.height > viewportHeight + window.scrollY) {
        top = Math.max(window.scrollY + 10, viewportHeight + window.scrollY - bubbleRect.height - 10);
      }
    }

    this.bubble.style.left = `${left}px`;
    this.bubble.style.top = `${top}px`;
  }

  private showErrorBubble(message: string, rect: DOMRect): void {
    // 移除现有的气泡
    this.hideBubble();
    
    // 创建错误提示气泡，带有更长的显示时间和缓和的动画
    this.createResultBubble(rect, message, false, true);
    
    // 添加缓和的进入动画
    if (this.bubble) {
      this.bubble.style.opacity = '0';
      this.bubble.style.transform = 'translateY(-10px) scale(0.95)';
      this.bubble.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
      
      // 使用 requestAnimationFrame 确保样式已应用
      requestAnimationFrame(() => {
        if (this.bubble) {
          this.bubble.style.opacity = '1';
          this.bubble.style.transform = 'translateY(0) scale(1)';
        }
      });
      
      // 延长显示时间：8秒后自动隐藏，带有缓和的退出动画
      setTimeout(() => {
        if (this.bubble) {
          this.bubble.style.opacity = '0';
          this.bubble.style.transform = 'translateY(-10px) scale(0.95)';
          this.bubble.style.transition = 'opacity 0.5s ease-in, transform 0.5s ease-in';
          
          setTimeout(() => {
            this.hideBubble();
          }, 500); // 等待退出动画完成
        }
      }, 8000); // 显示8秒
    }
  }

  hideBubble(): void {
    if (this.bubble) {
      this.bubble.remove();
      this.bubble = null;
    }
    // 同时移除可能存在的其他气泡
    const existingBubble = document.getElementById('reader-assistant-action-bubble');
    if (existingBubble && existingBubble !== this.bubble) existingBubble.remove();
    const existingResultBubble = document.getElementById('reader-assistant-result-bubble');
    if (existingResultBubble && existingResultBubble !== this.bubble) existingResultBubble.remove();
    // 注意：不在这里清除选中状态，保持文本选中状态以便用户继续操作
  }

  destroy(): void {
    this.hideBubble();
    document.removeEventListener('mouseup', this.handleSelection);
  }
}

