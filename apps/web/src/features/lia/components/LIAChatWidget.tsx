'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useTheme, themeColors } from '@/contexts/ThemeContext';

interface Attachment {
  name: string;
  mimeType: string;
  data: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
}

interface ARIAChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userRole?: string;
  userId?: string;
  teamId?: string;
}

const QUICK_ACTIONS = [
  { label: 'Que puedes hacer', message: 'Que puedes hacer en Project Hub?' },
  { label: 'Mis tareas', message: 'Ayudame a revisar mis tareas pendientes.' },
  { label: 'Estado del proyecto', message: 'Ayudame a resumir el estado del proyecto.' },
  { label: 'Crear tarea', message: 'Quiero crear una nueva tarea.' },
];

function renderMessage(content: string) {
  return content.split('**').map((part, index) => (
    index % 2 === 1 ? <strong key={index}>{part}</strong> : part
  ));
}

export function LIAChatWidget({
  isOpen,
  onClose,
  userName,
  userRole,
  userId,
  teamId,
}: ARIAChatWidgetProps) {
  const { isDark } = useTheme();
  const colors = isDark ? themeColors.dark : themeColors.light;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const panelColors = {
    bg: colors.bgPrimary,
    bgSoft: isDark ? '#151A21' : '#F8FAFC',
    bgMuted: isDark ? '#1E2329' : '#F1F5F9',
    border: colors.border,
    text: colors.textPrimary,
    muted: colors.textSecondary,
    accent: '#00D4B3',
    primary: '#0A2540',
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Hola${userName ? ` ${userName}` : ''}. Soy **ARIA**, tu asistente de Project Hub. Puedo ayudarte con proyectos, tareas, equipos y analisis de documentos.`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length, userName]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result;
      if (typeof result !== 'string') return;

      setAttachments((current) => [
        ...current,
        {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: result.split(',')[1] || '',
        },
      ]);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const toggleVoiceInput = () => {
    const browserWindow = window as Window & {
      SpeechRecognition?: any;
      webkitSpeechRecognition?: any;
    };
    const SpeechRecognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      window.alert('Tu navegador no soporta dictado por voz. Prueba con Chrome o Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;

      if (result.isFinal) {
        setInput((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${transcript}`);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    const currentAttachments = [...attachments];

    if ((!textToSend && currentAttachments.length === 0) || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      timestamp: new Date(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    const assistantId = `assistant-${Date.now()}`;

    try {
      const chatMessages = messages
        .filter((message) => message.id !== 'welcome')
        .map((message) => ({
          role: message.role,
          content: message.content,
          attachments: message.attachments,
        }));

      chatMessages.push({
        role: 'user',
        content: userMessage.content,
        attachments: userMessage.attachments,
      });

      setMessages((current) => [
        ...current,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ]);

      const accessToken = window.localStorage.getItem('accessToken');
      const response = await fetch('/api/lia/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          messages: chatMessages,
          context: {
            userName,
            userRole,
            userId,
            teamId,
            currentPage: window.location.pathname,
          },
          stream: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'No fue posible conectar con ARIA.');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      if (!reader) {
        throw new Error('El navegador no pudo leer la respuesta de ARIA.');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = JSON.parse(line.slice(6));
          if (data.content) {
            assistantContent += data.content;
            setMessages((current) => current.map((message) => (
              message.id === assistantId
                ? { ...message, content: assistantContent }
                : message
            )));
          }
        }
      }
    } catch (error) {
      const content = error instanceof Error
        ? `No pude procesar el mensaje: ${error.message}`
        : 'No pude procesar el mensaje. Intenta de nuevo.';

      setMessages((current) => current.map((message) => (
        message.id === assistantId ? { ...message, content } : message
      )));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setInput('');
    setAttachments([]);
  };

  const hasContent = input.trim().length > 0 || attachments.length > 0;
  const showQuickActions = !hasContent && !isLoading && messages.length <= 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed right-0 top-16 z-50 flex w-[420px] max-w-[95vw] flex-col"
          style={{
            height: 'calc(100vh - 64px)',
            backgroundColor: panelColors.bg,
            borderLeft: `1px solid ${panelColors.border}`,
            boxShadow: isDark ? '-8px 0 30px rgba(0,0,0,0.35)' : '-8px 0 30px rgba(15,23,42,0.12)',
          }}
          aria-label="ARIA Chat"
        >
          <header
            className="m-3 flex items-center justify-between rounded-xl border px-4 py-3"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(0,212,179,0.15), rgba(10,37,64,0.25))'
                : 'linear-gradient(135deg, rgba(0,212,179,0.12), #FFFFFF)',
              borderColor: panelColors.border,
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white"
                style={{ background: `linear-gradient(135deg, ${panelColors.accent}, ${panelColors.primary})` }}
              >
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold" style={{ color: panelColors.text }}>
                  ARIA Chat
                </h2>
                <p className="truncate text-xs" style={{ color: panelColors.accent }}>
                  Asistente IA en linea
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={clearConversation}
                  className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                  style={{ color: panelColors.muted }}
                  aria-label="Limpiar conversacion"
                  title="Limpiar conversacion"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                style={{ color: panelColors.muted }}
                aria-label="Cerrar ARIA Chat"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-2">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[86%] rounded-xl px-4 py-3 text-sm leading-relaxed"
                  style={message.role === 'user'
                    ? {
                      background: `linear-gradient(135deg, ${panelColors.accent}, ${panelColors.primary})`,
                      color: '#FFFFFF',
                    }
                    : {
                      backgroundColor: panelColors.bgMuted,
                      border: `1px solid ${panelColors.border}`,
                      color: panelColors.text,
                    }}
                >
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {message.attachments.map((attachment, index) => (
                        <div
                          key={`${attachment.name}-${index}`}
                          className="flex items-center gap-2 rounded-lg border border-white/20 bg-black/10 px-2 py-1 text-xs"
                        >
                          {attachment.mimeType.startsWith('image/') ? (
                            <ImageIcon className="h-3.5 w-3.5" />
                          ) : (
                            <FileText className="h-3.5 w-3.5" />
                          )}
                          <span className="max-w-[120px] truncate">{attachment.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{renderMessage(message.content)}</div>
                  <div
                    className="mt-2 text-[11px]"
                    style={{ color: message.role === 'user' ? 'rgba(255,255,255,0.75)' : panelColors.muted }}
                  >
                    {message.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div
                  className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
                  style={{
                    backgroundColor: panelColors.bgMuted,
                    borderColor: panelColors.border,
                    color: panelColors.muted,
                  }}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  ARIA esta pensando
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showQuickActions && (
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => sendMessage(action.message)}
                  className="rounded-lg border px-3 py-2 text-xs font-medium transition-all hover:border-[#00D4B3]"
                  style={{
                    backgroundColor: panelColors.bgSoft,
                    borderColor: panelColors.border,
                    color: panelColors.text,
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          <footer
            className="border-t p-4"
            style={{ backgroundColor: panelColors.bgSoft, borderColor: panelColors.border }}
          >
            {attachments.length > 0 && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {attachments.map((attachment, index) => (
                  <div
                    key={`${attachment.name}-${index}`}
                    className="group relative flex max-w-[160px] items-center gap-2 rounded-lg border px-2 py-2 text-xs"
                    style={{
                      backgroundColor: panelColors.bg,
                      borderColor: panelColors.border,
                      color: panelColors.text,
                    }}
                  >
                    {attachment.mimeType.startsWith('image/') ? (
                      <ImageIcon className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span className="truncate">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="ml-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
                      aria-label={`Quitar ${attachment.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf,text/plain,text/markdown"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border transition-colors hover:border-[#00D4B3]"
                style={{
                  backgroundColor: panelColors.bg,
                  borderColor: panelColors.border,
                  color: panelColors.muted,
                }}
                aria-label="Adjuntar archivo"
                title="Adjuntar archivo"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder={isListening ? 'Escuchando...' : 'Escribe a ARIA...'}
                className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm outline-none transition-colors focus:border-[#00D4B3]"
                style={{
                  backgroundColor: panelColors.bg,
                  borderColor: isListening ? '#EF4444' : panelColors.border,
                  color: panelColors.text,
                }}
              />

              <button
                type="button"
                onClick={() => {
                  if (isLoading) return;
                  if (isListening) {
                    toggleVoiceInput();
                    return;
                  }
                  if (hasContent) {
                    sendMessage();
                    return;
                  }
                  toggleVoiceInput();
                }}
                disabled={isLoading}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-all disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: isListening
                    ? '#EF4444'
                    : hasContent
                      ? `linear-gradient(135deg, ${panelColors.accent}, ${panelColors.primary})`
                      : panelColors.bg,
                  border: hasContent || isListening ? 'none' : `1px solid ${panelColors.border}`,
                  color: hasContent || isListening ? '#FFFFFF' : panelColors.muted,
                }}
                aria-label={isListening ? 'Detener dictado' : hasContent ? 'Enviar mensaje' : 'Dictar por voz'}
                title={isListening ? 'Detener dictado' : hasContent ? 'Enviar mensaje' : 'Dictar por voz'}
              >
                {isListening ? <Square className="h-4 w-4 fill-current" /> : hasContent ? <Send className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            </div>
          </footer>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export { LIAChatWidget as ARIAChatWidget };
export default LIAChatWidget;
