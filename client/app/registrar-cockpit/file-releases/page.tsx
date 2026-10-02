'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileCheck2,
  Loader2,
  RefreshCw,
  X,
  FileText,
  UserCheck,
  Building,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { RequisitionStatusStepper, FileRequisitionStatus } from '@/components/fileRequisition/RequisitionStatusStepper';
import { CustodyReleaseReceiptModal } from '@/components/fileRequisition/CustodyReleaseReceiptModal';

export default function RegistrarFileReleasesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dockets, setDockets] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocket, setSelectedDocket] = useState<any | null>(null);

  // Executive Decision Modal
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'DECLINE'>('APPROVE');
  const [executiveRemarks, setExecutiveRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState('');

  // Receipt Preview Modal
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const fetchDockets = async () => {
    setLoading(true);
    try {
      const query = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
      const res = await api.get(`/api/v1/registrar/file-requests/pending${query}`);
      if (res.data?.success) {
        setDockets(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending registrar file requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDockets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchDockets();
    }, 300);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const handleOpenDecision = (docket: any, action: 'APPROVE' | 'DECLINE') => {
    setSelectedDocket(docket);
    setDecisionAction(action);
    setExecutiveRemarks(
      action === 'APPROVE'
        ? 'Executive clearance granted pursuant to institutional custody regulations.'
        : ''
    );
    setDecisionError('');
    setIsDecisionModalOpen(true);
  };

  const submitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocket) return;

    setDecisionError('');
    if (decisionAction === 'DECLINE' && !executiveRemarks.trim()) {
      setDecisionError('Statutory executive remarks are mandatory when declining a personnel file release.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post(`/api/v1/registrar/file-requests/${selectedDocket.id}/authorize`, {
        action: decisionAction,
        registrarRemarks: executiveRemarks.trim(),
      });

      if (res.data?.success) {
        setIsDecisionModalOpen(false);
        fetchDockets();
      } else {
        setDecisionError(res.data?.error || 'Failed to submit executive decision.');
      }
    } catch (err: any) {
      setDecisionError(err.response?.data?.error || 'Server error during decision determination.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Principal Officer Cockpit • Executive Authority</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Personnel File Release Authorization Docket
          </h1>
          <p className="text-xs text-slate-500">
            Statutory dual-control vetting for the release of physical dossiers and digital transcripts from the Registry Vault.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchDockets}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Docket
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter docket by Staff ID, Name, Folio, or Department..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
        <span className="text-xs font-bold text-slate-500">
          Pending Determination: <span className="text-emerald-800 font-extrabold">{dockets.length}</span>
        </span>
      </div>

      {/* Dockets Listing */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="w-7 h-7 animate-spin mx-auto text-emerald-600 mb-2" />
            <p className="text-xs font-medium">Retrieving Registry Folio dockets awaiting authorization...</p>
          </div>
        ) : dockets.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <CheckCircle2 className="w-10 h-10 text-emerald-600/60 mx-auto mb-2" />
            <p className="font-bold text-slate-800 text-sm">All File Release Dockets Cleared</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              There are currently no personnel file requisitions awaiting Registrar executive determination.
            </p>
          </div>
        ) : (
          dockets.map((docket) => {
            // Maker-Checker Violations:
            // 1. Authorizer is requester
            const isRequester = docket.requesterId === user?.id;
            // 2. Authorizer is subject
            const isSubject = docket.staffProfile?.userId === user?.id;
            const hasMakerCheckerConflict = isRequester || isSubject;

            const isUrgent = ['URGENT', 'STATUTORY_AUDIT', 'LEGAL_SUBPOENA'].includes(docket.urgencyLevel);

            return (
              <div
                key={docket.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Docket Ribbon */}
                <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {docket.requisitionNumber}
                    </span>
                    <span className="font-mono text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
                      Folio: {docket.registryFolioReference || 'NOUN/FOLIO/VAULT'}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-extrabold uppercase ${
                        isUrgent
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {docket.urgencyLevel}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Acknowledged by Registry Vault:{' '}
                    <span className="font-medium text-slate-700">
                      {docket.acknowledgedBy?.name || 'Records Desk'}
                    </span>{' '}
                    ({new Date(docket.createdAt).toLocaleDateString('en-GB')})
                  </div>
                </div>

                {/* Docket Content Body */}
                <div className="p-5 space-y-4">
                  {/* Maker-Checker Conflict Banner */}
                  {hasMakerCheckerConflict && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200">
                      <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Statutory Maker-Checker Dual-Control Notice:</span>
                        <p className="mt-0.5 text-[11px] text-amber-800">
                          {isRequester
                            ? 'You cannot authorize this release because you lodged this file requisition. Institutional governance requires a neutral authorizer.'
                            : 'You cannot authorize this release because this confidential dossier concerns your own personnel record.'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Subject Personnel */}
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Subject Personnel Record
                      </span>
                      <p className="font-bold text-slate-900 text-sm">
                        {docket.staffProfile?.user?.name || 'Staff Member'}
                      </p>
                      <p className="text-slate-600">
                        Staff ID: <span className="font-mono font-medium">{docket.staffProfile?.staffId || 'N/A'}</span>
                      </p>
                      <p className="text-slate-500">{docket.staffProfile?.rank || 'Staff'}</p>
                    </div>

                    {/* Requesting Unit & Officer */}
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Requisitioning Entity
                      </span>
                      <p className="font-bold text-slate-900 text-sm">
                        {docket.requesterDepartment}
                      </p>
                      <p className="text-slate-600">Officer: {docket.requester?.name || 'Staff'}</p>
                      <p className="text-slate-500">Format: {docket.requestedFileFormat}</p>
                    </div>

                    {/* Purpose of Release */}
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Statutory Release Purpose
                      </span>
                      <p className="text-slate-700 italic line-clamp-3" title={docket.purposeOfRequest}>
                        &ldquo;{docket.purposeOfRequest}&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Stepper Progress Visualizer */}
                  <RequisitionStatusStepper
                    status={docket.status as FileRequisitionStatus}
                    folioNumber={docket.registryFolioReference}
                    urgency={docket.urgencyLevel}
                    format={docket.requestedFileFormat}
                  />

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDocket(docket);
                        setIsReceiptOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <FileCheck2 className="w-3.5 h-3.5 text-emerald-700" /> Inspect Vault Ticket
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={hasMakerCheckerConflict}
                        onClick={() => handleOpenDecision(docket, 'DECLINE')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Decline Release
                      </button>

                      <button
                        type="button"
                        disabled={hasMakerCheckerConflict}
                        onClick={() => handleOpenDecision(docket, 'APPROVE')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Grant Executive Clearance
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Executive Decision Modal */}
      {isDecisionModalOpen && selectedDocket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div
              className={`flex items-center justify-between px-6 py-4 text-white ${
                decisionAction === 'APPROVE' ? 'bg-emerald-900' : 'bg-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold">
                  {decisionAction === 'APPROVE'
                    ? 'Grant Executive Release Clearance'
                    : 'Decline Personnel File Release'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDecisionModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitDecision} className="p-6 space-y-4 text-xs">
              {decisionError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-rose-800 border border-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{decisionError}</span>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Dossier Under Review</span>
                <p className="font-bold text-slate-900">
                  {selectedDocket.staffProfile?.user?.name} ({selectedDocket.staffProfile?.staffId})
                </p>
                <p className="text-[11px] text-slate-500">
                  Requisition: <span className="font-mono">{selectedDocket.requisitionNumber}</span> • Folio:{' '}
                  <span className="font-mono">{selectedDocket.registryFolioReference}</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold uppercase tracking-wider text-slate-700">
                  Registrar Executive Determination Remarks{' '}
                  {decisionAction === 'DECLINE' ? (
                    <span className="text-rose-500">* (Mandatory)</span>
                  ) : (
                    <span className="text-slate-400">(Official Custody Log)</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  value={executiveRemarks}
                  onChange={(e) => setExecutiveRemarks(e.target.value)}
                  required={decisionAction === 'DECLINE'}
                  placeholder={
                    decisionAction === 'APPROVE'
                      ? 'Release authorized pursuant to institutional governance and custody protocols...'
                      : 'State statutory grounds for declining this file release request...'
                  }
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDecisionModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 font-bold text-white shadow-xs transition-all ${
                    decisionAction === 'APPROVE'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-rose-700 hover:bg-rose-800'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Recording Determination...
                    </>
                  ) : decisionAction === 'APPROVE' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Authorization
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> Confirm Decline
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Preview */}
      <CustodyReleaseReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        requisition={selectedDocket}
      />
    </div>
  );
}
