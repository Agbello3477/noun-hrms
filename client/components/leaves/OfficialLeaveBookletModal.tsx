'use client';

import React, { useState } from 'react';
import { OfficialLeaveBooklet } from '@/types/leaveBooklet';
import OfficialLeaveBookletViewer from './OfficialLeaveBookletViewer';
import OfficialLeaveBookletForm from './OfficialLeaveBookletForm';
import { X, BookOpen, Printer, Edit3, ShieldCheck } from 'lucide-react';

interface OfficialLeaveBookletModalProps {
  isOpen: boolean;
  onClose: () => void;
  booklet?: Partial<OfficialLeaveBooklet>;
  profile?: any;
  userRole?: string;
  initialViewMode?: 'VIEW' | 'FORM';
  reviewMode?: 'STAFF_APPLY' | 'HOD_REVIEW' | 'DEAN_REVIEW' | 'HR_REVIEW' | 'REGISTRAR_REVIEW' | 'VIEW_ONLY';
  onSave?: (data: OfficialLeaveBooklet, isDraft: boolean) => Promise<void>;
}

export default function OfficialLeaveBookletModal({
  isOpen,
  onClose,
  booklet,
  profile,
  userRole,
  initialViewMode = 'VIEW',
  reviewMode = 'STAFF_APPLY',
  onSave,
}: OfficialLeaveBookletModalProps) {
  const [viewMode, setViewMode] = useState<'VIEW' | 'FORM'>(initialViewMode);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFormSubmit = async (data: OfficialLeaveBooklet, isDraft: boolean) => {
    if (!onSave) return;
    setIsSubmitting(true);
    try {
      await onSave(data, isDraft);
      if (!isDraft) {
        setViewMode('VIEW');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-slate-100 rounded-3xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Modal Bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#006533] flex items-center justify-center text-white shadow-xs">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-white uppercase">
                Official Statutory Leave Booklet
              </h2>
              <p className="text-[11px] text-emerald-300 font-medium">
                Form NOUN/HR/LV-26 • 26-Point Statutory Schedule &amp; Audit Trail
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('VIEW')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'VIEW'
                    ? 'bg-[#006533] text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Printer size={13} /> Official Document View
              </button>
              {reviewMode !== 'VIEW_ONLY' && (
                <button
                  type="button"
                  onClick={() => setViewMode('FORM')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    viewMode === 'FORM'
                      ? 'bg-[#006533] text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Edit3 size={13} /> Edit / Endorse Form
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-xl transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {viewMode === 'VIEW' ? (
            <OfficialLeaveBookletViewer
              booklet={booklet as OfficialLeaveBooklet}
              onClose={onClose}
              showPrintActions={true}
            />
          ) : (
            <OfficialLeaveBookletForm
              initialData={booklet}
              profile={profile}
              userRole={userRole}
              mode={reviewMode}
              onSubmit={handleFormSubmit}
              onCancel={() => setViewMode('VIEW')}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
