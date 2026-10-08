'use client';

import React, { useState, useEffect } from 'react';
import api, { getApiBaseUrl } from '@/lib/api';
import {
  PackageCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  Printer,
  Archive,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  X,
  History,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { RequisitionStatusStepper, FileRequisitionStatus } from '@/components/fileRequisition/RequisitionStatusStepper';
import { CustodyReleaseReceiptModal } from '@/components/fileRequisition/CustodyReleaseReceiptModal';
import { DigitalTranscriptViewerModal } from '@/components/fileRequisition/DigitalTranscriptViewerModal';
import Pagination from '@/components/ui/Pagination';

export default function FileDispatchAndCustodyPage() {
  const [activeTab, setActiveTab] = useState<'AWAITING_DISPATCH' | 'IN_CIRCULATION' | 'AUDIT_LEDGER'>('AWAITING_DISPATCH');
  const [loading, setLoading] = useState(true);

  // Requisitions List
  const [items, setItems] = useState<any[]>([]);
  const [selectedReq, setSelectedReq] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Audit Ledger State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Pagination states
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPageSize, setItemsPageSize] = useState(10);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);

  const paginatedItems = items.slice((itemsPage - 1) * itemsPageSize, itemsPage * itemsPageSize);
  const totalItemsPages = Math.ceil(items.length / itemsPageSize) || 1;

  const paginatedAuditLogs = auditLogs.slice((auditPage - 1) * auditPageSize, auditPage * auditPageSize);
  const totalAuditPages = Math.ceil(auditLogs.length / auditPageSize) || 1;

  // Dispatch Action Modal
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [trackingNotes, setTrackingNotes] = useState('');
  const [digitalAccessHours, setDigitalAccessHours] = useState('48');
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState(false);
  const [dispatchError, setDispatchError] = useState('');

  // Return Action Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnNotes, setReturnNotes] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState('');

  // Modals
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isDigitalViewerOpen, setIsDigitalViewerOpen] = useState(false);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const statusParam =
        activeTab === 'AWAITING_DISPATCH'
          ? 'AUTHORIZED_BY_REGISTRAR'
          : activeTab === 'IN_CIRCULATION'
          ? 'DISPATCHED_RELEASED'
          : '';

      const query = `/api/v1/registry/file-requests/ready-for-dispatch?status=${statusParam}&search=${encodeURIComponent(
        searchTerm
      )}`;
      const res = await api.get(query);
      if (res.data?.success) {
        setItems(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch dispatch queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLedger = async () => {
    setLoadingAudit(true);
    try {
      const res = await api.get('/api/v1/registry/file-requests/audit-ledger');
      if (res.data?.success) {
        setAuditLogs(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit ledger:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'AUDIT_LEDGER') {
      fetchAuditLedger();
    } else {
      fetchQueue();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'AUDIT_LEDGER') {
      const handler = setTimeout(() => {
        fetchQueue();
      }, 300);
      return () => clearTimeout(handler);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const handleOpenDispatch = (req: any) => {
    setSelectedReq(req);
    setTrackingNotes('Handover verified. Signed receipt logged in Registry Custody Desk.');
    setDigitalAccessHours('48');
    setDispatchError('');
    setIsDispatchModalOpen(true);
  };

  const submitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;

    setIsSubmittingDispatch(true);
    setDispatchError('');
    try {
      const res = await api.post(`/api/v1/registry/file-requests/${selectedReq.id}/dispatch`, {
        trackingNotes: trackingNotes.trim(),
        digitalAccessHours: Number(digitalAccessHours) || 48,
      });

      if (res.data?.success) {
        setIsDispatchModalOpen(false);
        setSelectedReq(res.data.data);
        setIsReceiptOpen(true); // Open gatepass receipt immediately
        fetchQueue();
      } else {
        setDispatchError(res.data?.error || 'Failed to dispatch file.');
      }
    } catch (err: any) {
      setDispatchError(err.response?.data?.error || 'Server error during dispatch.');
    } finally {
      setIsSubmittingDispatch(false);
    }
  };

  const handleOpenReturn = (req: any) => {
    setSelectedReq(req);
    setReturnNotes('File returned intact with all folios intact. Restored to Archive Vault.');
    setReturnError('');
    setIsReturnModalOpen(true);
  };

  const submitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;

    setIsSubmittingReturn(true);
    setReturnError('');
    try {
      const res = await api.post(`/api/v1/registry/file-requests/${selectedReq.id}/return`, {
        returnNotes: returnNotes.trim(),
      });

      if (res.data?.success) {
        setIsReturnModalOpen(false);
        fetchQueue();
      } else {
        setReturnError(res.data?.error || 'Failed to log return.');
      }
    } catch (err: any) {
      setReturnError(err.response?.data?.error || 'Server error during return logging.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const handleExportCsv = () => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : '';
    const downloadUrl = `${getApiBaseUrl()}/api/v1/registry/file-requests/audit-ledger?format=csv`;

    // Download via link
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `noun_file_custody_audit_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
            <PackageCheck className="w-4 h-4" />
            <span>Registry Vault Operations • Custody Handover Desk</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Personnel File Dispatch & Vault Custody Board
          </h1>
          <p className="text-xs text-slate-500">
            Physical handover verification, gatepass receipt generation, and vault return archiving.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={activeTab === 'AUDIT_LEDGER' ? fetchAuditLedger : fetchQueue}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingAudit ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition-colors"
          >
            <Download className="w-4 h-4" /> Export Council CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('AWAITING_DISPATCH')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'AWAITING_DISPATCH'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>Authorized Awaiting Handover</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('IN_CIRCULATION')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'IN_CIRCULATION'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Active In Circulation</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('AUDIT_LEDGER')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'AUDIT_LEDGER'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Full Chain of Custody Ledger</span>
        </button>
      </div>

      {activeTab !== 'AUDIT_LEDGER' ? (
        <>
          {/* Search Bar */}
          <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Requisition, Staff ID, or Receipt..."
                className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-xs focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <span className="text-xs font-bold text-slate-500">
              Files in Queue: <span className="text-emerald-800 font-extrabold">{items.length}</span>
            </span>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Docket Details</th>
                    <th className="py-3 px-4">Subject Personnel Record</th>
                    <th className="py-3 px-4">Requisitioning Officer</th>
                    <th className="py-3 px-4">Registrar Clearance</th>
                    <th className="py-3 px-4">Custody Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                        <span>Loading custody queue...</span>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Archive className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">No personnel files in this custody state.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Docket Details */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">{item.requisitionNumber}</div>
                          {item.dispatchReceiptNumber && (
                            <span className="inline-block mt-0.5 font-mono text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
                              Receipt: {item.dispatchReceiptNumber}
                            </span>
                          )}
                          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            Folio: {item.registryFolioReference || 'Vault Folio'}
                          </div>
                        </td>

                        {/* Subject Personnel */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{item.staffProfile?.user?.name || 'Staff Member'}</div>
                          <div className="text-[11px] text-slate-500">
                            ID: <span className="font-mono font-medium">{item.staffProfile?.staffId || 'N/A'}</span> • {item.staffProfile?.rank}
                          </div>
                        </td>

                        {/* Requisitioning Officer */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">{item.requesterDepartment}</div>
                          <div className="text-[11px] text-slate-500">{item.requester?.name}</div>
                          <span className="inline-block text-[10px] font-medium text-slate-400">
                            Format: {item.requestedFileFormat}
                          </span>
                        </td>

                        {/* Registrar Clearance */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="flex items-center gap-1 text-emerald-800 font-bold text-[11px]">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Authorized
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5" title={item.registrarRemarks}>
                            &ldquo;{item.registrarRemarks || 'Executive approval granted'}&rdquo;
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              item.status === 'AUTHORIZED_BY_REGISTRAR'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {item.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {activeTab === 'AWAITING_DISPATCH' ? (
                              <button
                                type="button"
                                onClick={() => handleOpenDispatch(item)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 shadow-2xs transition-colors"
                              >
                                <PackageCheck className="w-3.5 h-3.5" /> Dispatch & Gatepass
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedReq(item);
                                    setIsReceiptOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                  title="Print Gatepass Receipt"
                                >
                                  <Printer className="w-3.5 h-3.5 text-slate-600" /> Gatepass
                                </button>

                                {(item.requestedFileFormat === 'DIGITAL_TRANSCRIPT' ||
                                  item.requestedFileFormat === 'BOTH') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedReq(item);
                                      setIsDigitalViewerOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                                    title="View Digital Transcript"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" /> Digital
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleOpenReturn(item)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 shadow-2xs transition-colors"
                                >
                                  <Archive className="w-3.5 h-3.5" /> Log Return
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <Pagination
                currentPage={itemsPage}
                totalPages={totalItemsPages}
                totalItems={items.length}
                pageSize={itemsPageSize}
                onPageChange={setItemsPage}
                onPageSizeChange={setItemsPageSize}
              />
            </div>
          </div>
        </>
      ) : (
        /* Full Chain of Custody Audit Ledger */
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Institutional Personnel Dossier Chain of Custody Audit Ledger
              </h3>
              <p className="text-[11px] text-slate-500">
                Immutable chronological log of all file requisitions, vault intake folios, executive authorizations, releases, and vault returns.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" /> Download CSV Ledger
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Requisition & Receipt</th>
                  <th className="py-3 px-4">Subject Personnel Record</th>
                  <th className="py-3 px-4">Custody Action</th>
                  <th className="py-3 px-4">Acting Officer</th>
                  <th className="py-3 px-4">Details & Folio Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loadingAudit ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                      <span>Loading custody audit ledger...</span>
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600">No custody audit logs recorded yet.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(log.createdAt).toLocaleString('en-GB')}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {log.requisition?.requisitionNumber || 'N/A'}
                        {log.requisition?.dispatchReceiptNumber && (
                          <div className="text-[10px] text-emerald-800 font-medium">
                            {log.requisition.dispatchReceiptNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {log.requisition?.staffProfile?.user?.name || 'Staff Member'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {log.requisition?.staffProfile?.staffId || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-sm font-mono text-[10px] font-extrabold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{log.actor?.name || 'System Officer'}</div>
                        <div className="text-[10px] font-bold text-slate-400">{log.actor?.role}</div>
                      </td>
                      <td className="py-3 px-4 max-w-sm text-slate-600 text-[11px]">
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <Pagination
              currentPage={auditPage}
              totalPages={totalAuditPages}
              totalItems={auditLogs.length}
              pageSize={auditPageSize}
              onPageChange={setAuditPage}
              onPageSizeChange={setAuditPageSize}
            />
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {isDispatchModalOpen && selectedReq && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between bg-emerald-900 px-6 py-4 text-white">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">Dispatch Personnel File & Generate Gatepass</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDispatchModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitDispatch} className="p-6 space-y-4 text-xs">
              {dispatchError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-rose-800 border border-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{dispatchError}</span>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Authorizing Reference</span>
                <p className="font-bold text-slate-900">
                  {selectedReq.requisitionNumber} • {selectedReq.staffProfile?.user?.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  Format: <span className="font-bold text-emerald-800">{selectedReq.requestedFileFormat}</span>
                </p>
              </div>

              {(selectedReq.requestedFileFormat === 'DIGITAL_TRANSCRIPT' ||
                selectedReq.requestedFileFormat === 'BOTH') && (
                <div className="space-y-1.5">
                  <label className="font-bold uppercase tracking-wider text-slate-700">
                    Digital Single-Session Access Duration (Hours)
                  </label>
                  <select
                    value={digitalAccessHours}
                    onChange={(e) => setDigitalAccessHours(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs bg-white focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="24">24 Hours (Standard Fast Review)</option>
                    <option value="48">48 Hours (Standard Committee Review)</option>
                    <option value="72">72 Hours (3-Day Statutory Audit)</option>
                    <option value="168">168 Hours (7-Day Legal Proceedings)</option>
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-bold uppercase tracking-wider text-slate-700">
                  Dispatch Handover Notes
                </label>
                <textarea
                  rows={3}
                  value={trackingNotes}
                  onChange={(e) => setTrackingNotes(e.target.value)}
                  placeholder="Record handover verification, recipient officer signature notes, or vault folio dispatch status..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-600 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDispatchModalOpen(false)}
                  disabled={isSubmittingDispatch}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispatch}
                  aria-busy={isSubmittingDispatch}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2 font-bold text-white shadow-xs hover:bg-emerald-800 transition-all"
                >
                  {isSubmittingDispatch ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Dispatching...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Confirm Release & Generate Receipt
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {isReturnModalOpen && selectedReq && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">Log Personnel File Return to Vault</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitReturn} className="p-6 space-y-4 text-xs">
              {returnError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-rose-800 border border-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{returnError}</span>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Returning File</span>
                <p className="font-bold text-slate-900">
                  {selectedReq.requisitionNumber} • {selectedReq.staffProfile?.user?.name}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Dispatch Receipt: {selectedReq.dispatchReceiptNumber}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold uppercase tracking-wider text-slate-700">
                  Vault Return Notes & Folio Verification
                </label>
                <textarea
                  rows={3}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Record file physical condition, page count verification, and vault shelf restoration details..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-600 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  disabled={isSubmittingReturn}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  aria-busy={isSubmittingReturn}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 font-bold text-white shadow-xs hover:bg-slate-800 transition-all"
                >
                  {isSubmittingReturn ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Archiving...
                    </>
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5" /> Confirm Return & Close Docket
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    </div>
  );
}
