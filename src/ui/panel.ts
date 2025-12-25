import { AISummary, AIResponse, Citation } from '../utils/types';

export class Panel {
  private panel: HTMLIFrameElement | null = null;
  private isVisible = false;

  constructor() {
    this.createPanel();
  }

  private createPanel(): void {
    const iframe = document.createElement('iframe');
    iframe.id = 'reader-assistant-panel';
    iframe.src = chrome.runtime.getURL('ui/panel.html');
    iframe.style.cssText = `
      position: fixed;
      top: 0;
      right: -400px;
      width: 400px;
      height: 100vh;
      border: none;
      z-index: 999999;
      background: white;
      box-shadow: -2px 0 10px rgba(0,0,0,0.1);
      transition: right 0.3s ease;
    `;
    
    document.body.appendChild(iframe);
    this.panel = iframe;
  }

  show(): void {
    if (this.panel) {
      this.panel.style.right = '0';
      this.isVisible = true;
    }
  }

  hide(): void {
    if (this.panel) {
      this.panel.style.right = '-400px';
      this.isVisible = false;
    }
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  async displaySummary(summary: AISummary, isStreaming: boolean = false, isPDF: boolean = false): Promise<void> {
    const panelWindow = this.panel?.contentWindow;
    if (!panelWindow) return;

    panelWindow.postMessage({
      type: 'displaySummary',
      data: summary,
      isStreaming,
      isPDF
    }, '*');
  }

  async displayTranslation(translatedText: string): Promise<void> {
    const panelWindow = this.panel?.contentWindow;
    if (!panelWindow) return;

    panelWindow.postMessage({
      type: 'displayTranslation',
      data: translatedText,
    }, '*');
  }

  async displayImmersiveTranslation(segments: Array<{ original: string; translated: string; position: number }>): Promise<void> {
    this.clearImmersiveTranslations();

    // Find all translatable text blocks (paragraphs, headings, list items, etc.)
    const translatableElements = this.findTranslatableElements();

    translatableElements.forEach((element, index) => {
      if (index < segments.length) {
        this.insertTranslationAfterElement(element, segments[index].translated);
      }
    });
  }

  private findTranslatableElements(): Element[] {
    const selectors = [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'li', 'td', 'th', 'blockquote', 'div.article',
      'article p', 'main p', '.content p'
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

    return elements;
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

  private insertTranslationAfterElement(element: Element, translatedText: string): void {
    const translationDiv = document.createElement('div');
    translationDiv.className = 'reader-assistant-translation';
    translationDiv.style.cssText = `
      color: #059669;
      font-size: 0.95em;
      margin: 8px 0;
      padding: 12px 16px;
      background: linear-gradient(to right, #f0fdf4 0%, #f0fdf4 4px, #fafafa 4px);
      border-left: 4px solid #10b981;
      border-radius: 6px;
      font-style: normal;
      line-height: 1.6;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    `;
    translationDiv.textContent = translatedText;

    if (element.nextSibling) {
      element.parentNode?.insertBefore(translationDiv, element.nextSibling);
    } else {
      element.parentNode?.appendChild(translationDiv);
    }
  }


  clearImmersiveTranslations(): void {
    document.querySelectorAll('.reader-assistant-translation').forEach(el => el.remove());
  }

  async displayAnswer(response: AIResponse, history: Array<{ role: 'user' | 'assistant'; content: string }>, isStreaming: boolean = false): Promise<void> {
    const panelWindow = this.panel?.contentWindow;
    if (!panelWindow) return;

    panelWindow.postMessage({
      type: 'displayAnswer',
      data: response,
      history: history || [],
      isStreaming
    }, '*');
  }


  highlightCitation(citation: Citation): void {
    const text = citation.text;
    const position = citation.position;
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentPos = 0;
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const nodeText = node.textContent || '';
      const nodeLength = nodeText.length;

      if (currentPos <= position && position < currentPos + nodeLength) {
        const offset = position - currentPos;
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, Math.min(offset + text.length, nodeLength));
        
        const span = document.createElement('span');
        span.className = 'reader-assistant-highlight';
        span.style.cssText = `
          background-color: yellow;
          padding: 2px 4px;
          cursor: pointer;
          border-radius: 2px;
        `;
        
        try {
          range.surroundContents(span);
        } catch (e) {
          const highlight = document.createElement('mark');
          highlight.style.cssText = span.style.cssText;
          highlight.textContent = text;
          range.deleteContents();
          range.insertNode(highlight);
        }

        span.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }

      currentPos += nodeLength;
    }
  }

  clearHighlights(): void {
    document.querySelectorAll('.reader-assistant-highlight, mark').forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
        parent.normalize();
      }
    });
  }

  updateTranslationStatus(status: 'translating' | 'paused' | 'cancelled' | 'completed'): void {
    const panelWindow = this.panel?.contentWindow;
    if (!panelWindow) return;
    panelWindow.postMessage({ type: 'updateTranslationStatus', status }, '*');
  }

  updateTranslationProgress(current: number, total: number): void {
    const panelWindow = this.panel?.contentWindow;
    if (!panelWindow) return;
    panelWindow.postMessage({ type: 'updateTranslationProgress', current, total }, '*');
  }

  getPanelWindow(): Window | null {
    return this.panel?.contentWindow || null;
  }
}
