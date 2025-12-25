import * as pdfjsLib from 'pdfjs-dist';

const WORKER_SRC = chrome.runtime.getURL('node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;

export interface PDFTextItem {
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  transform: number[];
}

export interface PDFTranslationItem {
  original: string;
  translated: string;
  items: PDFTextItem[];
}

export class PDFTranslator {
  private overlayContainer: HTMLDivElement | null = null;
  private pdfDoc: any = null;
  private pdfUrl: string = '';

  async initialize(pdfUrl: string): Promise<void> {
    this.pdfUrl = pdfUrl;
    this.createOverlay();
    
    try {
      let loadingTask;
      if (pdfUrl.startsWith('file://')) {
        const res = await fetch(pdfUrl);
        const data = await res.arrayBuffer();
        loadingTask = pdfjsLib.getDocument({ data, verbosity: 0 });
      } else {
        loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          withCredentials: true,
          verbosity: 0,
        });
      }
      this.pdfDoc = await loadingTask.promise;
    } catch (error) {
      console.error('Failed to load PDF:', error);
      throw error;
    }
  }

  async extractTextWithPositions(): Promise<PDFTextItem[]> {
    if (!this.pdfDoc) {
      throw new Error('PDF not initialized');
    }

    const textItems: PDFTextItem[] = [];

    for (let pageNum = 1; pageNum <= this.pdfDoc.numPages; pageNum++) {
      const page = await this.pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });
      const pageHeight = viewport.height;

      // Filter headers/footers (top 5% and bottom 5%)
      const headerThreshold = pageHeight * 0.95;
      const footerThreshold = pageHeight * 0.05;

      for (const item of textContent.items as any[]) {
        if (item.str && item.str.trim()) {
          const transform = item.transform;
          const x = transform[4];
          const y = transform[5];

          // Skip headers and footers
          if (y > headerThreshold || y < footerThreshold) continue;

          textItems.push({
            text: item.str,
            page: pageNum,
            x: x,
            y: y,
            width: item.width || 0,
            height: item.height || 0,
            transform: transform,
          });
        }
      }
    }

    return textItems;
  }

  groupTextItemsByLine(items: PDFTextItem[]): PDFTextItem[][] {
    // Sort items primarily by page, then by Y coordinate (top to bottom), then by X coordinate
    const sortedItems = [...items].sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;
      if (Math.abs(a.y - b.y) > 5) return b.y - a.y; // Higher Y is higher on page in PDF coordinates
      return a.x - b.x;
    });

    const lines: PDFTextItem[][] = [];
    let currentLine: PDFTextItem[] = [];
    let lastY = -1;
    let lastPage = -1;
    const verticalTolerance = 5;

    for (const item of sortedItems) {
      const isSamePage = item.page === lastPage;
      const isSameLine = isSamePage && (lastY === -1 || Math.abs(item.y - lastY) <= verticalTolerance);

      if (isSameLine) {
        currentLine.push(item);
      } else {
        if (currentLine.length > 0) {
          // Sort the completed line by X coordinate
          currentLine.sort((a, b) => a.x - b.x);
          lines.push(currentLine);
        }
        currentLine = [item];
      }
      lastY = item.y;
      lastPage = item.page;
    }

    if (currentLine.length > 0) {
      currentLine.sort((a, b) => a.x - b.x);
      lines.push(currentLine);
    }

    return this.detectAndReorderColumns(lines);
  }

  private detectAndReorderColumns(lines: PDFTextItem[][]): PDFTextItem[][] {
    // A simple column detection: if a page has many lines that start at two distinct X-offsets
    // we might need to reorder them. However, for translation purposes, 
    // simply processing lines as they appear in the sequential flow is often enough
    // unless the PDF extraction itself jumps between columns.
    
    // For now, we will return the lines as is, but improved sorting by Y then X 
    // already handles most standard sequential extractions.
    return lines;
  }

  async displayTranslations(translations: PDFTranslationItem[]): Promise<void> {
    if (!this.overlayContainer || !this.pdfDoc) return;

    this.clearTranslations();

    for (const translation of translations) {
      for (const item of translation.items) {
        await this.renderTranslation(item, translation.translated);
      }
    }
  }

  private async renderTranslation(item: PDFTextItem, translatedText: string): Promise<void> {
    if (!this.overlayContainer || !this.pdfDoc) return;

    try {
      const page = await this.pdfDoc.getPage(item.page);
      const viewport = page.getViewport({ scale: window.devicePixelRatio || 1 });
      
      const pdfViewer = document.querySelector('embed[type="application/pdf"]') as HTMLEmbedElement;
      if (!pdfViewer) return;

      const rect = pdfViewer.getBoundingClientRect();
      const scaleX = rect.width / viewport.width;
      const scaleY = rect.height / viewport.height;

      const x = (item.x * scaleX) + rect.left;
      const y = rect.top + (viewport.height - item.y) * scaleY;

      const translationDiv = document.createElement('div');
      translationDiv.className = 'pdf-translation-overlay';
      translationDiv.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y + item.height * scaleY + 2}px;
        max-width: ${rect.width * 0.8}px;
        padding: 4px 8px;
        background: rgba(255, 255, 255, 0.95);
        border-left: 3px solid #22c55e;
        border-radius: 4px;
        font-size: 12px;
        color: #374151;
        font-style: italic;
        z-index: 2147483647;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        pointer-events: none;
        word-wrap: break-word;
        line-height: 1.4;
      `;
      translationDiv.textContent = translatedText;

      this.overlayContainer.appendChild(translationDiv);
    } catch (error) {
      console.error('Failed to render translation:', error);
    }
  }

  private createOverlay(): void {
    if (this.overlayContainer) return;

    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'pdf-translation-overlay-container';
    this.overlayContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483646;
    `;
    document.body.appendChild(this.overlayContainer);
  }

  clearTranslations(): void {
    if (this.overlayContainer) {
      this.overlayContainer.innerHTML = '';
    }
  }

  destroy(): void {
    this.clearTranslations();
    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
    }
  }
}

