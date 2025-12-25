export class TextExtractor {
  static extract(): string {
    const body = document.body.cloneNode(true) as HTMLElement;
    
    const selectorsToRemove = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      'aside',
      '.advertisement',
      '.ad',
      '[class*="ad"]',
    ];

    selectorsToRemove.forEach(selector => {
      body.querySelectorAll(selector).forEach(el => el.remove());
    });

    return body.innerText || body.textContent || '';
  }

  static extractWithStructure(): { text: string; elements: HTMLElement[] } {
    const text = this.extract();
    const elements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div[class*="content"]')) as HTMLElement[];
    
    return { text, elements };
  }
}
