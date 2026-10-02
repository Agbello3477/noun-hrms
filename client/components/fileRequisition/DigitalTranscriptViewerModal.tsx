'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="viewer-title"
    >
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
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
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{profile.name}</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-sm">
                        {profile.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Staff ID: <span className="font-mono font-bold text-slate-800">{profile.staffId || 'N/A'}</span> • {profile.officialEmail}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Disciplinary Status</span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold ${
                      profile.disciplinaryClearance === 'CLEARED'
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {profile.disciplinaryClearance === 'CLEARED' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Institutionally Cleared
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" /> Active Disciplinary Hold
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Bio & Career Appointments */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Rank / Grade</span>
                  <p className="font-bold text-slate-800">{profile.rank || 'N/A'}</p>
                  <p className="text-[11px] text-slate-500">
                    {profile.level ? `${profile.level} (Step ${profile.step || '1'})` : 'CONTISS'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Department & Unit</span>
                  <p className="font-bold text-slate-800">{profile.department || 'N/A'}</p>
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
      </div>
    </div>
  );
};
