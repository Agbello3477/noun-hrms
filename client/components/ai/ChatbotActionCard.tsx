'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, CheckCircle2, Clock, AlertTriangle, XCircle, FileText, ChevronRight } from 'lucide-react';
import Button from '../ui/Button';

export interface ActionCardProps {
  card: {
    type: 'APPLICATION_TRACKER' | 'LEAVE_SUMMARY' | 'PROMOTION_ELIGIBILITY' | 'WORKLOAD_BREAKDOWN' | 'MANUAL_GUIDE';
    title: string;
    statusBadge?: {
      label: string;
      color: 'yellow' | 'blue' | 'green' | 'red' | 'purple';
    };
    stepperStage?: {
      current: number;
      total: number;
      stageName: string;
    };
    metrics?: {
      label: string;
      value: string | number;
      subtext?: string;
    }[];
    actionButtons?: {
      label: string;
      actionUrl: string;
      variant?: 'primary' | 'secondary' | 'outline';
    }[];
    details?: Record<string, any>;
  };
}

export default function ChatbotActionCard({ card }: ActionCardProps) {
  const router = useRouter();
  const [loadingBtnUrl, setLoadingBtnUrl] = useState<string | null>(null);

  const handleActionClick = (url: string) => {
    setLoadingBtnUrl(url);
    router.push(url);
  };

  const getStatusPillClasses = (color?: string) => {
    switch (color) {
      case 'yellow':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'blue':
        return 'bg-sky-50 text-sky-800 border-sky-300';
      case 'green':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'red':
        return 'bg-rose-50 text-rose-800 border-rose-300';
      case 'purple':
        return 'bg-purple-50 text-purple-800 border-purple-300';
      default:
        return 'bg-slate-50 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      {/* Card Header */}
      <div className="border-b border-slate-100 bg-slate-50/75 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#002D62] text-amber-400">
              <FileText className="h-4 w-4" />
            </div>
            <h4 className="font-semibold text-slate-900 text-sm">{card.title}</h4>
          </div>
          {card.statusBadge && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusPillClasses(
                card.statusBadge.color
              )}`}
            >
              {card.statusBadge.color === 'green' && <CheckCircle2 className="h-3 w-3" />}
              {card.statusBadge.color === 'yellow' && <Clock className="h-3 w-3" />}
              {card.statusBadge.color === 'blue' && <Clock className="h-3 w-3" />}
              {card.statusBadge.color === 'red' && <AlertTriangle className="h-3 w-3" />}
              {card.statusBadge.label}
            </span>
          )}
        </div>

        {/* 4-Step Stepper (if present) */}
        {card.stepperStage && (
          <div className="mt-3 pt-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1.5">
              <span>Stage {card.stepperStage.current} of {card.stepperStage.total}</span>
              <span className="font-semibold text-slate-700">{card.stepperStage.stageName}</span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: card.stepperStage.total }).map((_, idx) => {
                const stepNum = idx + 1;
                const isDone = stepNum < card.stepperStage!.current;
                const isCurrent = stepNum === card.stepperStage!.current;
                return (
                  <div
                    key={idx}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      isDone
                        ? 'bg-emerald-500'
                        : isCurrent
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-slate-200'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      {card.metrics && card.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50/30 sm:grid-cols-2">
          {card.metrics.map((m, i) => (
            <div key={i} className="rounded-lg border border-slate-100 bg-white p-2.5">
              <span className="block text-[11px] font-medium text-slate-500">{m.label}</span>
              <span className="block text-sm font-bold text-slate-800 mt-0.5">{m.value}</span>
              {m.subtext && <span className="block text-[10px] text-slate-400 mt-0.5">{m.subtext}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {card.actionButtons && card.actionButtons.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-white p-3">
          {card.actionButtons.map((btn, index) => (
            <Button
              key={index}
              size="sm"
              variant={btn.variant === 'secondary' ? 'outline' : 'primary'}
              isLoading={loadingBtnUrl === btn.actionUrl}
              onClick={() => handleActionClick(btn.actionUrl)}
              className="text-xs font-semibold"
              icon={btn.variant === 'secondary' ? <ChevronRight className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
            >
              {btn.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
