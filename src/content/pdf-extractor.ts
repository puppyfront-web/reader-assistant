import * as pdfjsLib from 'pdfjs-dist';

// Configure worker once to avoid dynamic chunk loading
const WORKER_SRC = chrome.runtime.getURL('node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;

export class PDFExtractor {

  static async extract(): Promise<string> {
    const pdfViewer = document.querySelector('embed[type="application/pdf"]') as HTMLEmbedElement;
    if (!pdfViewer && document.contentType !== 'application/pdf') {
      return '';
    }

    const pdfUrl = pdfViewer?.src || window.location.href;

    try {
      let loadingTask;

      // For file:// or blocked CORS, try to fetch as arrayBuffer (requires "Allow access to file URLs")
      if (pdfUrl.startsWith('file://')) {
        try {
          const res = await fetch(pdfUrl);
          const data = await res.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({ data, verbosity: 0 });
        } catch (fileErr) {
          console.error('PDF fetch blocked. Please enable "Allow access to file URLs" for this extension, or open the PDF via http/https.', fileErr);
          throw fileErr;
        }
      } else {
        loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          withCredentials: true,
          verbosity: 0,
        });
      }

      const pdf = await loadingTask.promise;
      
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += `\n\n--- Page ${i} ---\n\n${pageText}`;
      }
      
      return fullText;
    } catch (error) {
      console.error('PDF extraction error:', error);
      return '';
    }
  }

  static isPDFPage(): boolean {
    const isPDFContentType = document.contentType === 'application/pdf';
    const isPDFPath = window.location.pathname.endsWith('.pdf') || 
                      window.location.href.endsWith('.pdf');
    const hasPDFEmbed = document.querySelector('embed[type="application/pdf"]') !== null;
    const isChromePDFViewer = window.location.origin.includes('chrome-extension://') && 
                               document.querySelector('embed[type="application/pdf"]') !== null;
    
    return isPDFContentType || isPDFPath || hasPDFEmbed || isChromePDFViewer;
  }
}
