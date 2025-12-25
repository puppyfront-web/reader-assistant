interface SummaryData {
  summary: string;
  keyPoints: string[];
  citations: Array<{
    text: string;
    position: number;
    page?: number;
    section?: string;
  }>;
  timestamp?: number;
  url?: string;
}

interface AnswerData {
  answer: string;
  citations: Array<{
    text: string;
    position: number;
    page?: number;
    section?: string;
  }>;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

const FROM = 'reader-assistant-panel';

// 获取当前页面URL（规范化，去除查询参数和hash，只保留协议+域名+路径）
let cachedNormalizedUrl: string = '';
let lastUrlCheck: number = 0;
const URL_CACHE_DURATION = 1000; // 缓存1秒

// 规范化URL：去除查询参数和hash，只保留协议+域名+路径
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch {
    // 如果URL解析失败，返回原URL（去除查询参数和hash）
    return url.split('?')[0].split('#')[0];
  }
}

// 从 content script 获取当前页面URL
async function getCurrentUrl(): Promise<string> {
  const now = Date.now();
  // 如果缓存有效（1秒内），直接返回
  if (cachedNormalizedUrl && (now - lastUrlCheck) < URL_CACHE_DURATION) {
    return cachedNormalizedUrl;
  }

  try {
    // 尝试从 window.parent 获取（如果同源）
    const parentUrl = window.parent.location.href;
    if (parentUrl && parentUrl !== 'about:blank') {
      cachedNormalizedUrl = normalizeUrl(parentUrl);
      lastUrlCheck = now;
      return cachedNormalizedUrl;
    }
  } catch (e) {
    // 跨域限制，需要通过消息传递获取
  }

  // 通过消息传递从 content script 获取 URL
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      // 超时后使用 fallback
      const fallback = window.location.href || '';
      cachedNormalizedUrl = normalizeUrl(fallback);
      lastUrlCheck = now;
      resolve(cachedNormalizedUrl);
    }, 200);

    window.parent.postMessage({
      from: FROM,
      type: 'getCurrentUrl',
    }, '*');

    const messageHandler = (event: MessageEvent) => {
      if (event.data && event.data.type === 'currentUrlResponse' && event.data.url) {
        clearTimeout(timeout);
        window.removeEventListener('message', messageHandler);
        cachedNormalizedUrl = normalizeUrl(event.data.url);
        lastUrlCheck = now;
        resolve(cachedNormalizedUrl);
      }
    };

    window.addEventListener('message', messageHandler);
  });
}

// 存储服务（使用 StorageService）
async function getHistory(url: string): Promise<any> {
  const key = `history_${url}`;
  const result = await chrome.storage.local.get(key);
  return result[key] || null;
}

async function saveHistory(url: string, data: any): Promise<void> {
  const key = `history_${url}`;
  await chrome.storage.local.set({ [key]: data });
}

async function clearHistory(url: string): Promise<void> {
  const key = `history_${url}`;
  await chrome.storage.local.remove(key);
}

// Summary 板块状态管理
let summaryCancellationController: AbortController | null = null;
let isSummarizing = false;

// 复制工具函数
async function copyToClipboard(htmlContent: string, plainText?: string): Promise<boolean> {
  try {
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
    
    return fallbackCopyToClipboard(htmlContent, plainText);
  } catch (error) {
    console.error('Copy failed:', error);
    return fallbackCopyToClipboard(htmlContent, plainText);
  }
}

function fallbackCopyToClipboard(htmlContent: string, plainText?: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = plainText || stripHtml(htmlContent);
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    
    if (success) {
      tryCopyHtml(htmlContent);
    }
    
    return success;
  } catch (error) {
    console.error('Fallback copy failed:', error);
    return false;
  }
}

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
    console.warn('HTML copy failed:', error);
  }
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function processMathFormulas(html: string): string {
  let processed = html.replace(/\n/g, '<br>');
  processed = processed.replace(/\$([^$\n]+)\$/g, '<span class="math-inline">$1</span>');
  processed = processed.replace(/\$\$([^$]+)\$\$/g, '<div class="math-block">$$$1$$</div>');
  return processed;
}

function showCopySuccess(button: HTMLElement, message: string): void {
  const originalHTML = button.innerHTML;
  button.innerHTML = '✓';
  button.classList.add('success');
  
  setTimeout(() => {
    button.innerHTML = originalHTML;
    button.classList.remove('success');
  }, 2000);
}

// 语言设置
let currentLanguage: 'zh-CN' | 'en-US' = 'zh-CN';

// 多语言文案
const translations = {
  'zh-CN': {
    title: '阅读助手',
    academicMode: '学术模式',
    close: '关闭',
    summary: '摘要',
    translate: '翻译',
    ask: '提问',
    summarizeButton: '生成摘要',
    translateButton: '翻译整页',
    immersiveTranslateButton: '沉浸式翻译',
    targetLanguage: '目标语言',
    selectTextHint: '选择页面上的文本即可快速翻译',
    translating: '翻译中...',
    paused: '已暂停',
    cancelled: '已取消',
    completed: '已完成',
    questionPlaceholder: '询问关于内容的问题...',
    askButton: '提问',
    clearHistory: '清除历史',
    original: '原文',
    translation: '翻译',
    answer: '答案',
    keyPoints: '要点',
    citations: '引用',
    you: '您',
    assistant: '助手',
    processing: '处理中...',
    copySuccess: '已复制',
    copyFailed: '复制失败',
    summarizePage: '总结当前页面',
    cancel: '取消',
    noSummaryHistory: '暂无总结历史',
    startImmersiveTranslation: '开始沉浸式翻译',
    immersiveModeActive: '沉浸式模式已激活',
    immersiveModeDesc: '翻译内容显示在原文旁边',
    clear: '清除',
    clearSummaryHistory: '清除总结历史',
  },
  'en-US': {
    title: 'Reader Assistant',
    academicMode: 'Academic Mode',
    close: 'Close',
    summary: 'Summary',
    translate: 'Translate',
    ask: 'Ask',
    summarizeButton: 'Generate Summary',
    translateButton: 'Translate Full Page',
    immersiveTranslateButton: 'Immersive Mode',
    targetLanguage: 'Target Language',
    selectTextHint: 'Select text on page to translate instantly',
    translating: 'Translating...',
    paused: 'Paused',
    cancelled: 'Cancelled',
    completed: 'Completed',
    questionPlaceholder: 'Ask a question about the content...',
    askButton: 'Ask',
    clearHistory: 'Clear History',
    original: 'ORIGINAL',
    translation: 'TRANSLATION',
    answer: 'Answer',
    keyPoints: 'Key Points',
    citations: 'Citations',
    you: 'You',
    assistant: 'Assistant',
    processing: 'Processing...',
    copySuccess: 'Copied',
    copyFailed: 'Copy failed',
    summarizePage: 'Summarize Page',
    cancel: 'Cancel',
    noSummaryHistory: 'No summary history',
    startImmersiveTranslation: 'Start Immersive Translation',
    immersiveModeActive: 'Immersive Mode Active',
    immersiveModeDesc: 'Translations are shown inline with the original text',
    clear: 'Clear',
    clearSummaryHistory: 'Clear Summary History',
  },
};

function t() {
  return translations[currentLanguage];
}

// 获取浏览器默认语言
function getBrowserLanguage(): string {
  return navigator.language || navigator.languages?.[0] || 'en';
}

// 更新界面文案
function updateTexts() {
  const texts = t();
  const titleEl = document.getElementById('panel-title');
  if (titleEl) titleEl.textContent = texts.title;
  
  const academicBadge = document.getElementById('academic-badge');
  if (academicBadge) academicBadge.textContent = texts.academicMode;
  
  const tabLabels = document.querySelectorAll('.tab-label');
  // Tab 顺序：ask -> summary -> translate
  const tabData = [
    { index: 0, key: 'ask' },
    { index: 1, key: 'summary' },
    { index: 2, key: 'translate' },
  ];
  tabLabels.forEach((label, idx) => {
    const data = tabData[idx];
    if (data) {
      (label as HTMLElement).textContent = texts[data.key as keyof typeof texts] as string;
    }
  });
  
  const targetLangLabel = document.querySelector('label[for="lang-select"]');
  if (targetLangLabel) targetLangLabel.textContent = texts.targetLanguage;
  
  const translateBtn = document.getElementById('translate-btn');
  if (translateBtn) {
    const span = translateBtn.querySelector('span:last-child');
    if (span) span.textContent = texts.translateButton;
  }
  
  const hintText = document.querySelector('.hint-text');
  if (hintText) hintText.textContent = texts.selectTextHint;
  
  const questionInput = document.getElementById('question-input') as HTMLInputElement;
  if (questionInput) questionInput.placeholder = texts.questionPlaceholder;
  
  const askBtn = document.getElementById('ask-btn');
  if (askBtn) {
    const span = askBtn.querySelector('span');
    if (span) span.textContent = texts.askButton;
  }
  
  const clearHistoryBtn = document.getElementById('clear-conversation-btn');
  if (clearHistoryBtn) clearHistoryBtn.textContent = texts.clearHistory;
  
  const summarizeBtn = document.getElementById('summarize-btn');
  if (summarizeBtn) {
    const textSpan = summarizeBtn.querySelector('.btn-text');
    if (textSpan) textSpan.textContent = texts.summarizePage;
  }
  
  const clearSummaryBtn = document.getElementById('clear-summary-btn');
  if (clearSummaryBtn) clearSummaryBtn.textContent = texts.clearSummaryHistory;
  
  const immersiveBtn = document.getElementById('immersive-translate-btn');
  if (immersiveBtn) {
    const textSpan = immersiveBtn.querySelector('.btn-text');
    if (textSpan) textSpan.textContent = texts.startImmersiveTranslation;
  }
  
  const immersiveStatusText = document.querySelector('.immersive-status .status-text');
  if (immersiveStatusText) immersiveStatusText.textContent = texts.immersiveModeActive;
  
  const immersiveDesc = document.querySelector('.immersive-desc');
  if (immersiveDesc) immersiveDesc.textContent = texts.immersiveModeDesc;
  
  const clearImmersiveBtn = document.getElementById('clear-immersive-btn');
  if (clearImmersiveBtn) clearImmersiveBtn.textContent = texts.clear;
}

// 初始化语言
async function initLanguage() {
  const result = await chrome.storage.sync.get('language');
  if (result.language && (result.language === 'zh-CN' || result.language === 'en-US')) {
    currentLanguage = result.language;
  } else {
    const browserLang = getBrowserLanguage();
    currentLanguage = browserLang.startsWith('zh') ? 'zh-CN' : 'en-US';
  }
  
  const langSelect = document.getElementById('panel-language-select') as HTMLSelectElement;
  if (langSelect) {
    langSelect.value = currentLanguage;
    langSelect.addEventListener('change', async (e) => {
      const lang = (e.target as HTMLSelectElement).value as 'zh-CN' | 'en-US';
      currentLanguage = lang;
      await chrome.storage.sync.set({ language: lang });
      updateTexts();
      // 通知父窗口语言已更改
      window.parent.postMessage({ from: FROM, type: 'languageChanged', language: lang }, '*');
    });
  }
  
  updateTexts();
  
  // 监听语言变化
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.language && changes.language.newValue) {
      currentLanguage = changes.language.newValue as 'zh-CN' | 'en-US';
      const langSelect = document.getElementById('panel-language-select') as HTMLSelectElement;
      if (langSelect) langSelect.value = currentLanguage;
      updateTexts();
    }
  });
}

// 初始化
initLanguage();

// Translation progress functions (defined before use)
function updateTranslationStatus(status: string) {
  const progressStatus = document.getElementById('progress-status');
  const pauseBtn = document.getElementById('pause-translation-btn');
  const texts = t();
  
  if (progressStatus) {
    switch (status) {
      case 'translating':
        progressStatus.textContent = texts.translating;
        if (pauseBtn) {
          pauseBtn.innerHTML = '<span>⏸</span>';
          pauseBtn.title = texts.paused;
        }
        break;
      case 'paused':
        progressStatus.textContent = texts.paused;
        if (pauseBtn) {
          pauseBtn.innerHTML = '<span>▶</span>';
          pauseBtn.title = texts.translating;
        }
        break;
      case 'cancelled':
        progressStatus.textContent = texts.cancelled;
        hideTranslationProgress();
        break;
      case 'completed':
        progressStatus.textContent = texts.completed;
        setTimeout(() => hideTranslationProgress(), 2000);
        break;
    }
  }
}

function updateTranslationProgress(current: number, total: number) {
  const progressText = document.getElementById('progress-text');
  const progressBar = document.getElementById('progress-bar');
  
  if (progressText) {
    progressText.textContent = `${current} / ${total}`;
  }
  
  if (progressBar && total > 0) {
    const percentage = (current / total) * 100;
    progressBar.style.width = `${percentage}%`;
  }
}

function hideTranslationProgress() {
  const progress = document.getElementById('translation-progress');
  if (progress) {
    progress.classList.add('hidden');
  }
  hideLoader();
}

window.addEventListener('message', async (event) => {
  if (event.data.type === 'displaySummary') {
    displaySummary(event.data.data, event.data.isStreaming, event.data.isPDF);
  } else if (event.data.type === 'displayAnswer') {
    displayAnswer(event.data.data, event.data.history, event.data.isStreaming);
  } else if (event.data.type === 'displayTranslation') {
    displayTranslation(event.data.data);
  } else if (event.data.type === 'updateTranslationStatus') {
    updateTranslationStatus(event.data.status);
  } else if (event.data.type === 'updateTranslationProgress') {
    updateTranslationProgress(event.data.current, event.data.total);
  } else if (event.data.type === 'syncSummaryFromBubble') {
    // 从气泡同步总结到 panel
    const summary = event.data.summary;
    const url = await getCurrentUrl();
    await saveSummaryToHistory({
      summary: summary.summary || summary,
      keyPoints: summary.keyPoints || [],
      citations: summary.citations || [],
      timestamp: Date.now(),
      url,
    });
    await loadSummaryHistory();
    // 切换到 summary tab
    switchToTab('summary-tab');
  } else if (event.data.type === 'syncAnswerFromBubble') {
    // 从气泡同步问答到 panel
    const { question, answer } = event.data;
    await saveConversationMessage('user', question);
    await saveConversationMessage('assistant', answer);
    await loadConversationHistory();
    // 切换到 ask tab
    switchToTab('ask-tab');
  }
  
  if (!event.data.isStreaming) {
    hideLoader();
  }
});

// URL 变化监听和自动重新加载历史记录
let lastNormalizedUrl: string = '';

async function checkUrlAndReload() {
  const currentUrl = await getCurrentUrl();
  if (currentUrl !== lastNormalizedUrl) {
    lastNormalizedUrl = currentUrl;
    // URL 变化时重新加载历史记录
    await loadSummaryHistory();
    await loadConversationHistory();
  }
}

// 定期检查 URL 变化（每 1 秒）
setInterval(checkUrlAndReload, 1000);

// 监听页面可见性变化，当 panel 显示时重新加载
document.addEventListener('visibilitychange', async () => {
  if (!document.hidden) {
    // 清除缓存，强制重新获取 URL
    cachedNormalizedUrl = '';
    lastUrlCheck = 0;
    await checkUrlAndReload();
  }
});

// 初始化时加载历史记录
document.addEventListener('DOMContentLoaded', async () => {
  await checkUrlAndReload();
});

// 加载 Summary 历史记录
async function loadSummaryHistory() {
  const url = await getCurrentUrl();
  const history = await getHistory(url);
  const historyContainer = document.getElementById('summary-history');
  if (!historyContainer) return;

  if (!history || !history.summaries || history.summaries.length === 0) {
    const texts = t();
    historyContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: #9ca3af;">${texts.noSummaryHistory}</div>`;
    return;
  }

  const texts = t();
  historyContainer.innerHTML = history.summaries.map((item: SummaryData, index: number) => {
    const date = new Date(item.timestamp || Date.now());
    return `
      <div class="summary-item">
        <div class="summary-item-header">
          <span class="summary-item-time">${date.toLocaleString()}</span>
          <div class="summary-item-actions">
            <button class="copy-summary-item" data-index="${index}">📋</button>
            <button class="delete-summary-item" data-index="${index}">🗑️</button>
          </div>
        </div>
        <div class="summary-item-content">
          ${item.summary && item.summary.trim() ? `
            <div style="margin-bottom: 12px;">
              <strong>${texts.summary}:</strong>
              <div style="margin-top: 6px; line-height: 1.6;">${(item.summary || '').replace(/\n/g, '<br>')}</div>
            </div>
          ` : ''}
          ${item.keyPoints && item.keyPoints.length > 0 ? `
            <div style="margin-bottom: 12px;">
              <strong>${texts.keyPoints}:</strong>
              <ul style="margin-top: 6px; padding-left: 20px;">
                ${item.keyPoints.map((point: string) => `<li style="margin-bottom: 4px;">${point}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${(!item.summary || !item.summary.trim()) && (!item.keyPoints || item.keyPoints.length === 0) ? `
            <div style="color: #9ca3af; font-style: italic; padding: 20px; text-align: center;">
              总结内容为空，可能是解析失败
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // 绑定事件
  historyContainer.querySelectorAll('.copy-summary-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt((e.target as HTMLElement).getAttribute('data-index') || '0');
      const item = history.summaries[index];
      if (item) {
        const html = `${item.summary}\n\n${item.keyPoints.map((p: string) => `• ${p}`).join('\n')}`;
        const htmlContent = `${item.summary}\n\n${item.keyPoints.map((p: string) => `• ${p}`).join('\n')}`;
        await copyToClipboard(htmlContent, htmlContent);
        showCopySuccess(btn as HTMLElement, 'Copied');
      }
    });
  });

  historyContainer.querySelectorAll('.delete-summary-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt((e.target as HTMLElement).getAttribute('data-index') || '0');
      const currentUrl = await getCurrentUrl();
      const currentHistory = await getHistory(currentUrl);
      if (currentHistory && currentHistory.summaries) {
        currentHistory.summaries.splice(index, 1);
        await saveHistory(currentUrl, currentHistory);
        loadSummaryHistory();
      }
    });
  });
}

// 保存 Summary 到历史记录
async function saveSummaryToHistory(summary: SummaryData) {
  const url = await getCurrentUrl();
  const history = await getHistory(url);
  const summaries = history?.summaries || [];
  summaries.unshift({
    ...summary,
    timestamp: Date.now(),
    url,
  });
  // 最多保留10条
  if (summaries.length > 10) {
    summaries.splice(10);
  }
  await saveHistory(url, { ...history, summaries });
  loadSummaryHistory();
}

function displaySummary(summary: SummaryData, isStreaming: boolean = false, isPDF: boolean = false) {
  // Switch to summary tab
  switchToTab('summary-tab');
  
  // 保存到历史记录（仅在非流式且完成时）
  if (!isStreaming) {
    saveSummaryToHistory(summary);
    isSummarizing = false;
    updateSummarizeButtonState(false);
    // 重新加载历史记录以显示新的总结
    loadSummaryHistory();
  }
}

// 加载对话历史
async function loadConversationHistory() {
  const url = await getCurrentUrl();
  const history = await getHistory(url);
  const historyContainer = document.getElementById('conversation-history');
  if (!historyContainer) return;

  if (!history || !history.conversations || !history.conversations.messages || history.conversations.messages.length === 0) {
    historyContainer.innerHTML = '';
    historyContainer.classList.add('hidden');
    return;
  }

  const texts = t();
  historyContainer.innerHTML = history.conversations.messages.map((msg: ConversationMessage) => {
    return `
      <div class="conversation-item conversation-item-${msg.role}">
        <div class="conversation-item-role">${msg.role === 'user' ? texts.you : texts.assistant}</div>
        <div class="conversation-item-content">${msg.content.replace(/\n/g, '<br>')}</div>
      </div>
    `;
  }).join('');

  historyContainer.classList.remove('hidden');
  historyContainer.scrollTop = historyContainer.scrollHeight;
}

// 保存对话消息
async function saveConversationMessage(role: 'user' | 'assistant', content: string) {
  const url = await getCurrentUrl();
  const history = await getHistory(url);
  const conversations = history?.conversations || { messages: [], url };
  
  conversations.messages.push({
    role,
    content,
    timestamp: Date.now(),
  });
  
  await saveHistory(url, { ...history, conversations });
  loadConversationHistory();
}

// 清除对话历史
async function clearConversationHistory() {
  const url = await getCurrentUrl();
  const history = await getHistory(url);
  if (history) {
    history.conversations = { messages: [], url };
    await saveHistory(url, history);
  }
  loadConversationHistory();
}

// 总结对话
async function summarizeConversation() {
  const url = await getCurrentUrl();
  const history = await getHistory(url);
  if (!history || !history.conversations || history.conversations.messages.length === 0) {
    return;
  }

  const conversationText = history.conversations.messages
    .map((msg: ConversationMessage) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n\n');

  window.parent.postMessage({
    from: FROM,
    type: 'requestConversationSummary',
    conversation: conversationText,
  }, '*');
}

function displayAnswer(response: AnswerData, history?: ConversationMessage[], isStreaming: boolean = false) {
  // Switch to ask tab
  switchToTab('ask-tab');
  
  // 保存答案到历史记录（仅在非流式且完成时）
  if (!isStreaming) {
    saveConversationMessage('assistant', response.answer);
  }
  
  loadConversationHistory();
}

function setupCopyButton(buttonId: string, section: HTMLElement | null, texts: any): void {
  if (!section) return;
  
  const copyBtn = document.getElementById(buttonId);
  if (!copyBtn) return;
  
  // 移除旧的事件监听器
  const newCopyBtn = copyBtn.cloneNode(true) as HTMLElement;
  copyBtn.parentNode?.replaceChild(newCopyBtn, copyBtn);
  
  newCopyBtn.addEventListener('click', async () => {
    const contentElements = section.querySelectorAll('.content-text, .key-points, .citations, .answer-content');
    let htmlContent = '';
    let plainText = '';
    
    contentElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.textContent && htmlEl.textContent.trim()) {
        htmlContent += htmlEl.innerHTML + '<br><br>';
        plainText += (htmlEl.textContent || htmlEl.innerText || '') + '\n\n';
      }
    });
    
    // 处理数学公式
    htmlContent = processMathFormulas(htmlContent);
    
    const success = await copyToClipboard(htmlContent, plainText.trim());
    if (success) {
      showCopySuccess(newCopyBtn, texts.copySuccess);
    } else {
      alert(texts.copyFailed || 'Copy failed');
    }
  });
}

function displayTranslation(translatedText: string) {
  // Switch to translate tab
  switchToTab('translate-tab');
  const texts = t();

  const translationSection = document.getElementById('translation-section');
  const translationText = document.getElementById('translation-text');
  const sectionTitle = translationSection?.querySelector('.section-title');

  if (translationSection) translationSection.classList.remove('hidden');
  if (translationText) translationText.textContent = translatedText;
  if (sectionTitle) sectionTitle.textContent = texts.translation;
  
  // 设置复制按钮
  setupCopyButton('copy-translation-btn', translationSection, texts);
}

function switchToTab(tabId: string) {
  const tabs = Array.from(document.querySelectorAll('.tab-btn'));
  const tabContents = Array.from(document.querySelectorAll('.tab-content'));
  
  tabs.forEach(t => t.classList.remove('active'));
  tabContents.forEach(c => c.classList.add('hidden'));

  const targetTab = document.querySelector(`[data-tab="${tabId}"]`);
  const targetContent = document.getElementById(tabId);
  
  if (targetTab) targetTab.classList.add('active');
  if (targetContent) targetContent.classList.remove('hidden');
}

// 总结按钮处理
function setupSummarizeButton() {
  const btn = document.getElementById('summarize-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (isSummarizing) {
      // 取消总结
      if (summaryCancellationController) {
        summaryCancellationController.abort();
        summaryCancellationController = null;
      }
      isSummarizing = false;
      updateSummarizeButtonState(false);
      window.parent.postMessage({ from: FROM, type: 'cancelSummary' }, '*');
      return;
    }

    // 开始总结
    isSummarizing = true;
    summaryCancellationController = new AbortController();
    updateSummarizeButtonState(true);
    
    window.parent.postMessage({ from: FROM, type: 'requestSummary' }, '*');
  });
}

function updateSummarizeButtonState(loading: boolean) {
  const btn = document.getElementById('summarize-btn');
  if (!btn) return;
  
  const texts = t();
  const textSpan = btn.querySelector('.btn-text');
  if (loading) {
    btn.classList.add('loading');
    btn.classList.add('cancelling');
    if (textSpan) textSpan.textContent = texts.cancel;
  } else {
    btn.classList.remove('loading');
    btn.classList.remove('cancelling');
    if (textSpan) textSpan.textContent = texts.summarizePage;
  }
}

setupSummarizeButton();

// 移除整页翻译按钮（已从HTML中移除）

document.getElementById('immersive-translate-btn')?.addEventListener('click', () => {
  const select = document.getElementById('lang-select') as HTMLSelectElement;
  const targetLang = select?.value || getBrowserLanguage();
  window.parent.postMessage({ from: FROM, type: 'requestImmersiveTranslation', targetLang }, '*');

  const immersiveControls = document.getElementById('immersive-controls');
  if (immersiveControls) {
    immersiveControls.classList.remove('hidden');
  }
});

document.getElementById('clear-immersive-btn')?.addEventListener('click', () => {
  window.parent.postMessage({ from: FROM, type: 'clearImmersiveTranslation' }, '*');

  const immersiveControls = document.getElementById('immersive-controls');
  if (immersiveControls) {
    immersiveControls.classList.add('hidden');
  }
});

// Update selection translator target language when language changes
document.getElementById('lang-select')?.addEventListener('change', (e) => {
  const select = e.target as HTMLSelectElement;
  const targetLang = select.value || getBrowserLanguage();
  window.parent.postMessage({ from: FROM, type: 'updateSelectionTargetLang', targetLang }, '*');
});

// 初始化语言选择框为浏览器默认语言
(function initLanguageSelect() {
  const select = document.getElementById('lang-select') as HTMLSelectElement;
  if (select) {
    const browserLang = getBrowserLanguage();
    // 尝试精确匹配
    if (select.querySelector(`option[value="${browserLang}"]`)) {
      select.value = browserLang;
    } else {
      // 尝试匹配语言代码（例如 'en-US' -> 'en'）
      const langCode = browserLang.split('-')[0];
      const matchingOption = select.querySelector(`option[value="${langCode}"]`);
      if (matchingOption) {
        select.value = langCode;
      }
      // 如果没有匹配的选项，保持默认值（zh-CN）
    }
    // 触发 change 事件以更新 selection translator
    select.dispatchEvent(new Event('change'));
  }
})();

document.getElementById('ask-btn')?.addEventListener('click', async () => {
  const input = document.getElementById('question-input') as HTMLInputElement;
  if (input && input.value.trim()) {
    const question = input.value.trim();
    // 先保存用户问题
    await saveConversationMessage('user', question);
    window.parent.postMessage({ from: FROM, type: 'requestAnswer', question }, '*');
    input.value = '';
  }
});

document.getElementById('question-input')?.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    const input = e.target as HTMLInputElement;
    if (input && input.value.trim()) {
      const question = input.value.trim();
      // 先保存用户问题
      await saveConversationMessage('user', question);
      window.parent.postMessage({ from: FROM, type: 'requestAnswer', question }, '*');
      input.value = '';
    }
  }
});

document.getElementById('close-btn')?.addEventListener('click', () => {
  window.parent.postMessage({ from: FROM, type: 'closePanel' }, '*');
});

document.getElementById('clear-conversation-btn')?.addEventListener('click', async () => {
  await clearConversationHistory();
  window.parent.postMessage({ from: FROM, type: 'clearConversation' }, '*');
});

// 移除一键总结对话功能

// 清除 Summary 历史
document.getElementById('clear-summary-btn')?.addEventListener('click', async () => {
  const url = await getCurrentUrl();
  const history = await getHistory(url);
  if (history) {
    history.summaries = [];
    await saveHistory(url, history);
  }
  loadSummaryHistory();
});

// Tabs
const tabs = Array.from(document.querySelectorAll('.tab-btn'));
const tabContents = Array.from(document.querySelectorAll('.tab-content'));

tabs.forEach((tab) => {
  tab.addEventListener('click', async () => {
    const target = tab.getAttribute('data-tab');
    if (target) {
      switchToTab(target);
      
      // 先检查 URL 是否变化，然后加载对应标签页的历史记录
      await checkUrlAndReload();
      
      // 加载对应标签页的历史记录
      if (target === 'summary-tab') {
        await loadSummaryHistory();
      } else if (target === 'ask-tab') {
        await loadConversationHistory();
      }
    }
  });
});

// Loader helpers
function showLoader(text: string) {
  const loader = document.getElementById('loader');
  const loaderText = document.querySelector('.loader-text');
  if (loader) loader.classList.remove('hidden');
  if (loaderText) loaderText.textContent = text;
}

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.classList.add('hidden');
}

// Hide loader when results arrive
window.addEventListener('message', (event) => {
  if (event.data.type === 'displayTranslation' || event.data.type === 'displaySummary' || event.data.type === 'displayAnswer') {
    hideLoader();
  }
});

// Translation control buttons
document.getElementById('pause-translation-btn')?.addEventListener('click', () => {
  const status = document.getElementById('progress-status')?.textContent;
  if (status === 'Paused') {
    window.parent.postMessage({ from: FROM, type: 'resumeTranslation' }, '*');
  } else {
    window.parent.postMessage({ from: FROM, type: 'pauseTranslation' }, '*');
  }
});

document.getElementById('cancel-translation-btn')?.addEventListener('click', () => {
  window.parent.postMessage({ from: FROM, type: 'cancelTranslation' }, '*');
});

