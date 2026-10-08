'use client';

import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Check, PenTool, ShieldCheck } from 'lucide-react';

interface SignaturePadProps {
  value?: string;
  onChange: (signatureDataUrl: string) => void;
  signerName?: string;
  signerDesignation?: string;
  label?: string;
  disabled?: boolean;
}

export default function SignaturePad({
  value,
  onChange,
  signerName,
  signerDesignation,
  label = 'Digital Signature Pad',
  disabled = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(Boolean(value));
  const [activeMode, setActiveMode] = useState<'DRAW' | 'STAMP'>(value ? 'DRAW' : 'DRAW');

  useEffect(() => {
    if (value && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = value;
      }
    }
  }, [value]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.strokeStyle = '#006533';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  };

  const clearSignature = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange('');
  };

  const generateOfficialStamp = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render Digital Stamp Style
    ctx.fillStyle = '#f0fdf4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#006533';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    ctx.fillStyle = '#006533';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DIGITALLY SIGNED & VERIFIED', canvas.width / 2, 28);

    ctx.font = 'italic 16px serif';
    ctx.fillText(signerName || 'Staff Member', canvas.width / 2, 52);

    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(signerDesignation || 'National Open University of Nigeria', canvas.width / 2, 70);

    ctx.font = '9px monospace';
    ctx.fillStyle = '#64748b';
    const stampDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
    ctx.fillText(`NOUN-STAMP: ${stampDate} WAT`, canvas.width / 2, 88);

    setHasDrawn(true);
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <PenTool size={13} className="text-[#006533]" />
          {label}
        </label>
        {!disabled && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={generateOfficialStamp}
              className="text-[11px] font-bold text-[#006533] hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 transition"
            >
              <ShieldCheck size={12} /> Use Digital Stamp
            </button>
            <button
              type="button"
              onClick={clearSignature}
              className="text-[11px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 bg-slate-100 hover:bg-rose-50 px-2 py-1 rounded-md transition"
            >
              <RotateCcw size={12} /> Clear
            </button>
          </div>
        )}
      </div>

      <div className="relative border-2 border-dashed border-emerald-300 rounded-xl overflow-hidden bg-slate-50/50 hover:bg-white transition shadow-inner">
        <canvas
          ref={canvasRef}
          width={420}
          height={100}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`w-full h-[100px] cursor-crosshair touch-none ${disabled ? 'opacity-75 cursor-not-allowed' : ''}`}
        />
        {!hasDrawn && !disabled && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400">
            <PenTool size={18} className="mb-1 opacity-50 text-emerald-700" />
            <span className="text-[11px] font-medium">Draw signature here or click &quot;Use Digital Stamp&quot;</span>
          </div>
        )}
      </div>
    </div>
  );
}
