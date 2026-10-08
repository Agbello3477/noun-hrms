'use client';

import React, { useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import ChatbotDrawer from './ChatbotDrawer';
import { useAuth } from '../../hooks/useAuth';

export default function ChatbotTrigger() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // If user is not authenticated yet, do not render floating trigger
  if (!user) {
    return null;
  }

  return (
    <>
      {/* Floating Trigger Button (Bottom-Right) */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(true)}
          title="Open NOUN-Sentinel AI Copilot"
          aria-label="Open NOUN-Sentinel AI Copilot"
          className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#002D62] text-[#DAA520] shadow-xl border-2 border-[#DAA520]/50 transition-all duration-300 hover:scale-105 hover:bg-[#001f44] hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-[#002D62]/30 active:scale-95"
        >
          {/* Pulsing Status Dot */}
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
          </span>

          {/* Bot & Sparkles Icon */}
          <div className="relative">
            <Bot className="h-7 w-7 transition-transform group-hover:rotate-6" />
            <Sparkles className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 text-[#DAA520] animate-pulse" />
          </div>

          {/* Tooltip on Hover */}
          <div className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
            NOUN-Sentinel AI Copilot
            <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-4 border-transparent border-l-slate-900"></div>
          </div>
        </button>
      </div>

      {/* Slide-over Drawer */}
      <ChatbotDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
