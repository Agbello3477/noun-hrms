'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import {
  FolderOpen,
  Eye,
  CheckCircle2,
  ArrowLeftRight,
  FileText,
  ChevronRight,
  X,
  ExternalLink,
  Printer,
  ShieldCheck,
  Plus,
  RotateCcw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import DigitalDossier from '../../../components/dashboard/DigitalDossier';
import { DigitalTranscriptViewerModal } from '@/components/fileRequisition/DigitalTranscriptViewerModal';
import { CustodyReleaseReceiptModal } from '@/components/fileRequisition/CustodyReleaseReceiptModal';

interface LegacyFileRequest {
  id: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  createdAt: string;
  requester: {
    name: string;
    staffProfile?: {
      unit?: { name: string };
      studyCenter?: { name: string };
    };
  };
  approvedBy?: { name: string };
  transferredBy?: { name: string };
  staff: {
    id: string;
    surname: string;
    otherNames: string;
    staffId: string;
  };
}

export default function ReceivedFilesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [legacyFiles, setLegacyFiles] = useState<LegacyFileRequest[]>([]);
  const [registryRequisitions, setRegistryRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals for legacy
  const [viewingLegacyRequest, setViewingLegacyRequest] = useState<LegacyFileRequest | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);

  // Modals for modern file requisitions
  const [selectedRegistryReq, setSelectedRegistryReq] = useState<any | null>(null);
  const [isDigitalViewerOpen, setIsDigitalViewerOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnReq, setReturnReq] = useState<any | null>(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState('');

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
        await fetchAllReceivedFiles();
        alert('Personnel file successfully returned to Registry Vault.');
      } else {
        setReturnError(res.data?.message || res.data?.error || 'Failed to process file return.');
      }
    } catch (err: any) {
      setReturnError(err.response?.data?.message || err.response?.data?.error || 'Failed to process file return.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const fetchAllReceivedFiles = async () => {
    try {
      setLoading(true);
      // 1. Fetch modern Registry Vault requisitions
      const [registryRes, legacyRes] = await Promise.allSettled([
        api.get('/api/v1/registry/file-requests/my'),
        api.get('/api/file-requests?type=received'),
      ]);

      if (registryRes.status === 'fulfilled' && registryRes.value.data?.success) {
        const allMy = registryRes.value.data.data || [];
        // Filter those that are authorized by Registrar or dispatched
        const activeReceived = allMy.filter(
          (r: any) =>
            r.status === 'AUTHORIZED_BY_REGISTRAR' ||
            r.status === 'DISPATCHED_RELEASED' ||
            r.status === 'DISPATCHED_IN_CUSTODY'
        );
        setRegistryRequisitions(activeReceived);
      } else {
        setRegistryRequisitions([]);
      }

      if (legacyRes.status === 'fulfilled' && Array.isArray(legacyRes.value.data)) {
        setLegacyFiles(legacyRes.value.data);
      } else {
        setLegacyFiles([]);
      }
    } catch (error) {
      console.error('Failed to fetch received files', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'STAFF') {
      router.push('/dashboard');
    } else {
      fetchAllReceivedFiles();
    }
  }, [user, router]);

  if (user && user.role === 'STAFF') {
    return null;
  }

  const handleLegacyReturn = async (requestId: string) => {
    setReturningId(requestId);
    try {
      await api.put(`/api/file-requests/${requestId}/return`);
      setViewingLegacyRequest(null);
      alert('File returned to HR successfully.');
      fetchAllReceivedFiles();
    } catch (error) {
      console.error('Failed to return file', error);
      alert('Failed to return file. Please try again.');
    } finally {
      setReturningId(null);
    }
  };

  const totalActiveFiles = registryRequisitions.length + legacyFiles.length;

  return (
    <div className="space-y-8 p-6 min-h-screen bg-gray-55/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FolderOpen className="text-blue-600" size={28} />
            Received & Authorized Files
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Access and view official staff digital dossiers and files authorized by the Registrar & Registry Vault.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/services/file-requests')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
        >
          <Plus size={15} />
          <span>Lodge / Track All File Requisitions</span>
        </button>
      </div>

      {/* List of Files */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : totalActiveFiles === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <FolderOpen className="mx-auto h-16 w-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-800">No active received files</h3>
          <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
            When the Registrar authorizes your file requisitions, your confidential dossiers and custody gatepasses will appear here.
          </p>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => router.push('/dashboard/services/file-requests')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition"
            >
              <Plus className="w-4 h-4" /> Lodge New File Requisition
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Modern Registry Vault Requisitions */}
          {registryRequisitions.map((req) => {
            const isAuthorized = req.status === 'AUTHORIZED_BY_REGISTRAR';
            const hasDigitalFormat =
              req.requestedFileFormat === 'DIGITAL_TRANSCRIPT' || req.requestedFileFormat === 'BOTH';

            return (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-emerald-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                        <FileText size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">
                          {req.staffProfile?.user?.name || 'Staff Member'}
                        </h3>
                        <span className="text-xs text-gray-400 font-mono font-semibold">
                          Staff ID: {req.staffProfile?.staffId || 'N/A'} • {req.staffProfile?.rank || 'Staff'}
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={12} className="mr-1" />
                      {isAuthorized ? 'Registrar Authorized' : 'Dispatched / In Custody'}
                    </span>
                  </div>

                  {/* Transfer Details Information */}
                  <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-700 border border-slate-100 leading-relaxed space-y-1">
                    <div className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">
                      Requisition Docket: {req.requisitionNumber}
                    </div>
                    <div>
                      <strong>Format:</strong> {req.requestedFileFormat} • <strong>Urgency:</strong> {req.urgencyLevel}
                    </div>
                    {req.authorizedBy && (
                      <div className="text-emerald-800 font-medium">
                        ✓ Executive Clearance granted by {req.authorizedBy.name} (Registrar)
                      </div>
                    )}
                    {req.dispatchReceiptNumber && (
                      <div className="font-mono text-indigo-700 font-semibold text-[11px]">
                        Custody Receipt: {req.dispatchReceiptNumber}
                      </div>
                    )}
                  </div>

                  {/* Digital Receipt Stamp */}
                  <div className="flex justify-center pt-2">
                    <div className="border-4 border-double border-emerald-600 text-emerald-700 rounded-xl px-4 py-2 font-mono font-bold text-center uppercase tracking-widest text-[12px] rotate-[-1deg] shadow-xs select-none">
                      <div className="text-[10px] opacity-75">★ NOUN REGISTRY VAULT ★</div>
                      <div className="text-sm font-black tracking-normal">AUTHORIZED & RELEASED</div>
                      <div className="text-[10px] opacity-75">
                        DATE: {new Date(req.authorizedAt || req.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenReturn(req)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 text-xs font-bold transition-colors shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Return File to Registry
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRegistryReq(req);
                        setIsReceiptOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-600" /> Custody Gatepass
                    </button>
                  </div>

                  {hasDigitalFormat && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRegistryReq(req);
                        setIsDigitalViewerOpen(true);
                      }}
                      className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs"
                    >
                      <Eye size={15} /> View Digital Dossier
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Legacy File Requests */}
          {legacyFiles.map((req) => {
            const place =
              req.requester?.staffProfile?.studyCenter?.name ||
              req.requester?.staffProfile?.unit?.name ||
              'Main Registry';
            const approverName = req.approvedBy?.name || 'HR Admin';
            const transferrerName = req.transferredBy?.name || 'HR Admin';
            const transferStatus = `This file has been transferred to ${place}, approved by ${approverName} and transferred by ${transferrerName}`;

            return (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <FileText size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">
                          {req.staff.surname} {req.staff.otherNames}
                        </h3>
                        <span className="text-xs text-gray-400 font-mono font-semibold">
                          Staff ID: {req.staff.staffId}
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                      <CheckCircle2 size={12} className="mr-1" /> Active
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-650 border border-gray-100 leading-relaxed">
                    <div className="font-semibold text-gray-500 uppercase tracking-wider mb-1 text-[9px]">
                      Transfer Details
                    </div>
                    {transferStatus}
                  </div>

                  <div className="flex justify-center pt-2">
                    <div className="border-4 border-double border-red-500 text-red-500 rounded-xl px-4 py-2 font-mono font-bold text-center uppercase tracking-widest text-[12px] rotate-[-2deg] shadow-sm select-none">
                      <div className="text-[10px] opacity-75">★ NOUN REGISTRY ★</div>
                      <div className="text-sm font-black tracking-normal">ACKNOWLEDGED & RECEIVED</div>
                      <div className="text-[10px] opacity-75">
                        DATE: {new Date(req.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                  <div className="text-xs text-gray-400">
                    Received: {new Date(req.createdAt).toLocaleDateString()}
                  </div>
                  <button
                    onClick={() => setViewingLegacyRequest(req)}
                    className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
                  >
                    <Eye size={16} /> View Digital dossier
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legacy Viewer Modal */}
      {viewingLegacyRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-250">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-55/30 flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-800">
                  Viewing Staff Dossier: {viewingLegacyRequest.staff.surname} {viewingLegacyRequest.staff.otherNames}
                </h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  Staff ID: {viewingLegacyRequest.staff.staffId}
                </p>
              </div>

              <div className="mr-6 border-2 border-double border-red-500 text-red-500 rounded-lg px-3 py-1 font-mono font-bold text-center uppercase tracking-wider text-[9px] rotate-[-1deg] select-none scale-90 sm:scale-100">
                <div className="text-[7px] leading-none opacity-75">★ NOUN REGISTRY ★</div>
                <div className="font-extrabold text-[10px] leading-tight">ACKNOWLEDGED & RECEIVED</div>
                <div className="text-[7px] leading-none opacity-75">
                  {new Date(viewingLegacyRequest.createdAt).toLocaleDateString()}
                </div>
              </div>

              <button
                onClick={() => setViewingLegacyRequest(null)}
                className="text-gray-400 hover:text-gray-650 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <DigitalDossier
                staffId={viewingLegacyRequest.staff.id}
                staffName={`${viewingLegacyRequest.staff.surname} ${viewingLegacyRequest.staff.otherNames}`}
                readOnly={true}
              />
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setViewingLegacyRequest(null)}
                className="px-6 py-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                Done
              </button>
              <button
                onClick={() => handleLegacyReturn(viewingLegacyRequest.id)}
                disabled={returningId !== null}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ArrowLeftRight size={16} />
                {returningId ? 'Returning...' : 'Done and Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Custody Receipt Modal */}
      <CustodyReleaseReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        requisition={selectedRegistryReq}
        onViewDigital={() => {
          setIsReceiptOpen(false);
          setIsDigitalViewerOpen(true);
        }}
      />

      {/* Modern Digital Transcript Viewer Modal */}
      {selectedRegistryReq && (
        <DigitalTranscriptViewerModal
          isOpen={isDigitalViewerOpen}
          onClose={() => setIsDigitalViewerOpen(false)}
          requisitionId={selectedRegistryReq.id}
          token={selectedRegistryReq.digitalAccessToken}
        />
      )}

      {/* Modern Return File Confirmation Modal */}
      {isReturnModalOpen && returnReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Return File to Registry</h3>
                  <p className="text-[11px] text-slate-500">Close active custody docket</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReturn} className="p-5 space-y-4">
              {returnError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{returnError}</span>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1 text-xs text-slate-700">
                <div className="font-bold text-slate-900">
                  {returnReq.staffProfile?.user?.name || 'Staff Member'}
                </div>
                <div className="font-mono text-slate-500 text-[11px]">
                  Docket: {returnReq.requisitionNumber} • Staff ID: {returnReq.staffProfile?.staffId || 'N/A'}
                </div>
                <div className="text-slate-600 pt-1 text-[11px]">
                  Returning this file will immediately revoke digital transcript access tokens and notify the Registry Vault that the custody docket is closed.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Return Notes &amp; Handover Remarks (Optional)
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="e.g. Completed accreditation review. Physical hardcopy handed back intact."
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-[#006533] focus:outline-none focus:ring-1 focus:ring-[#006533]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmittingReturn ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Confirm Return</span>
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
