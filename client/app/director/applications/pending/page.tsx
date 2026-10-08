'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '@/lib/api';
import ApplicationStatusBadge from '@/components/applications/ApplicationStatusBadge';
import ApplicationDetailsModal from '@/components/applications/ApplicationDetailsModal';
import {
  Search,
  CheckCircle2,
  Clock,
  Send,
  RotateCcw,
  XCircle,
  FileText,
  Building2,
  User,
  ExternalLink,
  Filter,
  RefreshCw,
  Award,
  Check,
  AlertCircle,
  Paperclip
} from 'lucide-react';

type TabType = 'ALL' | 'PENDING' | 'RECOMMENDED' | 'APPROVED' | 'REWRITE' | 'REJECTED';

interface QueueSummary {
  total: number;
  pending: number;
  recommended: number;
  approved: number;
  rejected: number;
  rewrite: number;
}

export default function DirectorPendingApplicationsPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [summary, setSummary] = useState<QueueSummary>({
    total: 0,
    pending: 0,
    recommended: 0,
    approved: 0,
    rejected: 0,
    rewrite: 0,
  });
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Action Modal State
  const [actionApp, setActionApp] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'RECOMMEND' | 'REWRITE' | 'REJECT' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDirectorQueue = useCallback(async (tabToLoad: TabType = activeTab) => {
    try {
      setLoading(true);
      const params = tabToLoad !== 'ALL' ? `?status=${tabToLoad}` : '';
      let res;
      try {
        res = await api.get(`/api/v1/applications/director-queue${params}`);
      } catch {
        try {
          res = await api.get(`/api/v1/applications/director/queue${params}`);
        } catch {
          res = await api.get(`/api/applications/director-queue${params}`);
        }
      }
      if (res?.data?.success) {
        setQueue(res.data.data || res.data.applications || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to load director queue:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadDirectorQueue(activeTab);
  }, [activeTab, loadDirectorQueue]);

  const handleOpenAction = (app: any, type: 'RECOMMEND' | 'REWRITE' | 'REJECT') => {
    setActionApp(app);
    setActionType(type);
    setRemarks('');
    setActionError(null);
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionApp || !actionType) return;

    if ((actionType === 'REWRITE' || actionType === 'REJECT') && !remarks.trim()) {
      setActionError(`Statutory remarks are strictly mandatory when selecting ${actionType}.`);
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const payload = {
        decision: actionType,
        action: actionType,
        directorRemarks: remarks.trim(),
        remarks: remarks.trim(),
      };

      let res;
      try {
        res = await api.put(`/api/v1/applications/${actionApp.id}/director-action`, payload);
      } catch {
        res = await api.post(`/api/v1/applications/${actionApp.id}/director-action`, payload);
      }

      if (res?.data?.success) {
        setActionApp(null);
        setActionType(null);
        await loadDirectorQueue(activeTab);
      } else {
        setActionError(res?.data?.error || 'Action processing failed.');
      }
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered applications based on search query
  const filteredQueue = useMemo(() => {
    if (!searchQuery.trim()) return queue;
    const q = searchQuery.toLowerCase().trim();
    return queue.filter((app) => {
      const applicant = app.applicant?.staffProfile;
      const fullName = `${applicant?.title || ''} ${applicant?.surname || ''} ${applicant?.otherNames || ''} ${applicant?.firstName || ''} ${applicant?.lastName || ''} ${app.applicant?.name || ''}`.toLowerCase();
      const staffId = (applicant?.staffId || applicant?.staffNumber || '').toLowerCase();
      const ref = (app.referenceNumber || '').toLowerCase();
      const subject = (app.subject || '').toLowerCase();
      const category = (app.category || '').toLowerCase();
      const unit = (applicant?.unit?.name || '').toLowerCase();

      return (
        fullName.includes(q) ||
        staffId.includes(q) ||
        ref.includes(q) ||
        subject.includes(q) ||
        category.includes(q) ||
        unit.includes(q)
      );
    });
  }, [queue, searchQuery]);

  const tabs: { id: TabType; label: string; count: number; color: string; icon: any }[] = [
    { id: 'ALL', label: 'All Applications', count: summary.total, color: 'text-gray-700 bg-gray-100', icon: FileText },
    { id: 'PENDING', label: 'Awaiting My Vetting', count: summary.pending, color: 'text-amber-800 bg-amber-100', icon: Clock },
    { id: 'RECOMMENDED', label: 'Endorsed & Forwarded', count: summary.recommended, color: 'text-blue-800 bg-blue-100', icon: Send },
    { id: 'APPROVED', label: 'Approved by Registrar', count: summary.approved, color: 'text-emerald-800 bg-emerald-100', icon: CheckCircle2 },
    { id: 'REWRITE', label: 'Returned for Rewrite', count: summary.rewrite, color: 'text-orange-800 bg-orange-100', icon: RotateCcw },
    { id: 'REJECTED', label: 'Rejected / Declined', count: summary.rejected, color: 'text-red-800 bg-red-100', icon: XCircle },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-gradient-to-r from-amber-500/10 to-amber-600/20 text-amber-900 border border-amber-300">
              Tier-2 Institutional Gate
            </span>
            <span className="text-xs text-gray-500 font-medium">Directorate Vetting & Oversight Cockpit</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mt-1 tracking-tight">
            Directorate Applications & Vetting Desk
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Review submissions awaiting your vetting, track endorsed applications forwarded to the Registrar, and monitor approved and rejected cases in your Directorate/Unit.
          </p>
        </div>
        <button
          onClick={() => loadDirectorQueue(activeTab)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Registry
        </button>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-200 pb-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-600/30'
                      : 'bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-gray-200/80'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isActive ? 'bg-white/25 text-white' : tab.color
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by staff name, Staff ID, Reference No., subject or department/unit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-bold"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Queue List */}
      {loading ? (
        <div className="flex justify-center items-center h-56 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex flex-col items-center gap-3 text-gray-500 text-xs font-medium">
            <span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Loading Directorate Queue...
          </div>
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-800">
            {searchQuery ? 'No matching applications found' : 'No applications in this category'}
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            {searchQuery
              ? `No records match your query "${searchQuery}". Try adjusting your filters.`
              : activeTab === 'PENDING'
              ? 'All staff applications routed to your Directorate have been vetted and processed.'
              : 'There are currently no applications under this category in your Directorate record.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredQueue.map((app) => {
            const applicant = app.applicant?.staffProfile;
            const applicantFullName = applicant?.title
              ? `${applicant.title} ${applicant.surname || ''} ${applicant.otherNames || ''}`.trim()
              : applicant?.surname
              ? `${applicant.surname} ${applicant.otherNames || ''}`.trim()
              : applicant?.firstName
              ? `${applicant.firstName} ${applicant.lastName || ''}`.trim()
              : app.applicant?.name || app.applicant?.email || 'Staff Member';

            const staffId = applicant?.staffId || applicant?.staffNumber || 'N/A';
            const rank = applicant?.rank || 'Staff';
            const unitName = applicant?.unit?.name || applicant?.department || 'Directorate / Unit';
            const studyCenterName = applicant?.studyCenter?.name;
            const isPendingVetting = app.status === 'SUBMITTED_TO_DIRECTOR';

            return (
              <div
                key={app.id}
                className="bg-white border border-gray-200/90 hover:border-gray-300 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60 shadow-xs">
                      {app.referenceNumber}
                    </span>
                    <ApplicationStatusBadge status={app.status} />
                    <span className="text-[11px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                      {app.category?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-400">
                      Submitted: {new Date(app.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedApp(app);
                      setIsDetailsModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Examine Dossier</span>
                  </button>
                </div>

                {/* Card Body */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <h3 className="text-base font-bold text-gray-900 leading-snug">{app.subject}</h3>
                    <p className="text-xs text-gray-600 line-clamp-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 font-sans leading-relaxed">
                      {app.content}
                    </p>

                    {/* Supporting Documents Quick Badge */}
                    {((app.attachmentUrls && app.attachmentUrls.length > 0) || app.attachmentUrl) && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                          <Paperclip size={12} className="text-emerald-600" />
                          Attachments:
                        </span>
                        {(app.attachmentUrls || (app.attachmentUrl ? [app.attachmentUrl] : [])).map((url: string, idx: number) => {
                          const name = decodeURIComponent(url.split('/').pop()?.replace(/^\d+-/, '') || `Attachment #${idx + 1}`);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setSelectedApp(app);
                                setIsDetailsModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md transition-colors"
                            >
                              <FileText size={11} className="text-emerald-600" />
                              <span className="truncate max-w-[160px]">{name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Registry Docket Badge if Docketed */}
                    {app.registryDocketNumber && (
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-200">
                        <Award className="w-3.5 h-3.5" />
                        <span>Registry Folio: {app.registryDocketNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Staff Info Card */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 text-xs space-y-1.5 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-gray-400 font-bold uppercase text-[10px]">
                        <User className="w-3 h-3" />
                        <span>Applicant Profile</span>
                      </div>
                      <p className="font-extrabold text-gray-900 text-sm">{applicantFullName}</p>
                      <p className="text-gray-600 font-medium">{rank}</p>
                      <p className="text-gray-500">ID: <span className="font-mono font-semibold text-gray-700">{staffId}</span></p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 text-[11px] text-gray-500 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="truncate">{unitName}</span>
                      </div>
                      {studyCenterName && (
                        <p className="text-gray-400 text-[10px] pl-4">{studyCenterName}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Historical Director's Minute Callout if Present */}
                {app.directorRemarks && (
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between text-amber-900 font-bold text-[11px]">
                      <span>Directorate Endorsement Minute:</span>
                      {app.directorVettedAt && (
                        <span className="text-[10px] font-normal text-amber-700">
                          {new Date(app.directorVettedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                    <p className="text-amber-950 italic font-serif bg-white/60 p-2 rounded border border-amber-200/50">
                      &quot;{app.directorRemarks}&quot;
                    </p>
                  </div>
                )}

                {/* Historical Registrar's Minute Callout if Present */}
                {app.registrarRemarks && (
                  <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between text-purple-900 font-bold text-[11px]">
                      <span>Registrar&apos;s Official Determination:</span>
                      {app.registrarActedAt && (
                        <span className="text-[10px] font-normal text-purple-700">
                          {new Date(app.registrarActedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                    <p className="text-purple-950 italic font-serif bg-white/60 p-2 rounded border border-purple-200/50">
                      &quot;{app.registrarRemarks}&quot;
                    </p>
                  </div>
                )}

                {/* Director Statutory Actions or Status Footer */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100 flex-wrap">
                  {isPendingVetting ? (
                    <>
                      <span className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" />
                        Action Required: Endorse with statutory minute, return for rewrite, or reject.
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenAction(app, 'REJECT')}
                          className="px-3.5 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"
                        >
                          Reject Application
                        </button>
                        <button
                          onClick={() => handleOpenAction(app, 'REWRITE')}
                          className="px-3.5 py-1.5 text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors"
                        >
                          Return for Rewrite
                        </button>
                        <button
                          onClick={() => handleOpenAction(app, 'RECOMMEND')}
                          className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Endorse & Recommend to Registry</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Directorate vetting complete · Status: <strong className="text-gray-800">{app.status.replace(/_/g, ' ')}</strong>
                      </span>
                      <span className="text-[11px] text-gray-400">
                        Updated {new Date(app.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Execution Modal */}
      {actionApp && actionType && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 border border-gray-100">
            <div className="border-b pb-3">
              <h3 className="text-lg font-black text-gray-900">
                {actionType === 'RECOMMEND' && 'Endorse & Recommend to Registry Inward Desk'}
                {actionType === 'REWRITE' && 'Return Application for Rewrite / Corrections'}
                {actionType === 'REJECT' && 'Decline / Reject Application'}
              </h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                Ref: {actionApp.referenceNumber} · {actionApp.subject}
              </p>
            </div>

            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteAction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Director&apos;s Minute / Statutory Endorsement {actionType !== 'RECOMMEND' ? '*' : '(Optional)'}
                </label>
                <textarea
                  required={actionType !== 'RECOMMEND'}
                  rows={4}
                  placeholder={
                    actionType === 'RECOMMEND'
                      ? 'e.g. Strongly recommended. Staff has met all service criteria and departmental relief is organized.'
                      : actionType === 'REWRITE'
                      ? 'Specify the required amendments, missing documents, or necessary corrections...'
                      : 'Provide comprehensive statutory grounds for declining this application...'
                  }
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setActionApp(null);
                    setActionType(null);
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  aria-busy={actionLoading}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition-colors flex items-center gap-2 ${
                    actionType === 'RECOMMEND'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : actionType === 'REWRITE'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Recording Endorsement...
                    </>
                  ) : actionType === 'RECOMMEND' ? (
                    'Confirm Recommendation'
                  ) : actionType === 'REWRITE' ? (
                    'Confirm Return for Rewrite'
                  ) : (
                    'Confirm Rejection'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      <ApplicationDetailsModal
        application={selectedApp}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
      />
    </div>
  );
}
