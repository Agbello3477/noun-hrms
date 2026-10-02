'use client';

import React from 'react';
import ApplicationStatusBadge from './ApplicationStatusBadge';
import ApplicationProgressStepper from './ApplicationProgressStepper';

interface Revision {
  id: string;
  stage: string;
  action: string;
  comments?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    email: string;
    staffProfile?: {
      firstName: string;
      lastName: string;
    } | null;
  } | null;
}

interface ApplicationData {
  id: string;
  referenceNumber: string;
  registryDocketNumber?: string | null;
  subject: string;
  category: string;
  content: string;
  attachmentUrls: string[];
  status: string;
  currentHolderRole: string;
  createdAt: string;
  directorRemarks?: string | null;
  directorRecommendedAt?: string | null;
  registryAcknowledgedAt?: string | null;
  registrarRemarks?: string | null;
  registrarDecidedAt?: string | null;
  applicant?: {
    id: string;
    email: string;
    staffProfile?: {
      firstName: string;
      lastName: string;
      staffNumber?: string;
      department?: { name: string } | null;
      unit?: { name: string } | null;
      directorate?: { name: string } | null;
    } | null;
  };
  director?: {
    id: string;
    email: string;
    staffProfile?: {
      firstName: string;
      lastName: string;
    } | null;
  };
  registrar?: {
    id: string;
    email: string;
    staffProfile?: {
      firstName: string;
      lastName: string;
    } | null;
  } | null;
  registryClerk?: {
    id: string;
    email: string;
    staffProfile?: {
      firstName: string;
      lastName: string;
    } | null;
  } | null;
  revisionHistory?: Revision[];
  archive?: {
    archivedDocketNumber: string;
    finalStatus: string;
    archivedAt: string;
  } | null;
}

interface Props {
  application: ApplicationData | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ApplicationDetailsModal({ application, isOpen, onClose }: Props) {
  if (!isOpen || !application) return null;

  const applicantName = application.applicant?.staffProfile
    ? `${application.applicant.staffProfile.firstName} ${application.applicant.staffProfile.lastName}`
    : application.applicant?.email || 'N/A';

  const directorName = application.director?.staffProfile
    ? `${application.director.staffProfile.firstName} ${application.director.staffProfile.lastName}`
    : application.director?.email || 'N/A';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-slate-50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {application.referenceNumber}
              </span>
              {application.registryDocketNumber && (
                <span className="font-mono text-sm font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  Folio: {application.registryDocketNumber}
                </span>
              )}
              <ApplicationStatusBadge status={application.status} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-1">{application.subject}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1 hover:bg-gray-200"
            aria-label="Close dialog"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-6 flex-1">
          {/* Progress Tracker */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Institutional Statutory Progress
            </h3>
            <ApplicationProgressStepper status={application.status} />
          </div>

          {/* Dossier Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white border border-gray-200 rounded-lg p-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase">Applicant</p>
              <p className="font-semibold text-gray-900">{applicantName}</p>
              <p className="text-xs text-gray-500">
                {application.applicant?.staffProfile?.staffNumber || 'Staff ID: N/A'}
              </p>
              <p className="text-xs text-gray-500">
                {application.applicant?.staffProfile?.department?.name || 'Department: N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Target Directorate / Unit</p>
              <p className="font-semibold text-gray-900">{directorName}</p>
              <p className="text-xs text-gray-500">Routing: &ldquo;Through Director&rdquo;</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Category & Date</p>
              <p className="font-semibold text-gray-900">{application.category.replace(/_/g, ' ')}</p>
              <p className="text-xs text-gray-500">
                Submitted: {new Date(application.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Body Content */}
          <div className="border border-gray-200 rounded-lg p-5 bg-white">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Application Content & Justification
            </h3>
            <div className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed font-sans bg-slate-50/50 p-4 rounded border border-slate-100">
              {application.content}
            </div>

            {/* Attachments */}
            {application.attachmentUrls && application.attachmentUrls.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Supporting Documents</h4>
                <div className="flex flex-wrap gap-2">
                  {application.attachmentUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded border border-blue-200 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                      </svg>
                      Attachment #{i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Statutory Minutes & Endorsements */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Statutory Endorsements & Minutes
            </h3>

            {/* Director Remarks */}
            {application.directorRemarks && (
              <div className="border-l-4 border-amber-500 bg-amber-50/60 p-4 rounded-r-lg">
                <div className="flex items-center justify-between text-xs text-amber-900 font-semibold mb-1">
                  <span>Director&apos;s Minute ({directorName})</span>
                  <span>{application.directorRecommendedAt ? new Date(application.directorRecommendedAt).toLocaleString() : ''}</span>
                </div>
                <p className="text-sm text-gray-800 italic">{`"${application.directorRemarks}"`}</p>
              </div>
            )}

            {/* Registry Folio */}
            {application.registryDocketNumber && (
              <div className="border-l-4 border-purple-500 bg-purple-50/60 p-4 rounded-r-lg">
                <div className="flex items-center justify-between text-xs text-purple-900 font-semibold mb-1">
                  <span>Registry Inward Desk Acknowledgment (Folio: {application.registryDocketNumber})</span>
                  <span>{application.registryAcknowledgedAt ? new Date(application.registryAcknowledgedAt).toLocaleString() : ''}</span>
                </div>
                <p className="text-xs text-purple-800">
                  Formally docketed and forwarded to the Executive Registry Cockpit for the University Registrar&apos;s consideration.
                </p>
              </div>
            )}

            {/* Registrar Remarks */}
            {application.registrarRemarks && (
              <div className={`border-l-4 p-4 rounded-r-lg ${application.status === 'APPROVED_BY_REGISTRAR' ? 'border-emerald-600 bg-emerald-50/60' : 'border-rose-600 bg-rose-50/60'}`}>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className={application.status === 'APPROVED_BY_REGISTRAR' ? 'text-emerald-900' : 'text-rose-900'}>
                    Office of the University Registrar - Executive Determination
                  </span>
                  <span className="text-gray-500 font-normal">
                    {application.registrarDecidedAt ? new Date(application.registrarDecidedAt).toLocaleString() : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-800 italic font-medium">{`"${application.registrarRemarks}"`}</p>
              </div>
            )}
          </div>

          {/* Revision Audit Trail */}
          {application.revisionHistory && application.revisionHistory.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4 bg-slate-50">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Full Immutable Audit History ({application.revisionHistory.length} events)
              </h3>
              <div className="space-y-3">
                {application.revisionHistory.map((rev) => (
                  <div key={rev.id} className="text-xs bg-white p-3 rounded border border-gray-200 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-gray-600">
                      <span className="font-semibold text-gray-800">
                        {rev.action} ({rev.stage})
                      </span>
                      <span>{new Date(rev.createdAt).toLocaleString()}</span>
                    </div>
                    {rev.comments && <p className="text-gray-700 italic">{`"${rev.comments}"`}</p>}
                    <p className="text-[11px] text-gray-400">
                      Actor: {rev.actor?.staffProfile ? `${rev.actor.staffProfile.firstName} ${rev.actor.staffProfile.lastName}` : rev.actor?.email || 'System'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
}
