'use client';

import React from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  FileCheck2,
  PackageCheck,
  Archive,
  AlertCircle,
} from 'lucide-react';

export type FileRequisitionStatus =
  | 'SUBMITTED'
  | 'ACKNOWLEDGED_PENDING_REGISTRAR'
  | 'REJECTED_BY_REGISTRY'
  | 'AUTHORIZED_BY_REGISTRAR'
  | 'DECLINED_BY_REGISTRAR'
  | 'DISPATCHED_RELEASED'
  | 'RETURNED_ARCHIVED';

interface RequisitionStatusStepperProps {
  status: FileRequisitionStatus;
  acknowledgedAt?: string | null;
  authorizedAt?: string | null;
  dispatchedAt?: string | null;
  returnedAt?: string | null;
  folioNumber?: string | null;
  dispatchReceiptNumber?: string | null;
  urgency?: string;
  format?: string;
}

export const RequisitionStatusStepper: React.FC<RequisitionStatusStepperProps> = ({
  status,
  acknowledgedAt,
  authorizedAt,
  dispatchedAt,
  returnedAt,
  folioNumber,
  dispatchReceiptNumber,
  urgency,
  format,
}) => {
  const isRejectedRegistry = status === 'REJECTED_BY_REGISTRY';
  const isDeclinedRegistrar = status === 'DECLINED_BY_REGISTRAR';

  const steps = [
    {
      id: 1,
      name: 'Requisition Lodged',
      desc: 'Ticket Generated',
      isCompleted: true,
      isCurrent: status === 'SUBMITTED',
      isError: false,
    },
    {
      id: 2,
      name: 'Registry Intake',
      desc: isRejectedRegistry ? 'Intake Rejected' : folioNumber ? `Folio: ${folioNumber}` : 'Vault Inspection',
      isCompleted: [
        'ACKNOWLEDGED_PENDING_REGISTRAR',
        'AUTHORIZED_BY_REGISTRAR',
        'DECLINED_BY_REGISTRAR',
        'DISPATCHED_RELEASED',
        'RETURNED_ARCHIVED',
      ].includes(status),
      isCurrent: status === 'ACKNOWLEDGED_PENDING_REGISTRAR',
      isError: isRejectedRegistry,
    },
    {
      id: 3,
      name: 'Registrar Authorization',
      desc: isDeclinedRegistrar
        ? 'Executive Clearance Declined'
        : [
            'AUTHORIZED_BY_REGISTRAR',
            'DISPATCHED_RELEASED',
            'RETURNED_ARCHIVED',
          ].includes(status)
        ? 'Executive Clearance Granted'
        : 'Pending Determination',
      isCompleted: [
        'AUTHORIZED_BY_REGISTRAR',
        'DISPATCHED_RELEASED',
        'RETURNED_ARCHIVED',
      ].includes(status),
      isCurrent: status === 'AUTHORIZED_BY_REGISTRAR',
      isError: isDeclinedRegistrar,
    },
    {
      id: 4,
      name: 'Custody Handover',
      desc: dispatchReceiptNumber
        ? `Receipt: ${dispatchReceiptNumber}`
        : ['DISPATCHED_RELEASED', 'RETURNED_ARCHIVED'].includes(status)
        ? 'Released / Dispatched'
        : 'Vault Handover Desk',
      isCompleted: ['DISPATCHED_RELEASED', 'RETURNED_ARCHIVED'].includes(status),
      isCurrent: status === 'DISPATCHED_RELEASED',
      isError: false,
    },
    {
      id: 5,
      name: 'Vault Archiving',
      desc: status === 'RETURNED_ARCHIVED' ? 'Archived & Closed' : 'Return Tracking',
      isCompleted: status === 'RETURNED_ARCHIVED',
      isCurrent: false,
      isError: false,
    },
  ];

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        {/* Connector Line behind steps */}
        <div className="absolute left-6 right-6 top-5 -translate-y-1/2 h-0.5 bg-slate-200 -z-0" />
        <div
          className={`absolute left-6 top-5 -translate-y-1/2 h-0.5 -z-0 transition-all duration-500 ${
            isRejectedRegistry || isDeclinedRegistrar ? 'bg-red-500' : 'bg-emerald-600'
          }`}
          style={{
            width: isRejectedRegistry
              ? '25%'
              : isDeclinedRegistrar
              ? '50%'
              : status === 'SUBMITTED'
              ? '10%'
              : status === 'ACKNOWLEDGED_PENDING_REGISTRAR'
              ? '30%'
              : status === 'AUTHORIZED_BY_REGISTRAR'
              ? '60%'
              : status === 'DISPATCHED_RELEASED'
              ? '85%'
              : '100%',
          }}
        />

        {steps.map((step) => {
          let icon = <Clock className="w-4 h-4 text-slate-400" />;
          let circleBg = 'bg-slate-100 text-slate-500 border-slate-300';

          if (step.isError) {
            icon = <XCircle className="w-5 h-5 text-white" />;
            circleBg = 'bg-rose-600 text-white border-rose-600 ring-4 ring-rose-100';
          } else if (step.isCompleted) {
            icon = <CheckCircle2 className="w-5 h-5 text-white" />;
            circleBg = 'bg-emerald-600 text-white border-emerald-600 ring-4 ring-emerald-50';
          } else if (step.isCurrent) {
            icon = <Clock className="w-4 h-4 text-emerald-700 animate-pulse" />;
            circleBg = 'bg-emerald-100 text-emerald-800 border-emerald-500 ring-4 ring-emerald-100';
          }

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center group">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all shadow-xs ${circleBg}`}
              >
                {icon}
              </div>
              <div className="text-center mt-2 max-w-[110px]">
                <p
                  className={`text-xs font-bold leading-tight ${
                    step.isError
                      ? 'text-rose-700'
                      : step.isCompleted
                      ? 'text-emerald-900 font-extrabold'
                      : step.isCurrent
                      ? 'text-emerald-700 font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  {step.name}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate" title={step.desc}>
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
