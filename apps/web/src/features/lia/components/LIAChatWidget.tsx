'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useTheme, themeColors } from '@/contexts/ThemeContext';
import { MarkdownMessage } from './MarkdownMessage';

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
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 32, stiffness: 280 }}
          className="fixed right-0 top-16 z-50 flex w-[400px] max-w-[95vw] flex-col"
          style={{
            height: 'calc(100vh - 64px)',
            backgroundColor: panelColors.bg,
            borderLeft: `1px solid ${panelColors.border}`,
            boxShadow: isDark
              ? '-12px 0 40px rgba(0,0,0,0.5)'
              : '-12px 0 40px rgba(15,23,42,0.1)',
          }}
          aria-label="ARIA Chat"
        >
          {/* ── Header ── */}
          <header
            className="flex items-center justify-between px-4 py-3"
            style={{
              borderBottom: `1px solid ${panelColors.border}`,
              background: isDark
                ? 'linear-gradient(180deg, rgba(0,212,179,0.06) 0%, transparent 100%)'
                : 'linear-gradient(180deg, rgba(0,212,179,0.04) 0%, transparent 100%)',
            }}
          >
            <div className="flex items-center gap-2.5">
              {/* Avatar */}
              <div
                className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white"
                style={{
                  background: 'radial-gradient(circle at 30% 25%, #2BE9C6 0%, #00D4B3 45%, #0A2540 100%)',
                  boxShadow: '0 4px 12px rgba(0,212,179,0.35)',
                }}
              >
                <Bot className="h-4 w-4" strokeWidth={1.8} />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 bg-emerald-400"
                  style={{ borderColor: panelColors.bg }} />
              </div>

              <div>
                <p className="text-sm font-semibold leading-none" style={{ color: panelColors.text }}>
                  ARIA
                </p>
                <p className="mt-0.5 text-[11px] leading-none" style={{ color: panelColors.accent }}>
                  Asistente IA · en linea
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={clearConversation}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                  style={{ color: panelColors.muted }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  aria-label="Limpiar conversacion"
                  title="Limpiar conversacion"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                style={{ color: panelColors.muted }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                aria-label="Cerrar ARIA Chat"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* ── Messages ── */}
          <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'thin' }}>
            <div className="flex flex-col gap-5">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {message.role === 'assistant' ? (
                    /* ── Mensaje ARIA: avatar + texto limpio, sin burbuja pesada ── */
                    <div className="flex items-start gap-2.5">
                      <div
                        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white"
                        style={{
                          background: 'radial-gradient(circle at 30% 25%, #2BE9C6 0%, #00D4B3 45%, #0A2540 100%)',
                          boxShadow: '0 2px 8px rgba(0,212,179,0.3)',
                        }}
                      >
                        <Bot className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </div>

                      <div className="min-w-0 flex-1">
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {message.attachments.map((attachment, index) => (
                              <div
                                key={`${attachment.name}-${index}`}
                                className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                                style={{ borderColor: panelColors.border, color: panelColors.muted, backgroundColor: panelColors.bgMuted }}
                              >
                                {attachment.mimeType.startsWith('image/') ? (
                                  <ImageIcon className="h-3 w-3" />
                                ) : (
                                  <FileText className="h-3 w-3" />
                                )}
                                <span className="max-w-[110px] truncate">{attachment.name}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="text-sm" style={{ color: panelColors.text, lineHeight: 1.6 }}>
                          <MarkdownMessage
                            content={message.content}
                            colors={{
                              text: panelColors.text,
                              muted: panelColors.muted,
                              accent: panelColors.accent,
                              bgMuted: panelColors.bgMuted,
                              border: panelColors.border,
                            }}
                          />
                        </div>

                        <p className="mt-1.5 text-[10px]" style={{ color: panelColors.muted }}>
                          {message.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* ── Mensaje usuario: burbuja compacta a la derecha ── */
                    <div className="flex justify-end">
                      <div className="max-w-[78%]">
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
                            {message.attachments.map((attachment, index) => (
                              <div
                                key={`${attachment.name}-${index}`}
                                className="flex items-center gap-1.5 rounded-md border border-white/20 bg-black/20 px-2 py-1 text-xs text-white/80"
                              >
                                {attachment.mimeType.startsWith('image/') ? (
                                  <ImageIcon className="h-3 w-3" />
                                ) : (
                                  <FileText className="h-3 w-3" />
                                )}
                                <span className="max-w-[110px] truncate">{attachment.name}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div
                          className="rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm text-white"
                          style={{
                            background: `linear-gradient(135deg, #00D4B3 0%, #0A2540 100%)`,
                            boxShadow: '0 2px 12px rgba(0,212,179,0.2)',
                            lineHeight: 1.55,
                          }}
                        >
                          {message.content}
                        </div>

                        <p className="mt-1 text-right text-[10px]" style={{ color: panelColors.muted }}>
                          {message.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* ── Typing indicator ── */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2.5"
                >
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white"
                    style={{
                      background: 'radial-gradient(circle at 30% 25%, #2BE9C6 0%, #00D4B3 45%, #0A2540 100%)',
                      boxShadow: '0 2px 8px rgba(0,212,179,0.3)',
                    }}
                  >
                    <Bot className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </div>
                  <div
                    className="flex items-center gap-1 rounded-2xl rounded-tl-sm px-4 py-3"
                    style={{ backgroundColor: panelColors.bgMuted, border: `1px solid ${panelColors.border}` }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: panelColors.accent }}
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ── Quick actions ── */}
          {showQuickActions && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => sendMessage(action.message)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: panelColors.border,
                    color: panelColors.muted,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = panelColors.accent;
                    e.currentTarget.style.color = panelColors.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = panelColors.border;
                    e.currentTarget.style.color = panelColors.muted;
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Composer ── */}
          <footer className="px-3 pb-4 pt-2">
            {/* Preview de adjuntos */}
            {attachments.length > 0 && (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {attachments.map((attachment, index) => (
                  <div
                    key={`${attachment.name}-${index}`}
                    className="flex max-w-[150px] flex-shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs"
                    style={{ backgroundColor: panelColors.bgMuted, borderColor: panelColors.border, color: panelColors.text }}
                  >
                    {attachment.mimeType.startsWith('image/') ? (
                      <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                    )}
                    <span className="truncate">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="ml-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
                      aria-label={`Quitar ${attachment.name}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Caja del input — todo en una píldora */}
            <div
              className="flex items-center gap-1 rounded-2xl border px-2 py-1.5 transition-colors"
              style={{
                backgroundColor: panelColors.bgMuted,
                borderColor: isListening ? '#EF4444' : panelColors.border,
              }}
            >
              <input ref={fileInputRef} type="file" className="hidden"
                accept="image/*,application/pdf,text/plain,text/markdown"
                onChange={handleFileSelect}
              />

              {/* Adjuntar */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-colors"
                style={{ color: panelColors.muted }}
                onMouseEnter={(e) => (e.currentTarget.style.color = panelColors.accent)}
                onMouseLeave={(e) => (e.currentTarget.style.color = panelColors.muted)}
                aria-label="Adjuntar archivo"
                title="Adjuntar archivo"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              {/* Input */}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder={isListening ? 'Escuchando...' : 'Escribe a ARIA...'}
                className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:opacity-50"
                style={{ color: panelColors.text }}
              />

              {/* Voz / Enviar */}
              <button
                type="button"
                onClick={() => {
                  if (isLoading) return;
                  if (isListening) { toggleVoiceInput(); return; }
                  if (hasContent) { sendMessage(); return; }
                  toggleVoiceInput();
                }}
                disabled={isLoading}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-40"
                style={{
                  background: isListening
                    ? '#EF4444'
                    : hasContent
                      ? 'linear-gradient(135deg, #00D4B3 0%, #0A2540 100%)'
                      : 'transparent',
                  color: hasContent || isListening ? '#fff' : panelColors.muted,
                  boxShadow: hasContent ? '0 2px 8px rgba(0,212,179,0.3)' : 'none',
                }}
                aria-label={isListening ? 'Detener dictado' : hasContent ? 'Enviar' : 'Dictar por voz'}
                title={isListening ? 'Detener dictado' : hasContent ? 'Enviar' : 'Dictar por voz'}
              >
                {isListening
                  ? <Square className="h-3.5 w-3.5 fill-current" />
                  : hasContent
                    ? <Send className="h-3.5 w-3.5" />
                    : <Mic className="h-4 w-4" />}
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
