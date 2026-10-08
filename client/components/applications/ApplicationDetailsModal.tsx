'use client';

import React, { useState } from 'react';
import ApplicationStatusBadge from './ApplicationStatusBadge';
import ApplicationProgressStepper from './ApplicationProgressStepper';
import TransferHistoryTab from '@/components/hr/dossier/TransferHistoryTab';
import DigitalDossier from '@/components/dashboard/DigitalDossier';
import { FileText, History, FileCheck } from 'lucide-react';

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
  attachmentUrls?: string[];
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachments?: any[];
  documents?: any[];
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
    name?: string;
    email: string;
    staffProfile?: {
      id?: string;
      title?: string;
      surname?: string;
      otherNames?: string;
      firstName?: string;
      lastName?: string;
      staffId?: string;
      staffNumber?: string;
      rank?: string;
      department?: any;
      unit?: { id?: string; name?: string } | null;
      studyCenter?: { id?: string; name?: string } | null;
      directorate?: { name: string } | null;
    } | null;
  };
  director?: {
    id: string;
    name?: string;
    email: string;
    staffProfile?: {
      id?: string;
      title?: string;
      surname?: string;
      otherNames?: string;
      firstName?: string;
      lastName?: string;
      rank?: string;
      unit?: { id?: string; name?: string } | null;
    } | null;
  };
  registrar?: {
    id: string;
    name?: string;
    email: string;
    staffProfile?: {
      id?: string;
      title?: string;
      surname?: string;
      otherNames?: string;
      firstName?: string;
      lastName?: string;
    } | null;
  } | null;
  registryClerk?: {
    id: string;
    name?: string;
    email: string;
    staffProfile?: {
      id?: string;
      title?: string;
      surname?: string;
      otherNames?: string;
      firstName?: string;
      lastName?: string;
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
  const [activeModalTab, setActiveModalTab] = useState<'APPLICATION' | 'TRANSFERS' | 'DOSSIER'>('APPLICATION');

  if (!isOpen || !application) return null;

  const applicant = application.applicant?.staffProfile;
  const applicantName = applicant?.title
    ? `${applicant.title} ${applicant.surname || ''} ${applicant.otherNames || ''}`.trim()
    : applicant?.surname
    ? `${applicant.surname} ${applicant.otherNames || ''}`.trim()
    : applicant?.firstName
    ? `${applicant.firstName} ${applicant.lastName || ''}`.trim()
    : application.applicant?.name || application.applicant?.email || 'Staff Member';

  const director = application.director?.staffProfile;
  const directorName = director?.title
    ? `${director.title} ${director.surname || ''} ${director.otherNames || ''}`.trim()
    : director?.surname
    ? `${director.surname} ${director.otherNames || ''}`.trim()
    : director?.firstName
    ? `${director.firstName} ${director.lastName || ''}`.trim()
    : application.director?.name || application.director?.email || 'Director';

  const staffId = applicant?.staffId || applicant?.staffNumber || 'N/A';
  const unitOrDept = applicant?.unit?.name || (typeof applicant?.department === 'string' ? applicant.department : applicant?.department?.name) || 'Registry Division';

  const applicantUserId = application.applicant?.id || '';
  const applicantProfileId = applicant?.id || '';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-slate-50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {application.referenceNumber || 'N/A'}
              </span>
              {application.registryDocketNumber && (
                <span className="font-mono text-sm font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  Folio: {application.registryDocketNumber}
                </span>
              )}
              <ApplicationStatusBadge status={application.status || 'APPROVED_BY_REGISTRAR'} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-1">{application.subject || 'Institutional Application'}</h2>
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

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-slate-100/70 px-6 pt-2 gap-2">
          <button
            onClick={() => setActiveModalTab('APPLICATION')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeModalTab === 'APPLICATION'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <FileText size={14} />
            <span>Application &amp; Justification</span>
          </button>
          <button
            onClick={() => setActiveModalTab('TRANSFERS')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeModalTab === 'TRANSFERS'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <History size={14} />
            <span>Posting &amp; Transfer History</span>
          </button>
          <button
            onClick={() => setActiveModalTab('DOSSIER')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeModalTab === 'DOSSIER'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <FileCheck size={14} />
            <span>Digital Dossier &amp; Credentials</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-6 flex-1">
          {activeModalTab === 'TRANSFERS' ? (
            <div className="animate-in fade-in duration-300">
              <TransferHistoryTab staffId={applicantUserId || applicantProfileId || staffId} />
            </div>
          ) : activeModalTab === 'DOSSIER' ? (
            <div className="animate-in fade-in duration-300">
              <DigitalDossier
                staffId={applicantProfileId || applicantUserId || staffId}
                staffName={applicantName}
                readOnly={true}
              />
            </div>
          ) : (
            <>
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
              <p className="text-xs text-gray-500 font-mono">
                Staff ID: {staffId}
              </p>
              <p className="text-xs text-gray-500">
                Unit/Dept: {unitOrDept}
              </p>
              {applicant?.rank && (
                <p className="text-xs text-gray-500">
                  Rank: {applicant.rank}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Target Directorate / Unit</p>
              <p className="font-semibold text-gray-900">{directorName}</p>
              <p className="text-xs text-gray-500">Routing: &ldquo;Through Director&rdquo;</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Category & Date</p>
              <p className="font-semibold text-gray-900">{(application.category || 'INSTITUTIONAL_APPLICATION').replace(/_/g, ' ')}</p>
              <p className="text-xs text-gray-500">
                Submitted: {application.createdAt ? new Date(application.createdAt).toLocaleDateString() : 'N/A'}
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
            {(() => {
              const resolveFileUrl = (url: string) => {
                if (!url) return '';
                if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
                  return url;
                }
                const backendBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://noun-hrms.onrender.com';
                const cleanBase = backendBase.replace(/\/$/, '');
                const cleanPath = url.startsWith('/') ? url : `/${url}`;
                return `${cleanBase}${cleanPath}`;
              };

              const allAttachments: { name: string; url: string; isExternal: boolean }[] = [];

              if (Array.isArray(application.attachmentUrls)) {
                application.attachmentUrls.forEach((url, i) => {
                  if (typeof url === 'string' && url.trim()) {
                    const cleanUrl = url.trim();
                    const rawName = cleanUrl.split('/').pop()?.split('?')[0] || `Attachment #${i + 1}`;
                    const displayName = decodeURIComponent(rawName.replace(/^\d+-/, ''));
                    allAttachments.push({
                      name: displayName || `Attachment #${i + 1}`,
                      url: resolveFileUrl(cleanUrl),
                      isExternal: cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')
                    });
                  }
                });
              }

              if (application.attachmentUrl && !allAttachments.some(a => a.url === resolveFileUrl(application.attachmentUrl!))) {
                const rawName = application.attachmentName || application.attachmentUrl.split('/').pop()?.split('?')[0] || 'Attachment';
                allAttachments.push({
                  name: decodeURIComponent(rawName.replace(/^\d+-/, '')),
                  url: resolveFileUrl(application.attachmentUrl),
                  isExternal: application.attachmentUrl.startsWith('http://') || application.attachmentUrl.startsWith('https://')
                });
              }

              if (allAttachments.length === 0) return null;

              return (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      Attached Supporting Documents ({allAttachments.length})
                    </h4>
                    <span className="text-[10px] text-gray-400 font-medium">Click to open/download in new tab</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {allAttachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50/80 hover:bg-emerald-50/40 transition-all shadow-xs"
                      >
                        <div className="flex items-center gap-2.5 truncate max-w-[80%]">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-950 truncate">
                              {att.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              Attachment #{i + 1}
                            </p>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white px-2 py-1 rounded-md border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all shrink-0">
                          <span>View</span>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
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
          </>
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
