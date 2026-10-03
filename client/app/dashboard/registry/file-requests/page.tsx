'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import api, { getApiBaseUrl } from '@/lib/api';
import {
  FolderOpen,
  PackageCheck,
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Loader2,
  Download,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Printer,
  History,
  Send,
  Eye,
  X
} from 'lucide-react';
import { RequisitionStatusStepper, FileRequisitionStatus } from '@/components/fileRequisition/RequisitionStatusStepper';
import { LodgeRequisitionModal } from '@/components/fileRequisition/LodgeRequisitionModal';
import { CustodyReleaseReceiptModal } from '@/components/fileRequisition/CustodyReleaseReceiptModal';
import { DigitalTranscriptViewerModal } from '@/components/fileRequisition/DigitalTranscriptViewerModal';
import { useAuth } from '@/hooks/useAuth';

export default function RegistryFileRequestsGatewayPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'INWARD' | 'DISPATCH' | 'AUDIT'>('INWARD');
  const [loading, setLoading] = useState(true);

  // Inward State
  const [inwardQueue, setInwardQueue] = useState<any[]>([]);
  // Dispatch State
  const [dispatchQueue, setDispatchQueue] = useState<any[]>([]);
  // Audit Ledger State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReq, setSelectedReq] = useState<any | null>(null);

  // Modals
  const [isLodgeOpen, setIsLodgeOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isDigitalViewerOpen, setIsDigitalViewerOpen] = useState(false);
  const [isAcknowledgeModalOpen, setIsAcknowledgeModalOpen] = useState(false);

  // Intake Action Form State
  const [actionType, setActionType] = useState<'ACKNOWLEDGE' | 'REJECT'>('ACKNOWLEDGE');
  const [folioReference, setFolioReference] = useState('');
  const [acknowledgmentRemarks, setAcknowledgmentRemarks] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState('');

  // Dispatch Action Form State
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [trackingNotes, setTrackingNotes] = useState('');
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState(false);
  const [dispatchError, setDispatchError] = useState('');

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [inwardRes, dispatchRes, auditRes] = await Promise.allSettled([
        api.get('/api/v1/registry/file-requests/inward'),
        api.get('/api/v1/registry/file-requests/ready-for-dispatch'),
        api.get('/api/v1/registry/file-requests/audit-ledger')
      ]);

      if (inwardRes.status === 'fulfilled' && inwardRes.value.data?.success) {
        setInwardQueue(inwardRes.value.data.data || []);
      }
      if (dispatchRes.status === 'fulfilled' && dispatchRes.value.data?.success) {
        setDispatchQueue(dispatchRes.value.data.data || []);
      }
      if (auditRes.status === 'fulfilled' && auditRes.value.data?.success) {
        setAuditLogs(auditRes.value.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load file request gateway data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

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
    if (actionType === 'ACKNOWLEDGE' && !folioReference.trim()) {
      setActionError('A physical vault folio reference must be assigned.');
      return;
    }

    setIsSubmittingAction(true);
    try {
      const res = await api.post(`/api/v1/registry/file-requests/${selectedReq.id}/acknowledge`, {
        action: actionType,
        registryFolioReference: folioReference.trim(),
        adminAcknowledgmentRemarks: acknowledgmentRemarks.trim() || undefined,
      });

      if (res.data?.success) {
        setIsAcknowledgeModalOpen(false);
        setSelectedReq(null);
        await fetchAllData();
      } else {
        setActionError(res.data?.message || 'Action failed.');
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to submit intake action.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleOpenDispatch = (req: any) => {
    setSelectedReq(req);
    setTrackingNotes('');
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
        trackingNotes: trackingNotes.trim() || undefined,
      });

      if (res.data?.success) {
        setIsDispatchModalOpen(false);
        const updated = res.data.data;
        setSelectedReq(updated);
        setIsReceiptOpen(true);
        await fetchAllData();
      } else {
        setDispatchError(res.data?.message || 'Dispatch failed.');
      }
    } catch (err: any) {
      setDispatchError(err.response?.data?.message || 'Failed to dispatch file.');
    } finally {
      setIsSubmittingDispatch(false);
    }
  };

  // Filtered Items
  const filteredInward = inwardQueue.filter((req) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      req.requisitionNumber?.toLowerCase().includes(term) ||
      req.staffProfile?.user?.name?.toLowerCase().includes(term) ||
      req.staffProfile?.staffId?.toLowerCase().includes(term) ||
      req.requester?.name?.toLowerCase().includes(term)
    );
  });

  const filteredDispatch = dispatchQueue.filter((req) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      req.requisitionNumber?.toLowerCase().includes(term) ||
      req.staffProfile?.user?.name?.toLowerCase().includes(term) ||
      req.staffProfile?.staffId?.toLowerCase().includes(term) ||
      req.requester?.name?.toLowerCase().includes(term) ||
      req.dispatchReceiptNumber?.toLowerCase().includes(term)
    );
  });

  const pendingInwardCount = inwardQueue.filter((r) => r.status === 'SUBMITTED').length;
  const readyDispatchCount = dispatchQueue.filter((r) => r.status === 'AUTHORIZED_BY_REGISTRAR').length;
  const inCirculationCount = dispatchQueue.filter((r) => r.status === 'DISPATCHED_RELEASED').length;

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
            <FolderOpen className="w-4 h-4" />
            <span>Registry &amp; Records Directorate • Master Vault Gateway</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            File Requisition, Custody &amp; Release Hub
          </h1>
          <p className="text-xs text-slate-500">
            Intake incoming requests, assign vault folio references, route for Registrar authorization, issue custody gatepasses, and maintain the immutable audit ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/registry/file-requests/inward"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-emerald-700" /> Inward Desk Page
          </Link>
          <Link
            href="/dashboard/registry/file-requests/ready-for-dispatch"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <PackageCheck className="w-3.5 h-3.5 text-blue-700" /> Dispatch Board Page
          </Link>
          <button
            type="button"
            onClick={fetchAllData}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setIsLodgeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Lodge New Requisition
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab('INWARD')}
          className={`cursor-pointer rounded-2xl border p-4.5 transition-all ${
            activeTab === 'INWARD'
              ? 'bg-white border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Inward Vault Intake</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{pendingInwardCount}</div>
          <div className="text-[11px] text-amber-700 font-semibold mt-1">Pending Folio Assignment</div>
        </div>

        <div
          onClick={() => setActiveTab('DISPATCH')}
          className={`cursor-pointer rounded-2xl border p-4.5 transition-all ${
            activeTab === 'DISPATCH'
              ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Ready for Dispatch</span>
            <FileCheck2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{readyDispatchCount}</div>
          <div className="text-[11px] text-blue-700 font-semibold mt-1">Authorized by Registrar</div>
        </div>

        <div
          onClick={() => setActiveTab('DISPATCH')}
          className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-4.5 hover:border-slate-300 transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">In Active Circulation</span>
            <PackageCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{inCirculationCount}</div>
          <div className="text-[11px] text-purple-700 font-semibold mt-1">Held under Gatepass</div>
        </div>

        <div
          onClick={() => setActiveTab('AUDIT')}
          className={`cursor-pointer rounded-2xl border p-4.5 transition-all ${
            activeTab === 'AUDIT'
              ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Audit Trail Ledger</span>
            <ShieldAlert className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{auditLogs.length}</div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">Tamper-Proof Audit Events</div>
        </div>
      </div>

      {/* Tabs & Search Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('INWARD')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'INWARD'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Inward Intake Desk ({inwardQueue.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('DISPATCH')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'DISPATCH'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Dispatch &amp; Custody Board ({dispatchQueue.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('AUDIT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'AUDIT'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Master Custody Audit Ledger ({auditLogs.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search file, staff, docket..."
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          {activeTab === 'AUDIT' && (
            <a
              href={`${getApiBaseUrl()}/api/v1/registry/file-requests/audit-ledger?format=csv`}
              download="noun_file_custody_audit_ledger.csv"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </a>
          )}
        </div>
      </div>

      {/* Main Tab Views */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
          <p className="text-xs font-medium">Loading Registry records...</p>
        </div>
      ) : activeTab === 'INWARD' ? (
        /* TAB 1: INWARD INTAKE */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Inward Requisition Docket Queue
              </span>
              <span className="text-xs text-slate-400">{filteredInward.length} records found</span>
            </div>

            {filteredInward.length === 0 ? (
              <div className="py-14 text-center text-slate-400">
                <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium">No inward requisitions matching criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Docket / Requisition #</th>
                      <th className="px-4 py-3">Subject Staff File</th>
                      <th className="px-4 py-3">Requester &amp; Unit</th>
                      <th className="px-4 py-3">Format &amp; Urgency</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredInward.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-bold text-emerald-900">
                          {req.requisitionNumber}
                          <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900">
                            {req.staffProfile?.user?.name || `${req.staffProfile?.surname || ''} ${req.staffProfile?.otherNames || ''}`}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Staff ID: {req.staffProfile?.staffId || 'N/A'} • {req.staffProfile?.unit?.name || 'Directorate'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-800">{req.requester?.name || 'Requester'}</div>
                          <div className="text-[11px] text-slate-500">{req.requesterDepartment}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-700">{req.requestedFileFormat}</div>
                          <span
                            className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.urgencyLevel === 'LEGAL_SUBPOENA'
                                ? 'bg-rose-100 text-rose-800'
                                : req.urgencyLevel === 'URGENT'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {req.urgencyLevel}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              req.status === 'SUBMITTED'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : req.status === 'ACKNOWLEDGED_PENDING_REGISTRAR'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : req.status === 'AUTHORIZED_BY_REGISTRAR'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {req.status === 'SUBMITTED' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenAcknowledge(req, 'ACKNOWLEDGE')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-[11px] font-bold hover:bg-emerald-800 transition"
                              >
                                Assign Folio
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenAcknowledge(req, 'REJECT')}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold hover:bg-rose-100 transition"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Folio Assigned</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'DISPATCH' ? (
        /* TAB 2: DISPATCH & CUSTODY */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Authorized Files Ready for Release &amp; Active Circulation
              </span>
              <span className="text-xs text-slate-400">{filteredDispatch.length} records found</span>
            </div>

            {filteredDispatch.length === 0 ? (
              <div className="py-14 text-center text-slate-400">
                <PackageCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium">No files currently in dispatch or circulation queue.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Docket #</th>
                      <th className="px-4 py-3">Subject Staff</th>
                      <th className="px-4 py-3">Vault Folio</th>
                      <th className="px-4 py-3">Registrar Authorization</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredDispatch.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                          {req.requisitionNumber}
                          {req.dispatchReceiptNumber && (
                            <div className="text-[10px] text-blue-700 font-mono mt-0.5">
                              {req.dispatchReceiptNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900">
                            {req.staffProfile?.user?.name || `${req.staffProfile?.surname || ''} ${req.staffProfile?.otherNames || ''}`}
                          </div>
                          <div className="text-[11px] text-slate-500">{req.requesterDepartment}</div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-slate-700">
                          {req.registryFolioReference || 'Pending'}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-emerald-800">
                            {req.authorizedBy?.name || 'Registrar'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {req.authorizedAt ? new Date(req.authorizedAt).toLocaleString() : 'Authorized'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              req.status === 'AUTHORIZED_BY_REGISTRAR'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : req.status === 'DISPATCHED_RELEASED'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {req.status === 'AUTHORIZED_BY_REGISTRAR' && (
                              <button
                                type="button"
                                onClick={() => handleOpenDispatch(req)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-[11px] font-bold hover:bg-emerald-800 transition"
                              >
                                Release File
                              </button>
                            )}
                            {req.dispatchReceiptNumber && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedReq(req);
                                  setIsReceiptOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold hover:bg-slate-200 transition"
                              >
                                Print Gatepass
                              </button>
                            )}
                            {(req.requestedFileFormat === 'DIGITAL_TRANSCRIPT' ||
                              req.requestedFileFormat === 'BOTH') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedReq(req);
                                  setIsDigitalViewerOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold hover:bg-blue-100 transition"
                              >
                                View Dossier
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* TAB 3: AUDIT LEDGER */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Official Chain of Custody Audit Ledger
              </span>
              <span className="text-xs text-slate-400">{auditLogs.length} audit entries</span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="py-14 text-center text-slate-400">
                <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium">No custody audit logs recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Requisition #</th>
                      <th className="px-4 py-3">Actor &amp; Role</th>
                      <th className="px-4 py-3">Custody Action</th>
                      <th className="px-4 py-3">IP Address</th>
                      <th className="px-4 py-3">Audit Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-sans">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-900">
                          {log.fileRequisition?.requisitionNumber || 'N/A'}
                        </td>
                        <td className="px-4 py-3 font-sans">
                          <div className="font-semibold text-slate-800">{log.actor?.name || 'Officer'}</div>
                          <div className="text-[10px] text-slate-400">{log.actorRole}</div>
                        </td>
                        <td className="px-4 py-3 font-sans">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.action === 'REGISTRAR_AUTHORIZED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.action === 'FILE_DISPATCHED'
                                ? 'bg-purple-100 text-purple-800'
                                : log.action === 'REGISTRAR_DECLINED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-[11px]">{log.actorIp}</td>
                        <td className="px-4 py-3 font-sans text-slate-600 max-w-xs truncate" title={log.notes}>
                          {log.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Acknowledge Intake Modal */}
      {isAcknowledgeModalOpen && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                {actionType === 'ACKNOWLEDGE' ? 'Vault Folio Intake & Route to Registrar' : 'Reject Requisition'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAcknowledgeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitIntakeAction} className="space-y-4 text-xs">
              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                  {actionError}
                </div>
              )}

              <div>
                <span className="text-slate-500">Requisition:</span>{' '}
                <strong className="font-mono text-emerald-900">{selectedReq.requisitionNumber}</strong>
              </div>

              {actionType === 'ACKNOWLEDGE' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Vault Folio Reference Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={folioReference}
                    onChange={(e) => setFolioReference(e.target.value)}
                    placeholder="e.g. NOUN/FOLIO/VAULT/VOL-I/00318"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-xs focus:ring-2 focus:ring-emerald-600"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Assign the physical registry binder/volume index before forwarding to the Registrar.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {actionType === 'ACKNOWLEDGE' ? 'Registry Intake Remarks (Optional)' : 'Rejection Reason *'}
                </label>
                <textarea
                  rows={3}
                  required={actionType === 'REJECT'}
                  value={acknowledgmentRemarks}
                  onChange={(e) => setAcknowledgmentRemarks(e.target.value)}
                  placeholder={
                    actionType === 'ACKNOWLEDGE'
                      ? 'Note physical condition, shelf location or vetting notes...'
                      : 'Provide explicit reasons why this request cannot be serviced...'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAcknowledgeModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className={`px-4 py-2 rounded-xl font-bold text-white shadow-xs ${
                    actionType === 'ACKNOWLEDGE'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-rose-700 hover:bg-rose-800'
                  }`}
                >
                  {isSubmittingAction
                    ? 'Submitting...'
                    : actionType === 'ACKNOWLEDGE'
                    ? 'Forward to Registrar'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {isDispatchModalOpen && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Secure File Custody Release &amp; Gatepass Generation
              </h3>
              <button
                type="button"
                onClick={() => setIsDispatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitDispatch} className="space-y-4 text-xs">
              {dispatchError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                  {dispatchError}
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div><span className="text-slate-500">Requisition:</span> <strong className="font-mono">{selectedReq.requisitionNumber}</strong></div>
                <div><span className="text-slate-500">Requester:</span> <strong className="text-slate-800">{selectedReq.requester?.name}</strong> ({selectedReq.requesterDepartment})</div>
                <div><span className="text-slate-500">Authorized by:</span> <strong className="text-emerald-800">{selectedReq.authorizedBy?.name || 'Registrar'}</strong></div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Custody Handover Notes &amp; Physical Tracking Details
                </label>
                <textarea
                  rows={3}
                  value={trackingNotes}
                  onChange={(e) => setTrackingNotes(e.target.value)}
                  placeholder="Record recipient staff ID, physical condition of confidential jacket, or courier details..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDispatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispatch}
                  className="px-4 py-2 rounded-xl bg-emerald-700 font-bold text-white shadow-xs hover:bg-emerald-800"
                >
                  {isSubmittingDispatch ? 'Releasing...' : 'Issue Gatepass & Dispatch File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lodging Modal */}
      {isLodgeOpen && (
        <LodgeRequisitionModal
          isOpen={isLodgeOpen}
          onClose={() => setIsLodgeOpen(false)}
          onSuccess={() => {
            setIsLodgeOpen(false);
            fetchAllData();
          }}
        />
      )}

      {/* Receipt Modal */}
      {isReceiptOpen && selectedReq && (
        <CustodyReleaseReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          requisition={selectedReq}
        />
      )}

      {/* Digital Transcript Dossier Viewer */}
      {isDigitalViewerOpen && selectedReq && (
        <DigitalTranscriptViewerModal
          isOpen={isDigitalViewerOpen}
          onClose={() => setIsDigitalViewerOpen(false)}
          requisitionId={selectedReq.id}
        />
      )}
    </div>
  );
}
