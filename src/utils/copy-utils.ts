/**
 * 复制工具函数
 * 支持富文本格式复制，包括数学公式
 */

/**
 * 复制文本到剪贴板（支持富文本格式）
 * @param htmlContent HTML 格式内容
 * @param plainText 纯文本内容（作为后备）
 * @returns Promise<boolean> 是否成功
 */
export async function copyToClipboard(htmlContent: string, plainText?: string): Promise<boolean> {
  try {
    // 使用 Clipboard API（支持富文本）
    if (navigator.clipboard && window.ClipboardItem) {
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([plainText || stripHtml(htmlContent)], { type: 'text/plain' });
      
      const clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      });
      
      await navigator.clipboard.write([clipboardItem]);
      return true;
    }
    
    // 后备方案：使用传统方法
    return fallbackCopyToClipboard(htmlContent, plainText);
  } catch (error) {
    console.error('Copy failed:', error);
    // 尝试后备方案
    return fallbackCopyToClipboard(htmlContent, plainText);
  }
}

/**
 * 后备复制方法（兼容旧浏览器）
 */
function fallbackCopyToClipboard(htmlContent: string, plainText?: string): boolean {
  try {
    // 创建临时 textarea 元素
    const textarea = document.createElement('textarea');
    textarea.value = plainText || stripHtml(htmlContent);
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, 99999); // 移动端支持
    
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    
    if (success) {
      // 如果支持，尝试同时复制 HTML
      tryCopyHtml(htmlContent);
    }
    
    return success;
  } catch (error) {
    console.error('Fallback copy failed:', error);
    return false;
  }
}

/**
 * 尝试复制 HTML 格式（使用临时 div）
 */
function tryCopyHtml(htmlContent: string): void {
  try {
    const div = document.createElement('div');
    div.innerHTML = htmlContent;
    div.style.position = 'fixed';
    div.style.opacity = '0';
    div.style.left = '-9999px';
    document.body.appendChild(div);
    
    const range = document.createRange();
    range.selectNodeContents(div);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('copy');
      selection.removeAllRanges();
    }
    
    document.body.removeChild(div);
  } catch (error) {
    // 忽略 HTML 复制失败，至少纯文本已复制
    console.warn('HTML copy failed, plain text copied:', error);
  }
}

/**
 * 从 HTML 中提取纯文本
 */
function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

/**
 * 复制元素内容（支持保留格式）
 * @param element 要复制的 DOM 元素
 * @returns Promise<boolean> 是否成功
 */
export async function copyElementContent(element: HTMLElement): Promise<boolean> {
  const htmlContent = element.innerHTML;
  const plainText = element.textContent || element.innerText || '';
  
  // 处理数学公式：保留 LaTeX 或 MathML 格式
  const processedHtml = processMathFormulas(htmlContent);
  
  return copyToClipboard(processedHtml, plainText);
}

/**
 * 处理数学公式，确保格式正确
 * 支持 LaTeX ($...$ 或 $$...$$) 和 MathML
 */
export function processMathFormulas(html: string): string {
  // 保留 LaTeX 公式（$...$ 或 $$...$$）
  // 保留 MathML 标签
  // 保留其他 HTML 格式
  
  // 将换行符转换为 <br>
  let processed = html.replace(/\n/g, '<br>');
  
  // 确保数学公式被正确保留
  // LaTeX 内联公式 $...$
  processed = processed.replace(/\$([^$\n]+)\$/g, '<span class="math-inline">$1</span>');
  
  // LaTeX 块级公式 $$...$$
  processed = processed.replace(/\$\$([^$]+)\$\$/g, '<div class="math-block">$$$1$$</div>');
  
  return processed;
}

/**
 * 显示复制成功提示
 */
export function showCopySuccess(element: HTMLElement, message: string = '已复制'): void {
  const originalText = element.textContent;
  const originalBg = element.style.background;
  
  element.textContent = message;
  element.style.background = '#10b981';
  element.style.color = '#ffffff';
  element.style.transition = 'all 0.3s';
  
  setTimeout(() => {
    element.textContent = originalText;
    element.style.background = originalBg;
    element.style.color = '';
  }, 2000);
}

