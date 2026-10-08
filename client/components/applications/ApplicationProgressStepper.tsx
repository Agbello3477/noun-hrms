'use client';

import React from 'react';
import { ApplicationStatus } from './ApplicationStatusBadge';

interface Props {
  status: ApplicationStatus | string;
}

const STAGES = [
  { id: 1, key: 'SUBMITTED', label: '1. Staff Submission', subtext: 'Dispatched to Director' },
  { id: 2, key: 'DIRECTOR', label: '2. Director Vetting', subtext: 'Endorsement / Rewrite' },
  { id: 3, key: 'REGISTRY', label: '3. Registry Inward Desk', subtext: 'Folio Docketing' },
  { id: 4, key: 'REGISTRAR', label: '4. University Registrar', subtext: 'Executive Determination' }
];

export default function ApplicationProgressStepper({ status }: Props) {
  // Determine active step index (0-based) and status condition
  let currentStep = 0;
  let isReturned = false;
  let isRejected = false;
  let isDeclined = false;

  switch (status) {
    case 'SUBMITTED_TO_DIRECTOR':
      currentStep = 1;
      break;
    case 'RETURNED_FOR_REWRITE':
      currentStep = 1;
      isReturned = true;
      break;
    case 'REJECTED_BY_DIRECTOR':
      currentStep = 1;
      isRejected = true;
      break;
    case 'RECOMMENDED_TO_REGISTRY':
      currentStep = 2;
      break;
    case 'DOCKETED_PENDING_REGISTRAR':
      currentStep = 3;
      break;
    case 'APPROVED_BY_REGISTRAR':
      currentStep = 4;
      break;
    case 'DECLINED_BY_REGISTRAR':
      currentStep = 4;
      isDeclined = true;
      break;
    default:
      currentStep = 0;
  }

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        {/* Background connector bar */}
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2 z-0" />
        
        {/* Active connector progress */}
        <div
          className={`absolute top-1/2 left-0 h-1 -translate-y-1/2 z-0 transition-all duration-300 ${
            isRejected || isDeclined
              ? 'bg-red-500'
              : isReturned
              ? 'bg-amber-500'
              : 'bg-emerald-600'
          }`}
          style={{
            width: `${Math.min(100, Math.max(0, ((Math.min(currentStep, 3)) / 3) * 100))}%`
          }}
        />

        {STAGES.map((stage, idx) => {
          const isPassed = currentStep > idx;
          const isCurrent = currentStep === idx;
          const isFinal = idx === 3 && currentStep === 4;

          let nodeBg = 'bg-gray-100 border-gray-300 text-gray-500';
          let textColor = 'text-gray-500';

          if (isPassed || isFinal) {
            if (stage.id === 2 && isRejected) {
              nodeBg = 'bg-red-600 border-red-600 text-white';
              textColor = 'text-red-700 font-semibold';
            } else if (stage.id === 2 && isReturned) {
              nodeBg = 'bg-amber-500 border-amber-500 text-white';
              textColor = 'text-amber-700 font-semibold';
            } else if (stage.id === 4 && isDeclined) {
              nodeBg = 'bg-rose-600 border-rose-600 text-white';
              textColor = 'text-rose-700 font-semibold';
            } else {
              nodeBg = 'bg-emerald-600 border-emerald-600 text-white';
              textColor = 'text-emerald-800 font-semibold';
            }
          } else if (isCurrent) {
            nodeBg = 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100';
            textColor = 'text-blue-700 font-bold';
          }

          return (
            <div key={stage.id} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-all ${nodeBg}`}
              >
                {isPassed || isFinal ? (
                  isRejected || isDeclined ? (
                    '✕'
                  ) : isReturned ? (
                    '↺'
                  ) : (
                    '✓'
                  )
                ) : (
                  stage.id
                )}
              </div>
              <div className="mt-2 text-center">
                <p className={`text-xs ${textColor}`}>{stage.label}</p>
                <p className="text-[10px] text-gray-400 hidden sm:block">{stage.subtext}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
