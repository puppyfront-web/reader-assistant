import { TextExtractor } from './text-extractor';
import { PDFExtractor } from './pdf-extractor';
import { PDFTranslator, PDFTranslationItem } from './pdf-translator';
import { SelectionTranslator } from './selection-translator';
import { Panel } from '../ui/panel';
import { AIService } from '../services/ai-service';
import { StorageService } from '../services/storage';
import { Citation } from '../utils/types';
import { injectGlobalStyles } from '../ui/global-styles';
import { getBrowserLanguage, detectContentLanguage } from '../utils/constants';

class ContentScript {
  private panel: Panel;
  private aiService: AIService | null = null;
  private currentContent: string = '';
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private pdfTranslator: PDFTranslator | null = null;
  private selectionTranslator: SelectionTranslator | null = null;
  private translationCancelled: boolean = false;
  private translationPaused: boolean = false;

  constructor() {
    console.log('Reader Assistant: Content script initialized');
    console.log('Reader Assistant: URL:', window.location.href);
    console.log('Reader Assistant: Content Type:', document.contentType);
    console.log('Reader Assistant: Is PDF:', PDFExtractor.isPDFPage());

    // Inject global styles for animations
    injectGlobalStyles();

    this.panel = new Panel();
    this.init();
  }

  private async init(): Promise<void> {
    this.setupMessageListener();
    await this.loadConfig();
    
    if (PDFExtractor.isPDFPage()) {
      console.log('Reader Assistant: PDF page detected, waiting for PDF viewer to load...');
      setTimeout(() => {
        this.createFloatingButton();
      }, 1000);
    } else {
      this.createFloatingButton();
    }
  }

  private createFloatingButton(): void {
    if (document.getElementById('reader-assistant-toggle')) {
      return;
    }

    const waitForBody = () => {
      if (document.body) {
        this.insertButton();
      } else {
        setTimeout(waitForBody, 100);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', waitForBody);
    } else {
      waitForBody();
    }
  }

  private insertButton(): void {
    if (document.getElementById('reader-assistant-toggle')) {
      console.log('Reader Assistant: Button already exists');
      return;
    }

    if (!document.body) {
      console.error('Reader Assistant: document.body is not available');
      return;
    }

    console.log('Reader Assistant: Creating floating button');

    const button = document.createElement('button');
    button.id = 'reader-assistant-toggle';
    button.innerHTML = '📖';
    button.setAttribute('aria-label', 'Reader Assistant');
    button.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      width: 50px !important;
      height: 50px !important;
      border-radius: 50% !important;
      background: #4CAF50 !important;
      color: white !important;
      border: none !important;
      cursor: pointer !important;
      font-size: 24px !important;
      z-index: 2147483647 !important;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3) !important;
      transition: transform 0.2s !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      pointer-events: auto !important;
    `;

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.panel.toggle();
    });

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });

    try {
      document.body.appendChild(button);
      console.log('Reader Assistant: Button created successfully');
    } catch (error) {
      console.error('Reader Assistant: Failed to append button:', error);
    }
  }

  private async loadConfig(): Promise<void> {
    const config = await StorageService.getConfig();
    
    // 即使没有 API key，也要创建 SelectionTranslator，以便显示气泡
    if (!this.selectionTranslator) {
      const aiService = config.apiKey ? new AIService(config) : null;
      this.selectionTranslator = new SelectionTranslator(aiService, null);
      this.selectionTranslator.setAskCallback((text: string) => {
        this.handleSelectedTextAsk(text);
      });
    }
    
    // 如果有 API key，创建并更新 AI Service
    if (config.apiKey) {
      this.aiService = new AIService(config);
      if (this.selectionTranslator) {
        this.selectionTranslator.setAIService(this.aiService);
      }
    } else {
      // 如果没有 API key，清除 AI Service
      this.aiService = null;
      // SelectionTranslator 会检查 aiService 是否为 null，所以不需要调用 setAIService
    }
  }

  private async handleSelectedTextAsk(text: string): Promise<void> {
    // Open panel and switch to Ask tab with the selected text as the question
    this.panel.show();
    await this.handleAnswer(text);
  }

  private setupMessageListener(): void {
    window.addEventListener('message', async (event) => {
      const data = event.data || {};
      // Accept messages from our panel iframe, same window, or quick chat bubble
      if (data.from && data.from !== 'reader-assistant-panel' && data.from !== 'reader-assistant-page') {
        // Allow messages from quick chat (no 'from' field or from window.postMessage)
        if (data.type !== 'syncSummaryToPanel' && data.type !== 'syncAnswerToPanel') {
          return;
        }
      }

      switch (data.type) {
        case 'getCurrentUrl':
          // 响应 panel 的 URL 请求
          const panelWindow = this.panel.getPanelWindow();
          if (panelWindow) {
            panelWindow.postMessage({
              type: 'currentUrlResponse',
              url: window.location.href,
            }, '*');
          }
          break;
        case 'requestSummary':
          await this.handleSummary();
          break;
        case 'requestAnswer':
          await this.handleAnswer(data.question);
          break;
        case 'syncSummaryToPanel':
          // 从气泡同步总结到 panel
          await this.syncSummaryToPanel(data.summary);
          break;
        case 'syncAnswerToPanel':
          // 从气泡同步问答到 panel
          await this.syncAnswerToPanel(data.question, data.answer);
          break;
        case 'requestTranslation':
          await this.handleTranslation(data.targetLang || getBrowserLanguage());
          break;
        case 'requestImmersiveTranslation':
          await this.handleImmersiveTranslation(data.targetLang || getBrowserLanguage());
          break;
        case 'clearImmersiveTranslation':
          this.panel.clearImmersiveTranslations();
          if (this.pdfTranslator) {
            this.pdfTranslator.clearTranslations();
          }
          break;
        case 'updateSelectionTargetLang':
          if (this.selectionTranslator) {
            this.selectionTranslator.setTargetLang(data.targetLang || getBrowserLanguage());
          }
          break;
        case 'highlightCitation':
          this.panel.highlightCitation(data.citation);
          break;
        case 'clearHighlights':
          this.panel.clearHighlights();
          break;
        case 'clearConversation':
          this.conversationHistory = [];
          break;
        case 'cancelSummary':
          if (this.aiService) {
            this.aiService.cancel();
          }
          break;
        // 移除一键总结对话功能（已废弃）
        // case 'requestConversationSummary':
        //   await this.handleConversationSummary(data.conversation);
        //   break;
        case 'closePanel':
          this.panel.hide();
          break;
        default:
          break;
      }
    });
  }

  private async extractContent(): Promise<string> {
    if (PDFExtractor.isPDFPage()) {
      return await PDFExtractor.extract();
    } else {
      return TextExtractor.extract();
    }
  }

  // 移除一键总结对话功能（已废弃）
  // private async handleConversationSummary(conversation: string): Promise<void> {
  //   if (!this.aiService) {
  //     this.showError('Please configure API key in extension popup');
  //     return;
  //   }
  //
  //   try {
  //     this.panel.show();
  //     const summary = await this.aiService.summarize(conversation, false);
  //     
  //     // 发送总结结果到 panel
  //     const panelWindow = this.panel.getPanelWindow();
  //     if (panelWindow) {
  //       panelWindow.postMessage({
  //         type: 'conversationSummarized',
  //         summary,
  //       }, '*');
  //     }
  //   } catch (error) {
  //     this.showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  //   }
  // }

  private async syncSummaryToPanel(summary: any): Promise<void> {
    try {
      // 通过 panel 的 displaySummary 方法保存到历史记录
      await this.panel.displaySummary({
        summary: summary.summary || summary,
        keyPoints: summary.keyPoints || [],
        citations: summary.citations || [],
      }, false, false);
      
      // 发送消息到 panel 以更新历史记录
      const panelWindow = this.panel.getPanelWindow();
      if (panelWindow) {
        panelWindow.postMessage({
          type: 'syncSummaryFromBubble',
          summary: {
            summary: summary.summary || summary,
            keyPoints: summary.keyPoints || [],
            citations: summary.citations || [],
          }
        }, '*');
      }
    } catch (error) {
      console.error('Failed to sync summary to panel:', error);
    }
  }

  private async syncAnswerToPanel(question: string, answer: string): Promise<void> {
    try {
      // 发送消息到 panel 以保存问答到历史记录
      const panelWindow = this.panel.getPanelWindow();
      if (panelWindow) {
        panelWindow.postMessage({
          type: 'syncAnswerFromBubble',
          question,
          answer,
        }, '*');
      }
    } catch (error) {
      console.error('Failed to sync answer to panel:', error);
    }
  }

  private async handleSummary(): Promise<void> {
    if (!this.aiService) {
      this.showError('Please configure API key in extension popup');
      return;
    }

    try {
      this.currentContent = await this.extractContent();
      if (!this.currentContent) {
        this.showError('No content found on this page');
        return;
      }

      const isPDF = PDFExtractor.isPDFPage();
      // 检测网页内容语言，用于总结
      const contentLang = detectContentLanguage(this.currentContent);
      console.log('Reader Assistant: Detected content language:', contentLang, 'Content length:', this.currentContent.length);
      
      this.panel.show();
      
      const summary = await this.aiService.summarize(
        this.currentContent, 
        isPDF, 
        async (streamingText) => {
          // Send partial results for streaming effect
          await this.panel.displaySummary({
            summary: streamingText,
            keyPoints: [],
            citations: []
          }, true, isPDF);
        },
        contentLang, // 传递检测到的内容语言，用于总结
        () => this.translationCancelled // shouldCancel callback
      );
      
      await this.panel.displaySummary(summary, false, isPDF);
    } catch (error) {
      this.showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleAnswer(question: string): Promise<void> {
    if (!this.aiService) {
      this.showError('Please configure API key in extension popup');
      return;
    }

    try {
      if (!this.currentContent) {
        this.currentContent = await this.extractContent();
      }

      const tempHistory = [...this.conversationHistory, { role: 'user', content: question }];
      const isPDF = PDFExtractor.isPDFPage();
      
      this.panel.show();
      
      const response = await this.aiService.answerWithHistory(
        question, 
        this.currentContent, 
        this.conversationHistory, 
        isPDF,
        async (streamingText) => {
          const streamingHistory = [...tempHistory, { role: 'assistant', content: streamingText }];
          await this.panel.displayAnswer({
            answer: streamingText,
            citations: []
          }, streamingHistory as any, true);
        }
      );
      
      this.conversationHistory = [...tempHistory, { role: 'assistant', content: response.answer }] as any;
      await this.panel.displayAnswer(response, this.conversationHistory);
    } catch (error) {
      this.showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleTranslation(targetLang: string | null = null): Promise<void> {
    if (!targetLang) {
      targetLang = getBrowserLanguage();
    }
    if (!this.aiService) {
      this.showError('Please configure API key in extension popup');
      return;
    }

    try {
      if (!this.currentContent) {
        this.currentContent = await this.extractContent();
      }

      const translated = await this.aiService.translate(this.currentContent, targetLang);
      this.panel.show();
      await this.panel.displayTranslation(translated);
    } catch (error) {
      this.showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleImmersiveTranslation(targetLang: string | null = null): Promise<void> {
    if (!targetLang) {
      targetLang = getBrowserLanguage();
    }
    if (!this.aiService) {
      this.showError('Please configure API key in extension popup');
      return;
    }

    this.translationCancelled = false;
    this.translationPaused = false;

    try {
      if (PDFExtractor.isPDFPage()) {
        await this.handlePDFImmersiveTranslation(targetLang);
      } else {
        // Extract text from specific elements instead of full content
        const textElements = this.extractTextElements();
        const translatedSegments: Array<{ original: string; translated: string; position: number }> = [];
        const totalElements = textElements.length;

        this.panel.updateTranslationStatus('translating');

        for (let i = 0; i < textElements.length; i++) {
          // Check for pause/cancel
          while (this.translationPaused && !this.translationCancelled) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          if (this.translationCancelled) {
            this.panel.updateTranslationStatus('cancelled');
            return;
          }

          const element = textElements[i];
          const text = element.textContent?.trim() || '';
          
          if (text.length > 20) {
            try {
              // 使用专业翻译模式（逐行翻译，保留特殊名词）
              const translated = await this.aiService.translate(text, targetLang, true);
              translatedSegments.push({
                original: text,
                translated: translated,
                position: 0, // Position is not needed for element-based translation
              });
              
              this.panel.updateTranslationProgress(i + 1, totalElements);
              
              // Insert translation immediately
              const translationDiv = document.createElement('div');
              translationDiv.className = 'reader-assistant-translation-inline';
              translationDiv.style.cssText = `
                background-color: #e0ffe0;
                border-left: 3px solid #4CAF50;
                padding: 5px 10px;
                margin-top: 5px;
                font-size: 0.9em;
                color: #333;
              `;
              translationDiv.textContent = translated;
              element.after(translationDiv);
            } catch (error) {
              if (error instanceof Error && error.message.includes('cancelled')) {
                this.panel.updateTranslationStatus('cancelled');
                return;
              }
              console.error('Translation error:', error);
              translatedSegments.push({
                original: text,
                translated: text, // Fallback to original text
                position: 0,
              });
              this.panel.updateTranslationProgress(i + 1, totalElements);
            }
          }
        }

        if (!this.translationCancelled) {
          this.panel.updateTranslationStatus('completed');
        }
      }
    } catch (error) {
      this.showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractTextElements(): Element[] {
    const selectors = [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'li', 'blockquote'
    ];

    const elements: Element[] = [];
    const seen = new Set<Element>();

    // First try to find article/main content
    const contentContainers = document.querySelectorAll('article, main, [role="main"], .content, .article, #content');

    if (contentContainers.length > 0) {
      contentContainers.forEach(container => {
        const textElements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
        textElements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 20 && !seen.has(el)) {
            elements.push(el);
            seen.add(el);
          }
        });
      });
    }

    // Fallback to all elements if no main content found
    if (elements.length === 0) {
      selectors.forEach(selector => {
        const found = document.querySelectorAll(selector);
        found.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 20 && !seen.has(el) && !this.isInSidebar(el)) {
            elements.push(el);
            seen.add(el);
          }
        });
      });
    }

    return elements.slice(0, 50); // Limit to first 50 elements to avoid too many API calls
  }

  private isInSidebar(element: Element): boolean {
    let current: Element | null = element;
    while (current) {
      const tag = current.tagName.toLowerCase();
      const classList = Array.from(current.classList);
      const id = current.id.toLowerCase();

      if (
        tag === 'aside' ||
        tag === 'nav' ||
        classList.some(c => c.includes('sidebar') || c.includes('nav') || c.includes('menu')) ||
        id.includes('sidebar') ||
        id.includes('nav')
      ) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  private async handlePDFImmersiveTranslation(targetLang: string | null = null): Promise<void> {
    if (!targetLang) {
      targetLang = getBrowserLanguage();
    }
    if (!this.pdfTranslator) {
      const pdfUrl = (document.querySelector('embed[type="application/pdf"]') as HTMLEmbedElement)?.src || window.location.href;
      this.pdfTranslator = new PDFTranslator();
      await this.pdfTranslator.initialize(pdfUrl);
    }

    if (!this.pdfTranslator) {
      throw new Error('Failed to initialize PDF translator');
    }

    const textItems = await this.pdfTranslator.extractTextWithPositions();
    const lines = this.pdfTranslator.groupTextItemsByLine(textItems);
    
    const lineTexts = lines.map(line => line.map(item => item.text).join(' '));
    const translations = await this.aiService!.translateLines(lineTexts, targetLang);

    const translationItems: PDFTranslationItem[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (translations[i]) {
        translationItems.push({
          original: lineTexts[i],
          translated: translations[i],
          items: lines[i],
        });
      }
    }

    await this.pdfTranslator.displayTranslations(translationItems);
  }

  private showError(message: string): void {
    console.error('Reader Assistant:', message);
  }
}

new ContentScript();
