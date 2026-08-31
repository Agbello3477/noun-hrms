'use client';

import { useState, useEffect } from 'react';
import { Download, X, ShieldAlert, PhoneCall, BookOpen, CheckCircle2 } from 'lucide-react';

export default function ExtensionPromptModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Check if dismissed before
    const isDismissed = localStorage.getItem('noun_extension_prompt_dismissed');
    if (isDismissed) return;

    // Small delay so user sees dashboard first
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('noun_extension_prompt_dismissed', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-emerald-700/20 overflow-hidden text-gray-900">
        {/* Header */}
        <div className="bg-[#006533] px-5 py-3.5 flex items-center justify-between text-white border-b-2 border-[#eab308]">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🏛️</span>
            <div>
              <h3 className="font-bold text-sm leading-tight">NOUN Desktop Companion</h3>
              <p className="text-[10px] text-emerald-100 font-medium">Recommended for all NOUN Staff &amp; Faculty</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            title="Dismiss"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5">
          <p className="text-xs text-gray-600 leading-relaxed">
            Enhance your workflow with the official Chrome Extension for real-time background call alerts and research tools:
          </p>

          <div className="grid grid-cols-3 gap-2 py-1">
            <div className="bg-emerald-50/70 border border-emerald-100 p-2.5 rounded-xl text-center flex flex-col items-center">
              <PhoneCall className="w-5 h-5 text-emerald-700 mb-1" />
              <span className="text-[11px] font-bold text-gray-800">VoIP Alerts</span>
              <span className="text-[9px] text-gray-500">Incoming calls</span>
            </div>
            <div className="bg-blue-50/70 border border-blue-100 p-2.5 rounded-xl text-center flex flex-col items-center">
              <BookOpen className="w-5 h-5 text-blue-700 mb-1" />
              <span className="text-[11px] font-bold text-gray-800">Paper Clipper</span>
              <span className="text-[9px] text-gray-500">Google Scholar</span>
            </div>
            <div className="bg-red-50/70 border border-red-100 p-2.5 rounded-xl text-center flex flex-col items-center">
              <ShieldAlert className="w-5 h-5 text-red-600 mb-1" />
              <span className="text-[11px] font-bold text-gray-800">SOS Trigger</span>
              <span className="text-[9px] text-gray-500">Campus Security</span>
            </div>
          </div>

          {showInstructions ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2 text-xs text-gray-700 animate-in fade-in duration-200">
              <div className="font-bold text-gray-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>3-Step Quick Setup in Chrome:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-600">
                <li>Open <code className="bg-gray-200 px-1 py-0.5 rounded text-gray-800 font-mono text-[10px]">chrome://extensions/</code> in a new tab.</li>
                <li>Turn ON <strong>&quot;Developer mode&quot;</strong> in the top-right corner.</li>
                <li>Click <strong>&quot;Load unpacked&quot;</strong> and select the downloaded extension folder.</li>
              </ol>
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="flex-1 bg-[#006533] hover:bg-[#004d26] text-white py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-900/10 hover:-translate-y-0.5"
            >
              <Download size={14} />
              <span>{showInstructions ? 'Hide Setup Steps' : 'Enable Chrome Extension'}</span>
            </button>
            <button
              onClick={handleDismiss}
              className="py-2.5 px-3.5 border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
