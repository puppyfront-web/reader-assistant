export interface Config {
  apiKey: string;
  baseUrl?: string;
}

export interface AISummary {
  summary: string;
  keyPoints: string[];
  citations: Citation[];
}

export interface Citation {
  text: string;
  position: number;
  page?: number;
  section?: string;
}

export interface AIResponse {
  answer: string;
  citations: Citation[];
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
