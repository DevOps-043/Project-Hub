/**
 * Configuración del cliente Google Gemini AI
 * Para usar como agente de IA en Project Hub
 */

import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai';

// Configuración por defecto
const GEMINI_CONFIG = {
  apiKey: process.env.GOOGLE_API_KEY || '',
  model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '8192'),
  temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
  thinkingLevel: process.env.GEMINI_THINKING_LEVEL || 'medium',
};

// Cliente singleton
let _genAI: GoogleGenerativeAI | null = null;
let _model: GenerativeModel | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!GEMINI_CONFIG.apiKey) {
    throw new Error('GOOGLE_API_KEY no está configurada. Por favor, añádela a tu archivo .env.local');
  }

  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(GEMINI_CONFIG.apiKey);
    console.log('Gemini Client Initialized');
  }

  return _genAI;
}

export function getGeminiModel(): GenerativeModel {
  if (!_model) {
    const genAI = getGeminiClient();
    
    const generationConfig: GenerationConfig = {
      maxOutputTokens: GEMINI_CONFIG.maxTokens,
      temperature: GEMINI_CONFIG.temperature,
    };

    _model = genAI.getGenerativeModel({
      model: GEMINI_CONFIG.model,
      generationConfig,
    });
  }

  return _model;
}

/**
 * Interfaz para mensajes del chat
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: {
    mimeType: string;
    data: string; // Base64 encoded data
  }[];
}

function formatMessageParts(message: ChatMessage) {
    const parts: any[] = [{ text: message.content }];
    if (message.attachments && message.attachments.length > 0) {
        message.attachments.forEach(att => {
            parts.push({
                inlineData: {
                    mimeType: att.mimeType,
                    data: att.data
                }
            });
        });
    }
    return parts;
}

/**
 * Genera una respuesta simple de texto
 */
export async function generateText(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

/**
 * Genera una respuesta de chat con historial (No Streaming)
 */
export async function generateChatResponse(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<string> {
  const model = getGeminiModel();
  
  const history = messages
    .filter(m => m.role !== 'system')
    .slice(0, -1) // Excluir ultimo
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: formatMessageParts(m),
    }));

  let fullSystemPrompt = systemPrompt || '';
  const systemMessages = messages.filter(m => m.role === 'system');
  if (systemMessages.length > 0) {
    fullSystemPrompt = systemMessages.map(m => m.content).join('\n\n') + (fullSystemPrompt ? '\n\n' + fullSystemPrompt : '');
  }

  const chat = model.startChat({
    history,
    generationConfig: {
      maxOutputTokens: GEMINI_CONFIG.maxTokens,
      temperature: GEMINI_CONFIG.temperature,
    },
  });

  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  if (!lastUserMessage) throw new Error('No user message');

  const partsToSend = formatMessageParts(lastUserMessage);
  
  if (fullSystemPrompt) {
      const textPart = partsToSend.find(p => 'text' in p);
      if (textPart) {
          textPart.text = `${fullSystemPrompt}\n\n---\n\n${textPart.text}`;
      } else {
          partsToSend.unshift({ text: fullSystemPrompt });
      }
  }

  const result = await chat.sendMessage(partsToSend);
  const response = await result.response;
  return response.text();
}

/**
 * Stream de respuesta para chat (Multimodal)
 */
export async function* streamChatResponse(
  messages: ChatMessage[],
  systemPrompt?: string
): AsyncGenerator<string> {
  const model = getGeminiModel();
  
  const history = messages
    .filter(m => m.role !== 'system')
    .slice(0, -1)
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: formatMessageParts(m),
    }));

  let fullSystemPrompt = systemPrompt || '';
  const systemMessages = messages.filter(m => m.role === 'system');
  if (systemMessages.length > 0) {
    fullSystemPrompt = systemMessages.map(m => m.content).join('\n\n') + (fullSystemPrompt ? '\n\n' + fullSystemPrompt : '');
  }

  const chat = model.startChat({
    history,
    generationConfig: {
      maxOutputTokens: GEMINI_CONFIG.maxTokens,
      temperature: GEMINI_CONFIG.temperature,
    },
  });

  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  if (!lastUserMessage) throw new Error('No user message');

  const partsToSend = formatMessageParts(lastUserMessage);
  
  if (fullSystemPrompt) {
      const textPart = partsToSend.find(p => 'text' in p);
      // Prepend system prompt to the LAST user message's text block
      // Gemini works best when system instructions are part of the first prompt or history, 
      // but modifying the last prompt is a reliable way to enforce it in stateless-like calls.
      if (textPart) {
          textPart.text = `${fullSystemPrompt}\n\n---\n\n${textPart.text}`;
      } else {
          partsToSend.unshift({ text: fullSystemPrompt });
      }
  }

  const result = await chat.sendMessageStream(partsToSend);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

export const geminiConfig = GEMINI_CONFIG;
