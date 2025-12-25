import { AIService } from '../services/ai-service';
import { detectContentLanguage, getBrowserLanguage } from '../utils/constants';
import { i18n } from '../utils/i18n';
import { copyToClipboard, showCopySuccess, processMathFormulas } from '../utils/copy-utils';

export class QuickChat {
  private dialog: HTMLDivElement | null = null;
  private backdrop: HTMLDivElement | null = null;
  private aiService: AIService | null = null;
  private contextText: string = '';
  private isCancelled: boolean = false;
  private isPaused: boolean = false;
  private summaryPromise: Promise<any> | null = null;

  constructor(aiService: AIService | null = null) {
    this.aiService = aiService;
  }

  setAIService(aiService: AIService): void {
    this.aiService = aiService;
  }

  show(contextText: string = '', action: 'summarize' | 'ask' = 'summarize'): void {
    this.contextText = contextText;
    this.createDialog(action);
  }

  hide(): void {
    // 取消正在进行的操作
    this.cancel();
    
    if (this.dialog) {
      this.dialog.remove();
      this.dialog = null;
    }
    // 移除 backdrop overlay
    if (this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
    }
    // 也检查是否有遗留的 backdrop（通过 ID 查找）
    const existingBackdrop = document.querySelector('div[style*="position: fixed"][style*="inset: 0"][style*="z-index: 2147483645"]');
    if (existingBackdrop && existingBackdrop.parentNode) {
      existingBackdrop.remove();
    }
  }

  cancel(): void {
    this.isCancelled = true;
    if (this.aiService) {
      this.aiService.cancel();
    }
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  private createDialog(action: 'summarize' | 'ask'): void {
    if (this.dialog) {
      this.dialog.remove();
    }

    this.dialog = document.createElement('div');
    this.dialog.id = 'reader-assistant-quick-chat';
    this.dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      max-width: 90vw;
      max-height: 80vh;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      z-index: 2147483646;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px 24px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    `;

    const title = document.createElement('h3');
    const t = i18n.t();
    title.textContent = action === 'summarize' ? t.quickChat.quickSummary : t.quickChat.quickAsk;
    title.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
    `;

    // 控制按钮容器
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 8px; align-items: center;';

    // 暂停/继续按钮（仅在总结时显示）
    let pauseBtn: HTMLButtonElement | null = null;
    if (action === 'summarize') {
      pauseBtn = document.createElement('button');
      pauseBtn.innerHTML = '⏸';
      pauseBtn.title = t.quickChat.pause;
      pauseBtn.style.cssText = `
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(255, 255, 255, 0.2);
        cursor: pointer;
        font-size: 16px;
        color: #ffffff;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      `;
      pauseBtn.addEventListener('click', () => {
        if (this.isPaused) {
          this.resume();
          pauseBtn!.innerHTML = '⏸';
          pauseBtn!.title = t.quickChat.pause;
        } else {
          this.pause();
          pauseBtn!.innerHTML = '▶';
          pauseBtn!.title = t.quickChat.resume;
        }
      });
      pauseBtn.addEventListener('mouseenter', () => {
        pauseBtn!.style.background = 'rgba(255, 255, 255, 0.3)';
      });
      pauseBtn.addEventListener('mouseleave', () => {
        pauseBtn!.style.background = 'rgba(255, 255, 255, 0.2)';
      });
      controls.appendChild(pauseBtn);
    }

    // 取消按钮（仅在总结时显示）
    let cancelBtn: HTMLButtonElement | null = null;
    if (action === 'summarize') {
      cancelBtn = document.createElement('button');
      cancelBtn.innerHTML = '✕';
      cancelBtn.title = t.quickChat.cancel;
      cancelBtn.style.cssText = `
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(255, 255, 255, 0.2);
        cursor: pointer;
        font-size: 18px;
        color: #ffffff;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      `;
      cancelBtn.addEventListener('click', () => {
        this.cancel();
        this.hide();
      });
      cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn!.style.background = 'rgba(255, 255, 255, 0.3)';
      });
      cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn!.style.background = 'rgba(255, 255, 255, 0.2)';
      });
      controls.appendChild(cancelBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(255, 255, 255, 0.2);
      cursor: pointer;
      font-size: 24px;
      color: #ffffff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    `;
    closeBtn.addEventListener('click', () => this.hide());
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    });

    controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);

    // Content area
    const content = document.createElement('div');
    content.id = 'quick-chat-content';
    content.style.cssText = `
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      font-size: 14px;
      line-height: 1.6;
      color: #374151;
    `;

    if (action === 'summarize') {
      this.startSummarize(content);
    } else {
      this.setupAskInterface(content);
    }

    // Backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 2147483645;
    `;
    this.backdrop.addEventListener('click', () => this.hide());

    this.dialog.appendChild(header);
    this.dialog.appendChild(content);

    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.dialog);
  }

  private async startSummarize(content: HTMLDivElement): Promise<void> {
    const t = i18n.t();
    if (!this.aiService) {
      content.innerHTML = `<div style="color: #ef4444;">${t.selection.apiKeyRequired}</div>`;
      return;
    }

    // 重置状态
    this.isCancelled = false;
    this.isPaused = false;

    // 检测语言
    const detectedLang = detectContentLanguage(this.contextText);
    const langName = detectedLang.startsWith('zh') ? '中文' : 
                     detectedLang.startsWith('ja') ? '日本語' :
                     detectedLang.startsWith('ko') ? '한국어' : 'English';

    content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; color: #6b7280;">
          <div style="
            width: 24px;
            height: 24px;
            border: 3px solid #e5e7eb;
            border-top-color: #22c55e;
            border-radius: 50%;
            animation: reader-assistant-spin 0.8s linear infinite;
          "></div>
          <span>${t.quickChat.summarizing} ${langName}...</span>
        </div>
        <div style="margin-top: 8px; font-size: 12px; color: #9ca3af;">
          ${t.quickChat.backgroundHint}
        </div>
      </div>
    `;

    try {
      let fullSummary = '';
      
      // 使用流式 API 并支持取消和暂停
      // 传递检测到的内容语言，用于总结
      this.summaryPromise = this.aiService.summarize(
        this.contextText, 
        false,
        (chunk: string) => {
          // 检查是否取消
          if (this.isCancelled) {
            return;
          }
          
          // 如果暂停，等待恢复
          while (this.isPaused && !this.isCancelled) {
            // 使用 setTimeout 避免阻塞
            const start = Date.now();
            while (Date.now() - start < 100 && this.isPaused && !this.isCancelled) {
              // 等待
            }
          }
          
          if (this.isCancelled) {
            return;
          }
          
          fullSummary = chunk;
          this.updateSummaryDisplay(content, chunk);
        },
        detectedLang,
        () => this.isCancelled || this.isPaused
      );

      const summary = await this.summaryPromise;
      
      if (!this.isCancelled) {
        this.updateSummaryDisplay(content, summary.summary, summary.keyPoints);
        // 自动同步到右侧 panel 的 summary 板块
        this.syncSummaryToPanel(summary);
      }
    } catch (error) {
      if (!this.isCancelled) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        if (errorMsg.includes('cancelled')) {
          const t = i18n.t();
          content.innerHTML = `<div style="color: #6b7280; text-align: center; padding: 20px;">${t.quickChat.cancelled}</div>`;
        } else {
          content.innerHTML = `<div style="color: #ef4444;">Error: ${errorMsg}</div>`;
        }
      }
    }
  }

  private updateSummaryDisplay(content: HTMLDivElement, summaryText: string, keyPoints?: string[]): void {
    if (this.isCancelled) return;
    
    const t = i18n.t();
    content.innerHTML = `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 13px; font-weight: 600; color: #6b7280; margin-bottom: 8px; text-transform: uppercase;">${t.quickChat.summary}</div>
        <div style="color: #111827; line-height: 1.6;">${summaryText}</div>
      </div>
      ${keyPoints && keyPoints.length > 0 ? `
        <div style="margin-bottom: 20px;">
          <div style="font-size: 13px; font-weight: 600; color: #6b7280; margin-bottom: 8px; text-transform: uppercase;">${t.quickChat.keyPoints}</div>
          <ul style="margin: 0; padding-left: 20px; color: #374151;">
            ${keyPoints.map(point => `<li style="margin-bottom: 6px;">${point}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;
  }

  // 同步总结到右侧 panel
  private syncSummaryToPanel(summary: any): void {
    try {
      // 通过 window.postMessage 发送消息到 content script，然后转发到 panel
      window.postMessage({
        type: 'syncSummaryToPanel',
        summary: {
          summary: summary.summary || summary,
          keyPoints: summary.keyPoints || [],
          citations: summary.citations || [],
        }
      }, '*');
    } catch (error) {
      console.error('Failed to sync summary to panel:', error);
    }
  }

  // 同步问答到右侧 panel
  private syncAnswerToPanel(question: string, answer: string): void {
    try {
      // 通过 window.postMessage 发送消息到 content script，然后转发到 panel
      window.postMessage({
        type: 'syncAnswerToPanel',
        question,
        answer,
      }, '*');
    } catch (error) {
      console.error('Failed to sync answer to panel:', error);
    }
  }

  private setupAskInterface(content: HTMLDivElement): void {
    const t = i18n.t();
    content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; font-weight: 600; color: #6b7280; margin-bottom: 8px;">${t.quickChat.selectedText}</div>
        <div style="padding: 12px; background: #f9fafb; border-radius: 8px; color: #374151; max-height: 150px; overflow-y: auto;">
          ${this.contextText.substring(0, 500)}${this.contextText.length > 500 ? '...' : ''}
        </div>
      </div>
      <div>
        <div style="font-size: 13px; font-weight: 600; color: #6b7280; margin-bottom: 8px;">${t.quickChat.yourQuestion}</div>
        <input type="text" id="quick-chat-input" placeholder="${t.quickChat.askQuestion}" style="
          width: 100%;
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          margin-bottom: 12px;
        ">
        <button id="quick-chat-ask-btn" style="
          width: 100%;
          padding: 12px;
          background: #22c55e;
          border: none;
          border-radius: 8px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        ">${t.quickChat.askQuestion}</button>
      </div>
      <div id="quick-chat-response" style="margin-top: 20px;"></div>
    `;

    const input = content.querySelector('#quick-chat-input') as HTMLInputElement;
    const btn = content.querySelector('#quick-chat-ask-btn') as HTMLButtonElement;
    const responseDiv = content.querySelector('#quick-chat-response') as HTMLDivElement;

    const askQuestion = async () => {
      const question = input?.value.trim();
      if (!question || !this.aiService) return;

      const t = i18n.t();
      responseDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; color: #6b7280;">
          <div style="
            width: 20px;
            height: 20px;
            border: 2px solid #e5e7eb;
            border-top-color: #22c55e;
            border-radius: 50%;
            animation: reader-assistant-spin 0.8s linear infinite;
          "></div>
          <span>${t.quickChat.gettingAnswer}</span>
        </div>
      `;

      try {
        const response = await this.aiService.answerQuestion(question, this.contextText, false);

        const answerHtml = `
          <div style="padding: 16px; background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 8px;">
            <div style="font-size: 13px; font-weight: 600; color: #059669; margin-bottom: 8px;">${t.quickChat.answer}</div>
            <div style="color: #111827; line-height: 1.6;">${response.answer.replace(/\n/g, '<br>')}</div>
          </div>
          <div style="margin-top: 12px; text-align: right;">
            <button id="quick-chat-copy-answer" style="
              padding: 6px 12px;
              background: #22c55e;
              border: none;
              border-radius: 6px;
              color: #ffffff;
              font-size: 12px;
              cursor: pointer;
              transition: background 0.2s;
            ">${t.quickChat.copy}</button>
          </div>
        `;
        
        responseDiv.innerHTML = answerHtml;
        
        // 自动同步到右侧 panel 的 ask 板块
        this.syncAnswerToPanel(question, response.answer);
        
        // 添加复制功能
        const copyBtn = responseDiv.querySelector('#quick-chat-copy-answer') as HTMLButtonElement;
        if (copyBtn) {
          copyBtn.addEventListener('click', async () => {
            const processedHtml = processMathFormulas(response.answer.replace(/\n/g, '<br>'));
            const plainText = response.answer;
            const success = await copyToClipboard(processedHtml, plainText);
            if (success) {
              showCopySuccess(copyBtn, t.quickChat.copySuccess);
            }
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : t.quickChat.error;
        responseDiv.innerHTML = `<div style="color: #ef4444;">${t.quickChat.error}: ${errorMsg}</div>`;
      }
    };

    btn?.addEventListener('click', askQuestion);
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        askQuestion();
      }
    });

    btn?.addEventListener('mouseenter', () => {
      btn.style.background = '#16a34a';
    });
    btn?.addEventListener('mouseleave', () => {
      btn.style.background = '#22c55e';
    });
  }
}
