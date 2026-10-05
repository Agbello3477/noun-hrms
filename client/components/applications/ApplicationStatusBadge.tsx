'use client';

import React from 'react';

export type ApplicationStatus =
  | 'SUBMITTED_TO_DIRECTOR'
  | 'RETURNED_FOR_REWRITE'
  | 'REJECTED_BY_DIRECTOR'
  | 'RECOMMENDED_TO_REGISTRY'
  | 'DOCKETED_PENDING_REGISTRAR'
  | 'APPROVED_BY_REGISTRAR'
  | 'DECLINED_BY_REGISTRAR';

interface Props {
  status: ApplicationStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  SUBMITTED_TO_DIRECTOR: {
    label: 'Submitted to Director',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200'
  },
  RETURNED_FOR_REWRITE: {
    label: 'Returned for Rewrite',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-300'
  },
  REJECTED_BY_DIRECTOR: {
    label: 'Rejected by Director',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200'
  },
  RECOMMENDED_TO_REGISTRY: {
    label: 'Recommended to Registry',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200'
  },
  DOCKETED_PENDING_REGISTRAR: {
    label: 'Docketed (Awaiting Registrar)',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200'
  },
  APPROVED_BY_REGISTRAR: {
    label: 'Officially Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200'
  },
  DECLINED_BY_REGISTRAR: {
    label: 'Declined by Registrar',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200'
  }
};

export default function ApplicationStatusBadge({ status, size = 'sm' }: Props) {
  const safeStatus = status || 'UNKNOWN';
  const config = STATUS_CONFIG[safeStatus] || {
    label: safeStatus.replace(/_/g, ' '),
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200'
  };

  const sizeClass = {
    sm: 'text-xs px-2.5 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-3.5 py-1.5'
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium border rounded-full ${config.bg} ${config.text} ${config.border} ${sizeClass}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70" />
      {config.label}
    </span>
  );
}
