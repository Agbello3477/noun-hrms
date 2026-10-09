'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  Mic,
  MicOff,
  RefreshCw,
  BookOpen,
  ChevronDown,
  ShieldCheck,
  Compass,
  ThumbsUp,
  ThumbsDown,
  BrainCircuit,
  Maximize2,
  CheckCircle2
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import ChatbotActionCard, { ActionCardProps } from './ChatbotActionCard';
import Button from '../ui/Button';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  actionCard?: ActionCardProps['card'];
  citations?: string[];
  suggestedFollowUps?: string[];
  learnedInsightApplied?: boolean;
  userQueryOrigin?: string;
  feedbackGiven?: 'THUMBS_UP' | 'THUMBS_DOWN' | 'CORRECTION';
  timestamp: string;
}

interface ChatbotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatbotDrawer({ isOpen, onClose }: ChatbotDrawerProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [correctionModalMsgId, setCorrectionModalMsgId] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize initial greeting with respectful salutation
  useEffect(() => {
    if (messages.length === 0) {
      const roleStr = String(user?.role || 'STAFF');
      const nameStr = user?.name || 'Colleague';
      
      let title = 'Colleague';
      if (roleStr === 'REGISTRAR') title = 'Registrar';
      else if (roleStr === 'VICE_CHANCELLOR') title = 'Vice-Chancellor';
      else if (roleStr === 'DEAN') title = 'Dean';
      else if (roleStr === 'HOD') title = 'HOD';
      else if (roleStr === 'BURSAR') title = 'Bursar';
      else if (nameStr.toLowerCase().includes('prof')) title = 'Prof.';
      else if (nameStr.toLowerCase().includes('dr')) title = 'Dr.';

      const defaultGreeting: Message = {
        id: 'initial-greeting',
        sender: 'assistant',
        text: `Good day, **${title} ${nameStr}**.\n\nWelcome to **NOUN-Sentinel AI**, your enterprise administrative co-pilot.\n\nBy default, I provide **laser-specific answers** and **proactive institutional recommendations**. (Ask for a *"detailed breakdown"* anytime you need the full step-by-step statutory citations).\n\nHow may I assist you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([defaultGreeting]);
    }

    // Fetch dynamic suggestion chips
    api.get('/api/v1/ai/suggestions')
      .then((res: any) => {
        if (res.data?.suggestions) {
          setSuggestedPrompts(res.data.suggestions);
        }
      })
      .catch(() => {
        const role = String(user?.role || 'STAFF');
        if (role === 'REGISTRY_ADMIN' || role === 'HR_ADMIN') {
          setSuggestedPrompts([
            'Show candidates due for 2026 promotion review',
            'Draft disciplinary query template',
            'Explain file release authorization steps'
          ]);
        } else if (role === 'HOD' || role === 'DEAN' || role === 'UNIT_HEAD') {
          setSuggestedPrompts([
            "Check my department's teaching workload distribution",
            'Who has pending leave applications in my unit?',
            'What is the credit unit cap for Professors?'
          ]);
        } else {
          setSuggestedPrompts([
            'Track my pending application',
            'Check my leave balance',
            'What is my next promotion due year?'
          ]);
        }
      });
  }, [user]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Voice Recognition Setup
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputQuery(transcript);
        setIsListening(false);
      };

      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);

      recognitionRef.current = rec;
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert('Voice dictation is not supported by your current browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      const res = await api.post('/api/v1/ai/chat', {
        message: query,
        conversationHistory: historyPayload
      });

      const data = res.data;
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: data.message || 'I processed your query.',
        actionCard: data.actionCard,
        citations: data.citations,
        suggestedFollowUps: data.suggestedFollowUps,
        learnedInsightApplied: data.learnedInsightApplied,
        userQueryOrigin: query,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, aiMessage]);
      if (data.suggestedFollowUps && data.suggestedFollowUps.length > 0) {
        setSuggestedPrompts(data.suggestedFollowUps);
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ Operational Notice: ${err?.response?.data?.message || 'Unable to reach NOUN-Sentinel AI service. Please check your connectivity.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (msgId: string, type: 'THUMBS_UP' | 'THUMBS_DOWN' | 'CORRECTION', correction?: string) => {
    const targetMsg = messages.find((m) => m.id === msgId);
    if (!targetMsg) return;

    try {
      await api.post('/api/v1/ai/feedback', {
        query: targetMsg.userQueryOrigin || targetMsg.text.slice(0, 100),
        copilotResponse: targetMsg.text,
        feedbackType: type,
        userCorrection: correction
      });

      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, feedbackGiven: type } : m))
      );
    } catch {
      // Graceful ignore
    }
  };

  const submitCorrection = async () => {
    if (!correctionModalMsgId || !correctionText.trim()) return;
    setIsSubmittingCorrection(true);
    await handleFeedback(correctionModalMsgId, 'CORRECTION', correctionText);
    setIsSubmittingCorrection(false);
    setCorrectionModalMsgId(null);
    setCorrectionText('');
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'initial-greeting-reset',
        sender: 'assistant',
        text: `Conversation reset. How can NOUN-Sentinel AI assist you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
      {/* Slide-over Container */}
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl border-l border-slate-200 sm:max-w-md md:max-w-lg animate-in slide-in-from-right duration-300">
        
        {/* Header: Deep dark navy (#002D62) with radiant gold (#DAA520) accents */}
        <div className="flex items-center justify-between bg-[#002D62] px-5 py-4 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#DAA520] border border-[#DAA520]/40 shadow-inner">
              <Bot className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-[#002D62]"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-white">NOUN-Sentinel AI</h3>
                <span className="rounded-full bg-[#DAA520]/20 px-2 py-0.5 text-[10px] font-extrabold text-[#DAA520] border border-[#DAA520]/30 uppercase">
                  Self-Learning
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">Enterprise Policy & Administrative Co-Pilot</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={clearChat}
              title="Reset Conversation"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              title="Close Drawer"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Security & Self-Learning Grounding Banner */}
        <div className="flex items-center justify-between border-b border-amber-200/60 bg-amber-50/80 px-4 py-2 text-[11px] font-medium text-amber-900">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-700 flex-shrink-0" />
            <span>Grounded in NOUN Conditions of Service (2024)</span>
          </div>
          <div className="flex items-center gap-1 text-slate-500 text-[10px]">
            <BrainCircuit className="h-3 w-3 text-[#002D62]" />
            <span>Adaptive Memory Active</span>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#002D62] text-[#DAA520] shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}

              <div className={`max-w-[88%] space-y-1.5 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-slate-900 text-white rounded-tr-none'
                      : 'bg-white text-slate-900 border border-slate-200/80 rounded-tl-none'
                  }`}
                >
                  {/* Learned Insight Badge */}
                  {msg.learnedInsightApplied && (
                    <div className="mb-2 inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      <BrainCircuit className="h-3 w-3" />
                      <span>Enhanced with Learned Institutional Memory</span>
                    </div>
                  )}

                  {/* Message body */}
                  <div className="space-y-2 whitespace-pre-wrap">
                    {msg.text.split('\n\n').map((para, pIdx) => {
                      if (para.startsWith('• ') || para.startsWith('* ') || para.startsWith('- ')) {
                        const items = para.split('\n');
                        return (
                          <ul key={pIdx} className="list-disc pl-4 space-y-1 my-1">
                            {items.map((it, iIdx) => (
                              <li key={iIdx}>{it.replace(/^[•*-]\s*/, '')}</li>
                            ))}
                          </ul>
                        );
                      }
                      if (para.startsWith('> ')) {
                        return (
                          <blockquote key={pIdx} className="border-l-2 border-[#DAA520] pl-3 italic text-slate-700 bg-amber-50/40 py-1 my-1 rounded-r">
                            {para.replace(/^>\s*/, '')}
                          </blockquote>
                        );
                      }
                      return <p key={pIdx}>{para}</p>;
                    })}
                  </div>

                  {/* Render Interactive Action Card if returned */}
                  {msg.actionCard && (
                    <ChatbotActionCard card={msg.actionCard} />
                  )}

                  {/* Expand Details Trigger Button */}
                  {msg.sender === 'assistant' && msg.text.includes('Need the full step-by-step') && (
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleSendMessage(`Provide the complete step-by-step detailed breakdown for: ${msg.userQueryOrigin || 'this inquiry'}`)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-[#002D62] hover:text-white px-3 py-1.5 text-xs font-semibold text-[#002D62] transition-colors"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        <span>Expand Full Step-by-Step Breakdown</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer metadata and feedback / self-learning buttons */}
                <div className={`flex items-center gap-3 text-[10px] text-slate-400 px-1 ${msg.sender === 'user' ? 'justify-end' : 'justify-between'}`}>
                  <span>{msg.timestamp}</span>

                  {msg.sender === 'assistant' && msg.id !== 'initial-greeting' && (
                    <div className="flex items-center gap-1.5">
                      {msg.feedbackGiven ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium text-[10px]">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Feedback recorded & learned</span>
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleFeedback(msg.id, 'THUMBS_UP')}
                            title="Accurate & helpful"
                            className="p-1 hover:text-emerald-600 rounded transition-colors"
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleFeedback(msg.id, 'THUMBS_DOWN')}
                            title="Needs improvement"
                            className="p-1 hover:text-rose-600 rounded transition-colors"
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setCorrectionModalMsgId(msg.id)}
                            title="Teach AI / Suggest institutional correction"
                            className="hover:text-[#002D62] underline ml-1 font-medium transition-colors"
                          >
                            Teach / Correct
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-200 shadow-sm">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {/* Zero Layout Shift Skeleton Loader */}
          {isLoading && (
            <div className="flex gap-3 justify-start animate-pulse">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#002D62] text-[#DAA520]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="w-[75%] rounded-2xl rounded-tl-none border border-slate-200 bg-white p-4 space-y-2">
                <div className="h-3 w-4/5 rounded bg-slate-200"></div>
                <div className="h-3 w-3/5 rounded bg-slate-200"></div>
                <div className="h-3 w-2/5 rounded bg-slate-100"></div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Dynamic Suggested Prompts Chips */}
        {suggestedPrompts.length > 0 && !isLoading && (
          <div className="border-t border-slate-200 bg-white px-4 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-2">
              <Compass className="h-3 w-3 text-[#002D62]" />
              <span>Suggested Queries</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-left text-xs font-medium text-slate-700 hover:border-[#002D62] hover:bg-slate-100 hover:text-[#002D62] transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-slate-200 bg-white p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Voice Dictation Button */}
            <button
              type="button"
              onClick={toggleVoice}
              title={isListening ? 'Stop Listening' : 'Voice Input'}
              className={`rounded-xl p-2.5 transition-all ${
                isListening
                  ? 'bg-rose-600 text-white animate-bounce'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={isListening ? 'Listening...' : 'Ask about policies, leave, promotion, docket...'}
              disabled={isLoading}
              className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#002D62] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#002D62]/20 disabled:opacity-60"
            />

            {/* Send Button */}
            <Button
              type="submit"
              disabled={!inputQuery.trim() || isLoading}
              isLoading={isLoading}
              size="md"
              className="bg-[#002D62] hover:bg-[#001f44] text-[#DAA520] font-bold shadow-md"
              icon={<Send className="h-4 w-4" />}
            />
          </form>
        </div>

      </div>

      {/* Teach AI / Suggest Correction Modal */}
      {correctionModalMsgId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4 border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#002D62]">
                <BrainCircuit className="h-5 w-5 text-[#DAA520]" />
                <h4 className="font-bold text-base">Teach NOUN-Sentinel AI</h4>
              </div>
              <button onClick={() => setCorrectionModalMsgId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Help the AI co-pilot learn institutional nuances or recent departmental resolutions. Your correction will be indexed into its continuous adaptive memory.
            </p>

            <textarea
              rows={3}
              value={correctionText}
              onChange={(e) => setCorrectionText(e.target.value)}
              placeholder="Provide the exact institutional rule or clarified handling..."
              className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#002D62] focus:outline-none focus:ring-1 focus:ring-[#002D62]"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCorrectionModalMsgId(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <Button
                size="sm"
                onClick={submitCorrection}
                isLoading={isSubmittingCorrection}
                disabled={!correctionText.trim()}
                className="bg-[#002D62] text-white hover:bg-[#001f44] text-xs font-bold"
              >
                Save to Learned Memory
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
