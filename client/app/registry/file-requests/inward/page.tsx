'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  FolderOpen,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  Send,
  XCircle,
  X,
  Loader2,
  Plus,
  RefreshCw,
  Archive,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { RequisitionStatusStepper, FileRequisitionStatus } from '@/components/fileRequisition/RequisitionStatusStepper';
import { LodgeRequisitionModal } from '@/components/fileRequisition/LodgeRequisitionModal';
import { CustodyReleaseReceiptModal } from '@/components/fileRequisition/CustodyReleaseReceiptModal';
import { DigitalTranscriptViewerModal } from '@/components/fileRequisition/DigitalTranscriptViewerModal';
import Pagination from '@/components/ui/Pagination';

export default function RegistryInwardFileRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [selectedReq, setSelectedReq] = useState<any | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const paginatedRequisitions = requisitions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(requisitions.length / pageSize) || 1;

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isLodgeOpen, setIsLodgeOpen] = useState(false);
  const [isAcknowledgeModalOpen, setIsAcknowledgeModalOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isDigitalViewerOpen, setIsDigitalViewerOpen] = useState(false);

  // Intake Action Form State
  const [actionType, setActionType] = useState<'ACKNOWLEDGE' | 'REJECT'>('ACKNOWLEDGE');
  const [folioReference, setFolioReference] = useState('');
  const [acknowledgmentRemarks, setAcknowledgmentRemarks] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchRequisitions = async () => {
    setLoading(true);
    try {
      let query = '/api/v1/registry/file-requests/inward?';
      if (statusFilter) query += `status=${statusFilter}&`;
      if (urgencyFilter) query += `urgency=${urgencyFilter}&`;
      if (searchTerm) query += `search=${encodeURIComponent(searchTerm)}&`;

      const res = await api.get(query);
      if (res.data?.success) {
        setRequisitions(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch registry inward queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urgencyFilter, statusFilter]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchRequisitions();
    }, 300);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const handleOpenAcknowledge = (req: any, type: 'ACKNOWLEDGE' | 'REJECT') => {
    setSelectedReq(req);
    setActionType(type);
    setFolioReference(`NOUN/FOLIO/VAULT/VOL-I/${req.requisitionNumber.split('/').pop() || '001'}`);
    setAcknowledgmentRemarks('');
    setActionError('');
    setIsAcknowledgeModalOpen(true);
  };

  const submitIntakeAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;

    setActionError('');
    if (actionType === 'REJECT' && !acknowledgmentRemarks.trim()) {
      setActionError('Remarks explaining the rejection reason are mandatory.');
      return;
    }

    setIsSubmittingAction(true);
    try {
      const res = await api.post(`/api/v1/registry/file-requests/${selectedReq.id}/acknowledge`, {
        action: actionType,
        registryFolioReference: actionType === 'ACKNOWLEDGE' ? folioReference.trim() : undefined,
        adminAcknowledgmentRemarks: acknowledgmentRemarks.trim() || undefined,
      });

      if (res.data?.success) {
        setIsAcknowledgeModalOpen(false);
        fetchRequisitions();
      } else {
        setActionError(res.data?.error || 'Failed to complete intake action.');
      }
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Server error during intake action.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Metrics
  const submittedCount = requisitions.filter((r) => r.status === 'SUBMITTED').length;
  const pendingRegistrarCount = requisitions.filter((r) => r.status === 'ACKNOWLEDGED_PENDING_REGISTRAR').length;
  const urgentCount = requisitions.filter(
    (r) => r.urgencyLevel === 'URGENT' || r.urgencyLevel === 'STATUTORY_AUDIT' || r.urgencyLevel === 'LEGAL_SUBPOENA'
  ).length;

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
            <FolderOpen className="w-4 h-4" />
            <span>Registry & Records Directorate • Physical & Digital Vault</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            File Requisition Intake & Custody Desk
          </h1>
          <p className="text-xs text-slate-500">
            Intake verification, vault folio assignment, and routing to the Registrar for executive authorization.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchRequisitions}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setIsLodgeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Lodge Requisition
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              New Intake Lodgments
            </span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
              <FolderOpen className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{submittedCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Awaiting physical vault inspection & folio</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              With Registrar Desk
            </span>
            <span className="rounded-lg bg-amber-50 p-2 text-amber-700">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{pendingRegistrarCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Folio stamped & awaiting executive determination</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              High Urgency / Subpoena
            </span>
            <span className="rounded-lg bg-rose-50 p-2 text-rose-700">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-rose-900 mt-2">{urgentCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Statutory audit or legal priority dockets</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Requisition, Staff ID, Name, or Folio..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-600 focus:outline-none bg-white"
          >
            <option value="">All Urgencies</option>
            <option value="ROUTINE">Routine</option>
            <option value="URGENT">Urgent</option>
            <option value="STATUTORY_AUDIT">Statutory Audit</option>
            <option value="LEGAL_SUBPOENA">Legal Subpoena</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-600 focus:outline-none bg-white"
          >
            <option value="">All Active Statuses</option>
            <option value="SUBMITTED">Submitted (New)</option>
            <option value="ACKNOWLEDGED_PENDING_REGISTRAR">With Registrar</option>
            <option value="REJECTED_BY_REGISTRY">Rejected at Intake</option>
          </select>
        </div>
      </div>

      {/* Main Requisition Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Requisition Details</th>
                <th className="py-3 px-4">Subject Personnel Record</th>
                <th className="py-3 px-4">Urgency & Format</th>
                <th className="py-3 px-4">Requesting Unit & Purpose</th>
                <th className="py-3 px-4">Current Status</th>
                <th className="py-3 px-4 text-right">Intake Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    <span>Loading Registry Inward queue...</span>
                  </td>
                </tr>
              ) : requisitions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <FolderOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No requisitions currently in the inward queue.</p>
                    <p className="text-[11px] text-slate-400">New personnel file requests lodged by departments will appear here.</p>
                  </td>
                </tr>
              ) : (
                paginatedRequisitions.map((req) => {
                  const isSubmitted = req.status === 'SUBMITTED';
                  const isWithRegistrar = req.status === 'ACKNOWLEDGED_PENDING_REGISTRAR';
                  const isRejected = req.status === 'REJECTED_BY_REGISTRY';

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Requisition Number & Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900">{req.requisitionNumber}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(req.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        {req.registryFolioReference && (
                          <span className="inline-block mt-1 font-mono text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
                            {req.registryFolioReference}
                          </span>
                        )}
                      </td>

                      {/* Subject Personnel Record */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{req.staffProfile?.user?.name || 'Staff Member'}</div>
                        <div className="text-[11px] text-slate-500">
                          ID: <span className="font-mono font-medium">{req.staffProfile?.staffId || 'N/A'}</span> • {req.staffProfile?.rank || 'Staff'}
                        </div>
                      </td>

                      {/* Urgency & Format */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-extrabold uppercase tracking-wider ${
                              req.urgencyLevel === 'ROUTINE'
                                ? 'bg-slate-100 text-slate-700'
                                : req.urgencyLevel === 'URGENT'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {req.urgencyLevel}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {req.requestedFileFormat}
                          </span>
                        </div>
                      </td>

                      {/* Requesting Unit & Purpose */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate">{req.requesterDepartment}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5" title={req.purposeOfRequest}>
                          {req.purposeOfRequest}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isSubmitted
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : isWithRegistrar
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : isRejected
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {isSubmitted ? (
                            <Clock className="w-3 h-3 text-blue-600" />
                          ) : isWithRegistrar ? (
                            <Clock className="w-3 h-3 text-amber-600" />
                          ) : isRejected ? (
                            <XCircle className="w-3 h-3 text-rose-600" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          )}
                          {req.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isSubmitted ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenAcknowledge(req, 'ACKNOWLEDGE')}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition-colors shadow-2xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledge Folio
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenAcknowledge(req, 'REJECT')}
                                className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedReq(req);
                                setIsReceiptOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <FileCheck2 className="w-3.5 h-3.5 text-emerald-700" /> View Folio
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={requisitions.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* Acknowledge / Reject Action Modal */}
      {isAcknowledgeModalOpen && selectedReq && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div
              className={`flex items-center justify-between px-6 py-4 text-white ${
                actionType === 'ACKNOWLEDGE' ? 'bg-emerald-900' : 'bg-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {actionType === 'ACKNOWLEDGE' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
                <h3 className="text-sm font-bold">
                  {actionType === 'ACKNOWLEDGE'
                    ? 'Acknowledge Receipt & Assign Vault Folio'
                    : 'Reject File Requisition at Intake'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAcknowledgeModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitIntakeAction} className="p-6 space-y-4 text-xs">
              {actionError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-rose-800 border border-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Requisition Under Review</span>
                <p className="font-bold text-slate-900">
                  {selectedReq.requisitionNumber} • {selectedReq.staffProfile?.user?.name} ({selectedReq.staffProfile?.staffId})
                </p>
                <p className="text-[11px] text-slate-500">
                  Requester: {selectedReq.requester?.name} ({selectedReq.requesterDepartment})
                </p>
              </div>

              {actionType === 'ACKNOWLEDGE' && (
                <div className="space-y-1.5">
                  <label className="font-bold uppercase tracking-wider text-slate-700">
                    Assigned Vault Folio Reference Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={folioReference}
                    onChange={(e) => setFolioReference(e.target.value)}
                    required
                    placeholder="e.g. NOUN/FOLIO/VAULT/VOL-III/091"
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-mono text-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                  <p className="text-[10px] text-slate-400">
                    Physical vault tag where this personnel file is archived.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-bold uppercase tracking-wider text-slate-700">
                  {actionType === 'ACKNOWLEDGE'
                    ? 'Vault Acknowledgment Remarks (Optional)'
                    : 'Rejection Reason / Remarks (Mandatory)'}{' '}
                  {actionType === 'REJECT' && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  rows={3}
                  value={acknowledgmentRemarks}
                  onChange={(e) => setAcknowledgmentRemarks(e.target.value)}
                  required={actionType === 'REJECT'}
                  placeholder={
                    actionType === 'ACKNOWLEDGE'
                      ? 'Dossier retrieved from Vault Archive Section. Ready for Registrar authorization...'
                      : 'State clear reason why this file request cannot be processed (e.g. file currently in court custody, invalid department)...'
                  }
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAcknowledgeModalOpen(false)}
                  disabled={isSubmittingAction}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  aria-busy={isSubmittingAction}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 font-bold text-white shadow-xs transition-all ${
                    actionType === 'ACKNOWLEDGE'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-rose-700 hover:bg-rose-800'
                  }`}
                >
                  {isSubmittingAction ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...
                    </>
                  ) : actionType === 'ACKNOWLEDGE' ? (
                    <>
                      <Send className="w-3.5 h-3.5" /> Forward to Registrar
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> Confirm Rejection
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lodge Requisition Modal */}
      <LodgeRequisitionModal
        isOpen={isLodgeOpen}
        onClose={() => setIsLodgeOpen(false)}
        onSuccess={() => {
          fetchRequisitions();
        }}
        defaultDepartment="Directorate of Registry"
      />

      {/* Custody Receipt / Gatepass Modal */}
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
    </div>
  );
}
