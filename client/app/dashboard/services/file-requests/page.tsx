'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  FolderOpen,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  FileCheck2,
  ShieldCheck,
  ExternalLink,
  Printer,
  History,
  RotateCcw,
  X,
} from 'lucide-react';
import { RequisitionStatusStepper, FileRequisitionStatus } from '@/components/fileRequisition/RequisitionStatusStepper';
import { LodgeRequisitionModal } from '@/components/fileRequisition/LodgeRequisitionModal';
import { CustodyReleaseReceiptModal } from '@/components/fileRequisition/CustodyReleaseReceiptModal';
import { DigitalTranscriptViewerModal } from '@/components/fileRequisition/DigitalTranscriptViewerModal';
import { useAuth } from '@/hooks/useAuth';

export default function MyFileRequisitionsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [selectedReq, setSelectedReq] = useState<any | null>(null);

  // Modals
  const [isLodgeOpen, setIsLodgeOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isDigitalViewerOpen, setIsDigitalViewerOpen] = useState(false);

  // Return File Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnReq, setReturnReq] = useState<any | null>(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState('');

  const fetchMyRequisitions = async () => {
    if (user?.role === 'STAFF') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/api/v1/registry/file-requests/my');
      if (res.data?.success) {
        setRequisitions(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch personal file requisitions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReturn = (req: any) => {
    setReturnReq(req);
    setReturnNotes('');
    setReturnError('');
    setIsReturnModalOpen(true);
  };

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnReq) return;
    setIsSubmittingReturn(true);
    setReturnError('');
    try {
      const res = await api.post(`/api/v1/registry/file-requests/${returnReq.id}/return`, {
        returnNotes: returnNotes.trim() || undefined,
      });
      if (res.data?.success) {
        setIsReturnModalOpen(false);
        setReturnReq(null);
        await fetchMyRequisitions();
        alert('Personnel file successfully marked as returned to Registry Vault.');
      } else {
        setReturnError(res.data?.message || res.data?.error || 'Failed to process file return.');
      }
    } catch (err: any) {
      setReturnError(err.response?.data?.message || err.response?.data?.error || 'Failed to process file return.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  useEffect(() => {
    fetchMyRequisitions();
  }, [user]);

  if (user && user.role === 'STAFF') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Restricted Statutory Access</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Personnel File Requisitions are restricted to Unit Heads, Deans, Directors, Study Centre Managers, and Registry Vault Officers. Regular staff are not authorized to requisition confidential personnel files.
          </p>
          <div className="pt-2">
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-[#006533] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
            <FolderOpen className="w-4 h-4" />
            <span>Staff Self Service • Registry Vault Gatepass & Custody</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            My Personnel File Requisitions
          </h1>
          <p className="text-xs text-slate-500">
            Lodge official file requests, monitor Registry Vault folio intake, track Registrar executive authorization, and retrieve custody release gatepasses.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchMyRequisitions}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setIsLodgeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Lodge Personnel File Request
          </button>
        </div>
      </div>

      {/* Main Requisition List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="w-7 h-7 animate-spin mx-auto text-emerald-600 mb-2" />
            <p className="text-xs font-medium">Loading your file requisitions from the Registry Vault...</p>
          </div>
        ) : requisitions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
            <FolderOpen className="w-10 h-10 text-emerald-700/50 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No File Requisitions Lodged Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              If your department or unit requires official physical or digital personnel records (for Accreditation, APER, or Promotions), click below to lodge a requisition.
            </p>
            <button
              type="button"
              onClick={() => setIsLodgeOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors mt-2"
            >
              <Plus className="w-4 h-4" /> Lodge File Requisition
            </button>
          </div>
        ) : (
          requisitions.map((req) => {
            const isAuthorized = req.status === 'AUTHORIZED_BY_REGISTRAR';
            const isReleased = req.status === 'DISPATCHED_RELEASED' || req.status === 'DISPATCHED_IN_CUSTODY';
            const isReturned = req.status === 'RETURNED_ARCHIVED';
            const hasDigitalFormat =
              req.requestedFileFormat === 'DIGITAL_TRANSCRIPT' || req.requestedFileFormat === 'BOTH';
            const canViewTranscript = (isAuthorized || isReleased) && hasDigitalFormat;
            const canViewGatepass = isAuthorized || isReleased || isReturned || Boolean(req.dispatchReceiptNumber);

            const canReturn = (isAuthorized || isReleased) && !isReturned;

            return (
              <div
                key={req.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Header Strip */}
                <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {req.requisitionNumber}
                    </span>
                    {req.registryFolioReference && (
                      <span className="font-mono text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
                        Vault Folio: {req.registryFolioReference}
                      </span>
                    )}
                    {req.dispatchReceiptNumber && (
                      <span className="font-mono text-xs font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-sm border border-indigo-200">
                        Receipt: {req.dispatchReceiptNumber}
                      </span>
                    )}
                    {isAuthorized && !isReleased && !isReturned && (
                      <span className="inline-flex items-center gap-1 font-sans text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Authorized for Release
                      </span>
                    )}
                    {isReleased && !isReturned && (
                      <span className="inline-flex items-center gap-1 font-sans text-xs font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-300">
                        <Clock className="w-3.5 h-3.5 text-amber-700" /> Out in Custody
                      </span>
                    )}
                    {isReturned && (
                      <span className="inline-flex items-center gap-1 font-sans text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" /> Returned &amp; Archived
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Lodged On:{' '}
                    <span className="font-medium text-slate-700">
                      {new Date(req.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                  {/* Executive Clearance Callout */}
                  {isAuthorized && !isReturned && (
                    <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 p-3 text-xs text-emerald-900 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="flex-1">
                        <span className="font-bold text-emerald-950">Release Authorized by Registrar!</span> Your file requisition has received official clearance. When you are done with this file, remember to click <span className="font-bold">Return File</span> below to securely close the custody docket.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Subject Staff */}
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Subject Personnel Record
                      </span>
                      <p className="font-bold text-slate-900 text-sm">
                        {req.staffProfile?.user?.name || 'Staff Member'}
                      </p>
                      <p className="text-slate-600 font-mono text-[11px]">
                        Staff ID: {req.staffProfile?.staffId || 'N/A'}
                      </p>
                      <p className="text-slate-500 text-[11px]">{req.staffProfile?.rank || 'Staff'}</p>
                    </div>

                    {/* Request Details */}
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Requisition Parameters
                      </span>
                      <p className="font-semibold text-slate-800">
                        Format: <span className="font-bold text-slate-900">{req.requestedFileFormat}</span>
                      </p>
                      <p className="text-slate-600">
                        Urgency: <span className="font-bold text-emerald-800">{req.urgencyLevel}</span>
                      </p>
                      <p className="text-slate-500 text-[11px]">
                        Expected Return:{' '}
                        {req.expectedReturnDate
                          ? new Date(req.expectedReturnDate).toLocaleDateString('en-GB')
                          : '14 Days SLA'}
                      </p>
                    </div>

                    {/* Purpose */}
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Stated Purpose
                      </span>
                      <p className="text-slate-700 italic line-clamp-3 text-[11px]" title={req.purposeOfRequest}>
                        &ldquo;{req.purposeOfRequest}&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* 5-Step Progress Tracker */}
                  <RequisitionStatusStepper
                    status={req.status as FileRequisitionStatus}
                    folioNumber={req.registryFolioReference}
                    dispatchReceiptNumber={req.dispatchReceiptNumber}
                    urgency={req.urgencyLevel}
                    format={req.requestedFileFormat}
                  />

                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="text-[11px] text-slate-500">
                      Status:{' '}
                      <span className="font-bold text-emerald-800">{req.status.replace(/_/g, ' ')}</span>
                      {req.authorizedBy && (
                        <span> • Authorized by {req.authorizedBy.name}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {canReturn && (
                        <button
                          type="button"
                          onClick={() => handleOpenReturn(req)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors shadow-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Return File to Registry
                        </button>
                      )}

                      {canViewGatepass && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReq(req);
                            setIsReceiptOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-600" /> Custody Gatepass
                        </button>
                      )}

                      {canViewTranscript && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReq(req);
                            setIsDigitalViewerOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View Digital Transcript
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Lodge Requisition Modal */}
      <LodgeRequisitionModal
        isOpen={isLodgeOpen}
        onClose={() => setIsLodgeOpen(false)}
        onSuccess={() => {
          fetchMyRequisitions();
        }}
        defaultDepartment={user?.staffProfile?.department || ''}
      />

      {/* Custody Receipt Gatepass */}
      <CustodyReleaseReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        requisition={selectedReq}
        onViewDigital={() => {
          setIsReceiptOpen(false);
          setIsDigitalViewerOpen(true);
        }}
      />

      {/* Digital Transcript Viewer */}
      {selectedReq && (
        <DigitalTranscriptViewerModal
          isOpen={isDigitalViewerOpen}
          onClose={() => setIsDigitalViewerOpen(false)}
          requisitionId={selectedReq.id}
          token={selectedReq.digitalAccessToken}
        />
      )}

      {/* Return File Modal */}
      {isReturnModalOpen && returnReq && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center px-6 py-4 bg-amber-50 border-b border-amber-200">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
                <RotateCcw className="w-5 h-5 text-amber-700" />
                Return Personnel File to Registry Vault
              </div>
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReturn} className="p-6 space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Requisition Number:</span>
                  <span className="font-mono font-bold text-slate-800">{returnReq.requisitionNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Subject Staff:</span>
                  <span className="font-bold text-slate-800">{returnReq.staffProfile?.user?.name || 'Staff Member'}</span>
                </div>
                {returnReq.registryFolioReference && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Vault Folio Reference:</span>
                    <span className="font-mono font-bold text-emerald-800">{returnReq.registryFolioReference}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Return Notes &amp; Custody Handover Remarks (Optional)
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="e.g. File returned intact with all APER and promotion dossiers..."
                  rows={3}
                  className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden"
                />
              </div>

              {returnError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{returnError}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  disabled={isSubmittingReturn}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition"
                >
                  {isSubmittingReturn ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Logging Return...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Confirm File Return
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
