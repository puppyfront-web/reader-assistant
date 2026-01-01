# Reader Assistant

A powerful AI-driven browser extension that provides intelligent reading assistance for web pages and PDF documents, including content summarization, professional translation, and intelligent Q&A.

## ✨ Key Features

### 📝 Intelligent Summarization (Summary)
- **Page Summarization**: One-click summarization of current web page or PDF document content
- **History Records**: Automatically save summarization history, organized by URL
- **Academic Mode**: Automatically identify academic papers and provide structured summaries (Objective, Method, Results, Impact)
- **Streaming Output**: Real-time display of summarization content with background execution support
- **Pause/Cancel**: Support for pausing and canceling long-running summarization tasks

### 💬 Intelligent Q&A (Ask)
- **Contextual Q&A**: Intelligent Q&A based on current page content
- **Conversation History**: Save all Q&A records, organized by URL
- **Multi-turn Conversation**: Support for contextually relevant continuous conversations
- **One-click Clear**: Quickly clear conversation history for current page

### 🌐 Professional Translation (Translate)
- **Immersive Translation**: Line-by-line translation with original and translated text displayed side by side
- **Professional Translation**: Intelligently preserve special nouns, country/city names, and technical terms
- **Multi-language Support**: Support for Chinese, English, Japanese, Korean, French, German, and more
- **Real-time Translation**: Translation results displayed in real-time on the page

### 🎯 Quick Actions for Selected Text
- **Quick Translation**: Translate selected text immediately
- **Quick Question**: Ask questions about selected text quickly
- **Quick Summary**: Summarize selected text quickly
- **One-click Copy**: Support for rich text format copying, including mathematical formulas

### 🌍 Multi-language Interface
- **Chinese/English Toggle**: Complete Chinese and English interface support
- **Auto Detection**: Automatically detect browser language
- **Language Memory**: Remember user's language preferences

## 🚀 Quick Start

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd reader-assistant
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Load the extension**
   - Open Chrome browser
   - Visit `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory of the project

### Configuration

1. **Get API Key**
   - Visit OpenAI website to get an API Key
   - Or use other compatible API services

2. **Configure the extension**
   - Click the extension icon in the browser toolbar
   - Enter API Key and Base URL (optional)
   - Click "Save"

## 📖 User Guide

### Summarization Feature

1. **Summarize current page**
   - Open the sidebar, switch to "Summary" tab
   - Click "Summarize Current Page" button
   - Wait for summarization to complete, results will be automatically saved to history

2. **View history**
   - View all historical summaries in the Summary tab
   - Support copying and deleting individual summaries
   - Support one-click clear all history

3. **Quick summarize selected text**
   - Select text on the page
   - Click the "Summarize" button in the bubble
   - Results will automatically sync to sidebar history

### Q&A Feature

1. **Ask questions**
   - Open the sidebar, switch to "Ask" tab (default)
   - Enter your question in the input box
   - Click "Ask" button or press Enter
   - View AI's response

2. **View conversation history**
   - All Q&A will be automatically saved to history
   - Support viewing complete conversation context

3. **Quick question about selected text**
   - Select text on the page
   - Click the "Ask" button in the bubble
   - Results will automatically sync to sidebar history

### Translation Feature

1. **Immersive translation**
   - Open the sidebar, switch to "Translate" tab
   - Select target language
   - Click "Start Immersive Translation" button
   - Page content will be translated line by line and displayed next to the original text

2. **Quick translate selected text**
   - Select text on the page
   - Click the "Translate" button in the bubble
   - Translation results will be displayed in the bubble

3. **Clear translation**
   - Click "Clear" button to remove all translation content

## 🛠️ Development Guide

### Project Structure

```
reader-assistant/
├── src/
│   ├── background/          # Service Worker (background scripts)
│   │   └── service-worker.ts
│   ├── content/             # Content Scripts
│   │   ├── content.ts       # Main content script
│   │   ├── selection-translator.ts  # Selected text translator
│   │   ├── pdf-extractor.ts # PDF extractor
│   │   └── pdf-translator.ts # PDF translator
│   ├── popup/               # Extension popup (configuration interface)
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.ts
│   ├── services/            # Service layer
│   │   ├── ai-service.ts    # AI service
│   │   ├── secure-ai-service.ts  # Secure AI service (Service Worker proxy)
│   │   └── storage.ts       # Storage service
│   ├── ui/                  # UI components
│   │   ├── panel.ts         # Sidebar panel
│   │   ├── panel-script.ts  # Panel script
│   │   ├── panel.html       # Panel HTML
│   │   ├── panel.css        # Panel styles
│   │   └── quick-chat.ts    # Quick chat bubble
│   └── utils/               # Utility functions
│       ├── i18n.ts          # Internationalization
│       ├── copy-utils.ts   # Copy utilities
│       ├── constants.ts    # Constants
│       └── types.ts        # Type definitions
├── dist/                    # Build output directory
├── manifest.json            # Extension manifest file
├── package.json             # Project configuration
├── tsconfig.json            # TypeScript configuration
├── webpack.config.js        # Webpack configuration
└── README.md                # Project documentation

```

### Development Commands

```bash
# Development mode (watch file changes)
npm run dev

# Production build
npm run build

# Type checking
npm run type-check
```

### Tech Stack

- **TypeScript** - Type-safe JavaScript
- **Webpack** - Module bundler
- **Chrome Extension API** - Browser extension API
- **PDF.js** - PDF document processing
- **OpenAI API** - AI service (compatible with other compatible APIs)

### Code Standards

- Follow SOLID principles
- Use TypeScript strict mode
- Code style reference "Clean Code"
- Remove all AI-generated low-quality code and redundant comments

## 🔒 Security

### API Key Security

- ✅ **Local Storage**: API Key is only stored locally (`chrome.storage.local`), not synced to cloud
- ✅ **Security Tips**: Display security tips in configuration interface
- ✅ **Service Worker Proxy**: Support API calls through Service Worker proxy (optional)

### Best Practices

1. **Use Dedicated API Key**
   - Create a dedicated API key for the extension
   - Set usage limits and expiration time
   - Regularly rotate API keys

2. **Protect Device Security**
   - Use strong passwords to protect browser accounts
   - Regularly update browser and extension
   - Avoid using on public devices

For detailed security information, please refer to [SECURITY.md](./SECURITY.md)

## 📋 Features

### Implemented

- ✅ Intelligent content summarization (supports web pages and PDFs)
- ✅ Contextual intelligent Q&A
- ✅ Professional immersive translation
- ✅ Quick actions for selected text
- ✅ History management (organized by URL)
- ✅ Multi-language interface support (Chinese/English)
- ✅ Rich text copying (supports mathematical formulas)
- ✅ Streaming output and background execution
- ✅ Pause/cancel functionality
- ✅ Automatic sync of bubble operations to sidebar

### Technical Highlights

- 🎯 **URL-based History Storage**: Independent history management for each web page
- 🔄 **Auto Sync**: Bubble operations automatically sync to sidebar
- 🌍 **Multi-language Support**: Complete Chinese and English interface
- 📱 **Responsive Design**: Adapts to different screen sizes
- ⚡ **Performance Optimization**: Streaming output with real-time feedback
- 🔒 **Security First**: API Key stored locally, no cloud sync

## 🐛 Issue Reporting

If you encounter any issues or have feature suggestions, please submit an Issue.

## 🤝 Contributing

Issues and Pull Requests are welcome!

### Development Workflow

1. Fork this project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **OpenAI** - AI service support
- **PDF.js** - PDF document processing support
- **Chrome Extension API** - Browser extension platform support

## 📝 Changelog

### v1.0.0
- ✅ Initial version release
- ✅ Intelligent summarization feature
- ✅ Intelligent Q&A feature
- ✅ Professional translation feature
- ✅ Multi-language interface support
- ✅ History management
- ✅ Rich text copying support

