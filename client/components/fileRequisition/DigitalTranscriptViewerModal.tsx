'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { logDossierSecurityAction } from '@/lib/dossierAudit';
import {
  X,
  Shield,
  Clock,
  User,
  Building,
  GraduationCap,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Lock,
  Loader2,
  FileText,
  Printer,
  Download,
} from 'lucide-react';

interface DigitalTranscriptViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  requisitionId: string;
  token?: string | null;
}

export const DigitalTranscriptViewerModal: React.FC<DigitalTranscriptViewerModalProps> = ({
  isOpen,
  onClose,
  requisitionId,
  token,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !requisitionId) return;

    let isMounted = true;
    setLoading(true);
    setErrorMsg('');

    const fetchTranscript = async () => {
      try {
        const query = token ? `?token=${encodeURIComponent(token)}` : '';
        const res = await api.get(`/api/v1/registry/file-requests/${requisitionId}/digital-view${query}`);
        if (isMounted) {
          if (res.data?.success) {
            setData(res.data.data);
          } else {
            setErrorMsg(res.data?.error || 'Failed to retrieve digital dossier transcript.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(
            err.response?.data?.error ||
              'Access Denied: Digital access token is missing, expired, or invalid. Personnel dossiers are confidential.'
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTranscript();
    return () => {
      isMounted = false;
    };
  }, [isOpen, requisitionId, token]);

  if (!isOpen) return null;

  const profile = data?.profile;

  const handlePrintTranscript = () => {
    window.print();
    logDossierSecurityAction({
      action: 'DOSSIER_PRINTED',
      documentTitle: 'Official Digital Personnel Dossier Transcript',
      staffName: profile?.name,
      staffId: profile?.staffId,
      requisitionId,
      fileNumber: data?.requisitionNumber,
    });
  };

  const handleDownloadTranscript = () => {
    if (!profile) return;
    const textData = `NATIONAL OPEN UNIVERSITY OF NIGERIA
CONFIDENTIAL DIGITAL PERSONNEL DOSSIER TRANSCRIPT
Requisition Docket: ${data?.requisitionNumber || 'N/A'}
Dispatch Receipt: ${data?.dispatchReceiptNumber || 'N/A'}
Date of Retrieval: ${new Date().toLocaleString()}

SUBJECT STAFF PROFILE:
Name: ${profile.name}
Staff ID: ${profile.staffId}
Rank: ${profile.rank}
Department: ${profile.department || 'N/A'}
Unit: ${profile.unit || 'N/A'}
Cadre: ${profile.cadre || 'N/A'}
Category: ${profile.employmentCategory || 'PERMANENT'}
Highest Qualification: ${profile.highestQualification || 'N/A'}
Date of 1st Appointment: ${profile.dateOfFirstAppointment ? new Date(profile.dateOfFirstAppointment).toLocaleDateString('en-GB') : 'N/A'}
Last Promotion Milestone: ${profile.lastPromotionDate ? new Date(profile.lastPromotionDate).toLocaleDateString('en-GB') : 'N/A'}
Statutory Retirement Due: ${profile.statutoryRetirementDate ? new Date(profile.statutoryRetirementDate).toLocaleDateString('en-GB') : 'N/A'}
`;
    const blob = new Blob([textData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(profile.name || 'Staff').replace(/[^a-z0-9]/gi, '_')}_Digital_Transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logDossierSecurityAction({
      action: 'DOSSIER_DOWNLOADED',
      documentTitle: 'Digital Personnel Dossier Transcript Export',
      staffName: profile?.name,
      staffId: profile?.staffId,
      requisitionId,
      fileNumber: data?.requisitionNumber,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="viewer-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Warning Banner: Digital Single-Session Security */}
        <div className="flex items-center justify-between bg-amber-500 px-6 py-2.5 text-slate-950 text-xs font-bold">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 flex-shrink-0" />
            <span>CONFIDENTIAL PERSONNEL DOSSIER • TIME-LIMITED DIGITAL ACCESS</span>
          </div>
          {data?.tokenExpiresAt && (
            <div className="flex items-center gap-1.5 font-mono text-[11px] bg-amber-400/80 px-2 py-0.5 rounded-sm">
              <Clock className="w-3.5 h-3.5" />
              <span>Expires: {new Date(data.tokenExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 id="viewer-title" className="text-sm font-bold leading-tight">
                Digital Personnel Dossier Transcript
              </h2>
              <p className="text-xs text-slate-400">
                Requisition: <span className="font-mono text-emerald-300">{data?.requisitionNumber || 'N/A'}</span> • Dispatch Receipt: <span className="font-mono text-emerald-300">{data?.dispatchReceiptNumber || 'N/A'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4 text-slate-400" /> Close
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-medium">Decrypting and validating dossier access token...</p>
            </div>
          ) : errorMsg ? (
            <div className="rounded-xl bg-rose-50 p-6 text-center space-y-3 border border-rose-200">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <h3 className="text-sm font-bold text-rose-900">Access Denied</h3>
              <p className="text-xs text-rose-700 max-w-md mx-auto">{errorMsg}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 inline-flex items-center rounded-lg bg-rose-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
              >
                Close Viewer
              </button>
            </div>
          ) : profile ? (
            <div className="space-y-6">
              {/* Profile Bio Header Strip */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-full bg-emerald-800 text-white flex items-center justify-center font-extrabold text-base shadow-xs">
                    {profile.name?.slice(0, 2).toUpperCase() || 'ST'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{profile.name}</h3>
                    <p className="text-xs text-slate-500">
                      Staff ID: <span className="font-mono font-bold text-emerald-800">{profile.staffId}</span> • {profile.rank}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Registry Authenticated
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">Single-session read-only ledger</p>
                </div>
              </div>

              {/* Departmental & Cadre Scope */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Department & Unit</span>
                  <p className="font-bold text-slate-800">{profile.department || 'Registry'}</p>
                  <p className="text-[11px] text-slate-500">{profile.unit || 'Headquarters'}</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Cadre & Category</span>
                  <p className="font-bold text-slate-800">{profile.cadre || 'ACADEMIC'}</p>
                  <p className="text-[11px] text-slate-500">{profile.employmentCategory || 'PERMANENT'}</p>
                </div>
              </div>

              {/* Key Statutory Milestones */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" /> Statutory Milestone Records
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block">Date of 1st Appointment</span>
                    <span className="font-semibold text-slate-800">
                      {profile.dateOfFirstAppointment
                        ? new Date(profile.dateOfFirstAppointment).toLocaleDateString('en-GB')
                        : 'Verified on Folio'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block">Last Promotion Milestone</span>
                    <span className="font-semibold text-slate-800">
                      {profile.lastPromotionDate
                        ? new Date(profile.lastPromotionDate).toLocaleDateString('en-GB')
                        : 'Verified on Folio'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block">Statutory Retirement Due</span>
                    <span className="font-semibold text-slate-800">
                      {profile.statutoryRetirementDate
                        ? new Date(profile.statutoryRetirementDate).toLocaleDateString('en-GB')
                        : 'Age 65 / 35 Yrs Service'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Postings History */}
              {profile.recentPostings && profile.recentPostings.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Building className="w-3.5 h-3.5 text-emerald-700" /> Recent Station Postings & Transfers
                  </h4>
                  <div className="space-y-1.5 pt-1">
                    {profile.recentPostings.map((p: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100"
                      >
                        <span className="font-medium text-slate-800">{p.reason || 'Institutional Posting'}</span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {p.effectiveDate ? new Date(p.effectiveDate).toLocaleDateString('en-GB') : 'Verified'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintTranscript}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" /> Print Dossier
            </button>
            <button
              type="button"
              onClick={handleDownloadTranscript}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export Transcript
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
          >
            <X className="w-4 h-4 text-slate-500" /> Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
