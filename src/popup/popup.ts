import { StorageService } from '../services/storage';
import { i18n, Language } from '../utils/i18n';

class Popup {
  private apiKeyInput: HTMLInputElement;
  private baseUrlInput: HTMLInputElement;
  private saveButton: HTMLButtonElement;
  private statusDiv: HTMLDivElement;
  private languageSelect: HTMLSelectElement;
  private titleElement: HTMLElement;
  private apiKeyLabel: HTMLLabelElement;
  private baseUrlLabel: HTMLLabelElement;
  private securityHint: HTMLElement;

  constructor() {
    this.apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
    this.baseUrlInput = document.getElementById('base-url') as HTMLInputElement;
    this.saveButton = document.getElementById('save-btn') as HTMLButtonElement;
    this.statusDiv = document.getElementById('status') as HTMLDivElement;
    this.languageSelect = document.getElementById('language-select') as HTMLSelectElement;
    this.titleElement = document.getElementById('title') as HTMLElement;
    this.apiKeyLabel = document.getElementById('api-key-label') as HTMLLabelElement;
    this.baseUrlLabel = document.getElementById('base-url-label') as HTMLLabelElement;
    this.securityHint = document.getElementById('security-hint-text') as HTMLElement;

    this.init();
  }

  private async init(): Promise<void> {
    await i18n.loadLanguage();
    await this.loadConfig();
    this.updateTexts();
    this.saveButton.addEventListener('click', () => this.saveConfig());
    this.languageSelect.addEventListener('change', (e) => {
      const lang = (e.target as HTMLSelectElement).value as Language;
      i18n.setLanguage(lang).then(() => this.updateTexts());
    });
    
    // 监听语言变化
    i18n.subscribe(() => this.updateTexts());
    
    // 设置当前语言
    this.languageSelect.value = i18n.getLanguage();
  }

  private updateTexts(): void {
    const t = i18n.t();
    this.titleElement.textContent = t.popup.title;
    this.apiKeyLabel.textContent = t.popup.apiKeyLabel;
    this.apiKeyInput.placeholder = t.popup.apiKeyPlaceholder;
    this.baseUrlLabel.textContent = t.popup.baseUrlLabel;
    this.baseUrlInput.placeholder = t.popup.baseUrlPlaceholder;
    this.saveButton.textContent = t.popup.saveButton;
    if (this.securityHint) {
      this.securityHint.textContent = t.popup.securityHint;
    }
  }

  private async loadConfig(): Promise<void> {
    const config = await StorageService.getConfig();
    this.apiKeyInput.value = config.apiKey;
    this.baseUrlInput.value = config.baseUrl || '';
  }

  private async saveConfig(): Promise<void> {
    const apiKey = this.apiKeyInput.value.trim();
    const baseUrl = this.baseUrlInput.value.trim();
    const t = i18n.t();

    if (!apiKey) {
      this.showStatus(t.popup.apiKeyRequired, 'error');
      return;
    }

    try {
      await StorageService.saveConfig({ apiKey, baseUrl });
      this.showStatus(t.popup.saveSuccess, 'success');
    } catch (error) {
      this.showStatus(t.popup.saveError, 'error');
    }
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;
    setTimeout(() => {
      this.statusDiv.textContent = '';
      this.statusDiv.className = 'status';
    }, 3000);
  }
}

new Popup();
