import { Config, AISummary, AIResponse, Citation, Message } from '../utils/types';
import { DEFAULT_BASE_URL, getBrowserLanguage, getLanguageNameForAI } from '../utils/constants';

export class AIService {
  private config: Config;
  private baseUrl: string;
  private model: string;
  private abortController: AbortController | null = null;

  constructor(config: Config) {
    this.config = config;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.model = this.resolveModel(this.baseUrl);
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async summarize(
    content: string, 
    isPDF: boolean = false, 
    onChunk?: (chunk: string) => void,
    targetLanguage?: string | null,
    shouldCancel?: () => boolean
  ): Promise<AISummary> {
    const isAcademic = isPDF || content.length > 10000; // Heuristic for academic mode
    
    // 如果没有指定语言，使用 'auto' 让 AI 自动检测
    // targetLanguage 应该由调用者根据网页内容语言传入
    const lang = targetLanguage || 'auto';
    
    // 将语言代码转换为AI可理解的语言名称
    let langInstruction = '';
    if (lang === 'auto') {
      langInstruction = ' IMPORTANT: Please respond in the same language as the content you are analyzing.';
    } else {
      const langName = getLanguageNameForAI(lang);
      langInstruction = ` IMPORTANT: Please respond in ${langName}. All summary, key points, and citations must be in ${langName}.`;
    }
    
    const academicSystemPrompt = `You are an expert academic researcher. Analyze the paper and provide a structured summary including: Objective, Methodology, Key Results, and Implications.${langInstruction}`;
    const webSystemPrompt = `You are an expert content analyzer. Provide a concise summary and key takeaways.${langInstruction}`;

    const systemPrompt = isAcademic ? academicSystemPrompt : webSystemPrompt;

    const academicUserPrompt = `Analyze this paper thoroughly:
1. Summary: A structured abstract (max 150 words)
2. Key Points: 3-5 bullet points of methodology and core findings
3. Citations: Key excerpts linked to claims

Content:
${content.substring(0, 50000)}`;

    const userPrompt = isAcademic ? academicUserPrompt : `Please analyze the following content and provide:
1. A concise summary (2-3 sentences)
2. 3-5 key points
3. Important citations with their approximate character positions in the text

Content:
${content.substring(0, 50000)}`;

    if (onChunk) {
      let fullContent = '';
      await this.callStreamAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], (chunk) => {
        if (shouldCancel && shouldCancel()) {
          throw new Error('Summary cancelled');
        }
        fullContent += chunk;
        onChunk(fullContent);
      }, undefined, shouldCancel);
      return this.parseSummaryResponse({ choices: [{ message: { content: fullContent } }] }, content);
    }

    const response = await this.callAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], undefined, shouldCancel);

    return this.parseSummaryResponse(response, content);
  }

  async answerQuestion(question: string, content: string, isPDF: boolean = false): Promise<AIResponse> {
    const response = await this.answerWithHistory(question, content, [], isPDF);
    return response;
  }

  async translate(content: string, targetLang: string | null = null, professional: boolean = false): Promise<string> {
    if (!targetLang) {
      targetLang = getBrowserLanguage();
    }
    
    // 专业翻译提示词：保留特殊名词、国家城市名称等
    const systemPrompt = professional 
      ? `You are a professional translator. Translate the text to ${targetLang} while preserving:
1. Proper nouns (names of people, companies, products, brands)
2. Country and city names (keep original or use standard translation)
3. Technical terms (use standard terminology)
4. Numbers, dates, and measurements
5. Formatting and structure

Provide only the translation, no explanations.`
      : `You are a professional translator. Translate the following content to ${targetLang} while maintaining the original formatting and structure.`;

    const response = await this.callAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Translate this content:\n\n${content.substring(0, 50000)}` },
    ]);

    return response.choices[0].message.content;
  }

  async translateSegments(content: string, targetLang: string | null = null): Promise<Array<{ original: string; translated: string; position: number }>> {
    if (!targetLang) {
      targetLang = getBrowserLanguage();
    }
    const segments = this.splitIntoSegments(content);
    const results: Array<{ original: string; translated: string; position: number }> = [];
    let currentPos = 0;

    for (const segment of segments) {
      if (segment.trim().length < 10) {
        currentPos += segment.length;
        continue;
      }

      try {
        const translated = await this.translate(segment, targetLang);
        results.push({
          original: segment,
          translated: translated.trim(),
          position: currentPos,
        });
      } catch (error) {
        console.error('Translation error for segment:', error);
      }

      currentPos += segment.length;
    }

    return results;
  }

  async translateLines(
    lines: string[], 
    targetLang: string | null = null,
    onProgress?: (current: number, total: number) => void,
    shouldCancel?: () => boolean
  ): Promise<string[]> {
    if (!targetLang) {
      targetLang = getBrowserLanguage();
    }
    const results: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (shouldCancel && shouldCancel()) {
        throw new Error('Translation cancelled');
      }

      const line = lines[i];
      if (line.trim().length < 3) {
        results.push('');
        if (onProgress) onProgress(i + 1, lines.length);
        continue;
      }

      try {
        // 使用专业翻译模式（逐行翻译，保留特殊名词）
        const translated = await this.translate(line, targetLang, true);
        results.push(translated.trim());
        if (onProgress) onProgress(i + 1, lines.length);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Translation cancelled');
        }
        console.error('Translation error for line:', error);
        results.push('');
        if (onProgress) onProgress(i + 1, lines.length);
      }
    }

    return results;
  }

  private splitIntoSegments(content: string, maxLength: number = 500): string[] {
    const segments: string[] = [];
    const sentences = content.split(/([.!?。！？]\s+)/);
    let currentSegment = '';

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (currentSegment.length + sentence.length > maxLength && currentSegment) {
        segments.push(currentSegment.trim());
        currentSegment = sentence;
      } else {
        currentSegment += sentence;
      }
    }

    if (currentSegment.trim()) {
      segments.push(currentSegment.trim());
    }

    return segments.filter(s => s.length > 0);
  }

  async answerWithHistory(question: string, content: string, history: Message[] = [], isPDF: boolean = false, onChunk?: (chunk: string) => void): Promise<AIResponse> {
    const systemPrompt = isPDF
      ? 'You are an expert at analyzing academic papers. Answer questions based on the provided content and cite specific sections with their character positions.'
      : 'You are an expert at analyzing web content. Answer questions based on the provided content and cite specific sections with their character positions.';

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: `Context content:\n${content.substring(0, 30000)}` },
      ...history,
      { role: 'user', content: question },
    ];

    if (onChunk) {
      let fullContent = '';
      await this.callStreamAPI(messages, (chunk) => {
        fullContent += chunk;
        onChunk(fullContent);
      });
      return this.parseAnswerResponse({ choices: [{ message: { content: fullContent } }] }, content);
    }

    const response = await this.callAPI(messages);
    return this.parseAnswerResponse(response, content);
  }

  private async callStreamAPI(
    messages: Message[], 
    onChunk: (chunk: string) => void, 
    signal?: AbortSignal,
    shouldCancel?: () => boolean
  ): Promise<void> {
    const url = this.baseUrl.endsWith('/chat/completions')
      ? this.baseUrl
      : `${this.baseUrl}/chat/completions`;

    this.abortController = new AbortController();
    const abortSignal = signal || this.abortController.signal;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        stream: true,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');

    if (!reader) throw new Error('Failed to get stream reader');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (shouldCancel && shouldCancel()) {
          throw new Error('Request cancelled');
        }
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || '';
            if (content) onChunk(content);
          } catch (e) {
            // Partial JSON or heartbeat
          }
        }
      }
    }
  }

  private async callAPI(messages: Message[], signal?: AbortSignal, shouldCancel?: () => boolean): Promise<any> {
    const url = this.baseUrl.endsWith('/chat/completions')
      ? this.baseUrl
      : `${this.baseUrl}/chat/completions`;

    this.abortController = new AbortController();
    const abortSignal = signal || this.abortController.signal;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  private parseSummaryResponse(response: any, originalContent: string): AISummary {
    const content = response.choices[0].message.content;
    const citations = this.extractCitations(content, originalContent);

    // 支持中英文关键词匹配
    // 匹配 "summary:" 或 "摘要:" 或 "总结:" 等
    const summaryPatterns = [
      /(?:summary|摘要|总结|概要)[:：\s]+(.*?)(?:\n|key|要点|$)/i,
      /(?:summary|摘要|总结|概要)[:：\s]+(.*?)(?:\n\n|$)/is,
    ];
    
    // 匹配 "key points:" 或 "要点:" 或 "关键点:" 等
    const keyPointsPatterns = [
      /(?:key points?|要点|关键点|核心要点)[:：\s]+(.*?)(?:\n\n|$)/is,
      /(?:key points?|要点|关键点|核心要点)[:：\s]+(.*?)(?:\n|$)/is,
    ];

    let summary = '';
    let keyPoints: string[] = [];

    // 尝试匹配摘要
    for (const pattern of summaryPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        summary = match[1].trim();
        break;
      }
    }

    // 如果没匹配到，尝试其他方式提取
    if (!summary) {
      // 尝试找到第一个段落作为摘要
      const lines = content.split('\n').filter((line: string) => line.trim());
      if (lines.length > 0) {
        summary = lines[0].trim();
        // 如果第一行看起来像是标题，尝试第二行
        if (summary.length < 50 && lines.length > 1) {
          summary = lines[1].trim();
        }
      } else {
        // 如果都没有，使用前500个字符
        summary = content.substring(0, 500).trim();
      }
    }

    // 尝试匹配要点
    for (const pattern of keyPointsPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const pointsText = match[1].trim();
        // 支持多种列表格式：• - 1. 等
        keyPoints = pointsText
          .split(/[•\-\*]\s+|[\d+\.]\s+|、|，/)
          .map((p: string) => p.trim())
          .filter((p: string) => p.length > 0);
        break;
      }
    }

    // 如果没匹配到要点，尝试从内容中提取列表项
    if (keyPoints.length === 0) {
      const listPattern = /(?:^|\n)[•\-\*]\s+(.+?)(?=\n[•\-\*]|\n\n|$)/gm;
      const listMatches = content.matchAll(listPattern);
      for (const match of listMatches) {
        if (match[1]) {
          keyPoints.push(match[1].trim());
        }
      }
    }

    // 如果还是没有要点，尝试从数字列表提取
    if (keyPoints.length === 0) {
      const numberedPattern = /(?:^|\n)\d+[\.、]\s+(.+?)(?=\n\d+[\.、]|\n\n|$)/gm;
      const numberedMatches = content.matchAll(numberedPattern);
      for (const match of numberedMatches) {
        if (match[1]) {
          keyPoints.push(match[1].trim());
        }
      }
    }

    return {
      summary: summary || content.substring(0, 500).trim(), // 确保至少有一些内容
      keyPoints: keyPoints.length > 0 ? keyPoints : [], // 如果没有要点，返回空数组
      citations,
    };
  }

  private parseAnswerResponse(response: any, originalContent: string): AIResponse {
    const content = response.choices[0].message.content;
    const citations = this.extractCitations(content, originalContent);

    return {
      answer: content,
      citations,
    };
  }

  private extractCitations(text: string, originalContent: string): Citation[] {
    const citations: Citation[] = [];
    const citationPattern = /\[(\d+)\]:\s*(.+?)(?=\[|\n|$)/g;
    let match;

    while ((match = citationPattern.exec(text)) !== null) {
      const citationText = match[2].trim();
      const position = originalContent.indexOf(citationText);
      
      if (position !== -1) {
        citations.push({
          text: citationText,
          position,
        });
      }
    }

    return citations;
  }

  private resolveModel(baseUrl: string): string {
    const lower = baseUrl.toLowerCase();
    if (lower.includes('open.bigmodel.cn')) {
      return 'glm-4-flash';
    }
    return 'gpt-4o-mini';
  }
}
