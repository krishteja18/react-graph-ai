/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

export type AIProvider = 'gemini' | 'openai' | 'anthropic';

export interface AIServiceResponse {
  content: string;
  provider: AIProvider;
}

export class AIService {
  private provider: AIProvider;

  constructor() {
    this.provider = (process.env.AI_PROVIDER as AIProvider) || 'gemini';
  }

  public async complete(prompt: string): Promise<AIServiceResponse> {
    switch (this.provider) {
      case 'openai':
        return this.completeOpenAI(prompt);
      case 'anthropic':
        return this.completeAnthropic(prompt);
      case 'gemini':
      default:
        return this.completeGemini(prompt);
    }
  }

  private async completeGemini(prompt: string): Promise<AIServiceResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

    const genAI = new GoogleGenAI({ apiKey });
    const result = await genAI.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
    });
    return {
      content: result.text ?? '',
      provider: 'gemini'
    };
  }

  private async completeOpenAI(prompt: string): Promise<AIServiceResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    return {
      content: response.choices[0].message.content || '',
      provider: 'openai'
    };
  }

  private async completeAnthropic(prompt: string): Promise<AIServiceResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    return {
      content: (response.content[0] as any).text || '',
      provider: 'anthropic'
    };
  }
}
