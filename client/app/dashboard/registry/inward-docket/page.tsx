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
  XCircle,
  FileText,
  Building2,
  User,
  RefreshCw,
  Award,
  Check,
  AlertCircle,
  Stamp,
  ShieldCheck,
  Calendar
} from 'lucide-react';

type RegistryTabType = 'AWAITING' | 'DOCKETED' | 'APPROVED' | 'DECLINED' | 'ALL';

interface RegistrySummary {
  total: number;
  awaiting: number;
  docketed: number;
  approved: number;
  declined: number;
}

export default function RegistryInwardDocketPage() {
  const [filter, setFilter] = useState<RegistryTabType>('AWAITING');
  const [applications, setApplications] = useState<any[]>([]);
  const [summary, setSummary] = useState<RegistrySummary>({
    total: 0,
    awaiting: 0,
    docketed: 0,
    approved: 0,
    declined: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Docketing Action Modal State
  const [docketingApp, setDocketingApp] = useState<any | null>(null);
  const [folioInput, setFolioInput] = useState('');
  const [docketRemarks, setDocketRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadRegistryQueue = useCallback(async (tabToLoad: RegistryTabType = filter) => {
    try {
      setLoading(true);
      const params = `?filter=${tabToLoad}`;
      let res;
      try {
        res = await api.get(`/api/v1/applications/registry/queue${params}`);
      } catch {
        try {
          res = await api.get(`/api/v1/applications/registry-queue${params}`);
        } catch {
          res = await api.get(`/api/applications/registry-queue${params}`);
        }
      }
      if (res?.data?.success) {
        setApplications(res.data.data || res.data.applications || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to load registry queue:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadRegistryQueue(filter);
  }, [filter, loadRegistryQueue]);

  const handleStartDocket = (app: any) => {
    setDocketingApp(app);
    setFolioInput('');
    setDocketRemarks('');
    setActionError(null);
  };

  const handleConfirmDocket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docketingApp) return;

    try {
      setIsSubmitting(true);
      setActionError(null);

      const payload: any = {
        remarks: docketRemarks.trim() || undefined,
      };
      if (folioInput.trim()) {
        payload.customFolioNumber = folioInput.trim();
      }

      let res;
      try {
        res = await api.put(`/api/v1/applications/${docketingApp.id}/registry-acknowledge`, payload);
      } catch {
        try {
          res = await api.post(`/api/v1/applications/${docketingApp.id}/registry-acknowledge`, payload);
        } catch {
          res = await api.post(`/api/applications/${docketingApp.id}/registry-acknowledge`, payload);
        }
      }

      if (res?.data?.success) {
        setDocketingApp(null);
        setFolioInput('');
        setDocketRemarks('');
        await loadRegistryQueue(filter);
      } else {
        setActionError(res?.data?.error || 'Docket acknowledgment and folio generation failed.');
      }
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err.message || 'Docket acknowledgment failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered applications based on search query
  const filteredApplications = useMemo(() => {
    if (!searchQuery.trim()) return applications;
    const q = searchQuery.toLowerCase().trim();
    return applications.filter((app) => {
      const applicant = app.applicant?.staffProfile;
      const applicantFullName = `${applicant?.title || ''} ${applicant?.surname || ''} ${applicant?.otherNames || ''} ${applicant?.firstName || ''} ${applicant?.lastName || ''} ${app.applicant?.name || ''}`.toLowerCase();
      const staffId = (applicant?.staffId || applicant?.staffNumber || '').toLowerCase();
      const ref = (app.referenceNumber || '').toLowerCase();
      const folio = (app.registryDocketNumber || '').toLowerCase();
      const subject = (app.subject || '').toLowerCase();
      const category = (app.category || '').toLowerCase();
      const unit = (applicant?.unit?.name || applicant?.department || '').toLowerCase();

      return (
        applicantFullName.includes(q) ||
        staffId.includes(q) ||
        ref.includes(q) ||
        folio.includes(q) ||
        subject.includes(q) ||
        category.includes(q) ||
        unit.includes(q)
      );
    });
  }, [applications, searchQuery]);

  const tabs: { id: RegistryTabType; label: string; count: number; color: string; icon: any }[] = [
    { id: 'AWAITING', label: 'Awaiting Folio Docketing', count: summary.awaiting, color: 'text-amber-800 bg-amber-100', icon: Clock },
    { id: 'DOCKETED', label: 'Docketed & Forwarded to Registrar', count: summary.docketed, color: 'text-purple-800 bg-purple-100', icon: Stamp },
    { id: 'APPROVED', label: 'Approved by Registrar', count: summary.approved, color: 'text-emerald-800 bg-emerald-100', icon: CheckCircle2 },
    { id: 'DECLINED', label: 'Declined by Registrar', count: summary.declined, color: 'text-red-800 bg-red-100', icon: XCircle },
    { id: 'ALL', label: 'All Inward Records', count: summary.total, color: 'text-gray-700 bg-gray-100', icon: FileText },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-gradient-to-r from-purple-500/10 to-indigo-600/20 text-purple-900 border border-purple-300">
              Tier-3 Registry Gate
            </span>
            <span className="text-xs text-gray-500 font-medium">Inward Docketing & Folio Stamping Desk</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mt-1 tracking-tight">
            Registry Inward Docket & Folio Desk
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Acknowledge directorate-endorsed applications, stamp statutory Registry Folio numbers, dual-dispatch acknowledgment receipts, and route immediately to the Registrar&apos;s Executive Docket.
          </p>
        </div>

        <button
          onClick={() => loadRegistryQueue(filter)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Registry
        </button>
      </div>

      {/* Tabs & Search Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-200 pb-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-purple-700 text-white shadow-md shadow-purple-600/20 ring-2 ring-purple-600/30'
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
            placeholder="Search by applicant name, Staff ID, Reference No., Folio No., subject or directorate..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 shadow-sm"
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
            <span className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            Loading Registry Inward Desk...
          </div>
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 mx-auto flex items-center justify-center mb-3">
            <Stamp className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-800">
            {searchQuery ? 'No matching applications found' : 'No applications in this category'}
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            {searchQuery
              ? `No records match your search "${searchQuery}".`
              : filter === 'AWAITING'
              ? 'All directorate-endorsed applications have been assigned folios and forwarded to the Registrar.'
              : 'There are currently no records under this category in the Registry desk.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredApplications.map((app) => {
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

            const directorProfile = app.director?.staffProfile;
            const directorFullName = directorProfile?.title
              ? `${directorProfile.title} ${directorProfile.surname || ''} ${directorProfile.otherNames || ''}`.trim()
              : app.director?.name || 'Director / Dean';

            const isAwaitingDocketing = app.status === 'RECOMMENDED_TO_REGISTRY';

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

                    {app.registryDocketNumber && (
                      <span className="font-mono text-xs font-extrabold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200/60 shadow-xs flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" />
                        Folio: {app.registryDocketNumber}
                      </span>
                    )}

                    <ApplicationStatusBadge status={app.status} />

                    <span className="text-[11px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                      {app.category?.replace(/_/g, ' ')}
                    </span>

                    <span className="text-xs text-gray-400">
                      Endorsed by Directorate: {app.directorRecommendedAt ? new Date(app.directorRecommendedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Pending'}
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

                    {/* Director's Minute Callout */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between text-amber-900 font-bold text-[11px]">
                        <span>Directorate Statutory Endorsement ({directorFullName}):</span>
                        {app.directorRecommendedAt && (
                          <span className="text-[10px] font-normal text-amber-700">
                            {new Date(app.directorRecommendedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        )}
                      </div>
                      <p className="text-amber-950 italic font-serif bg-white/60 p-2 rounded border border-amber-200/50">
                        &quot;{app.directorRemarks || 'Recommended for registry action and registrar adjudication.'}&quot;
                      </p>
                    </div>
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

                {/* Registrar Final Minute if Present */}
                {app.registrarRemarks && (
                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between text-emerald-900 font-bold text-[11px]">
                      <span>Registrar&apos;s Determination Minute:</span>
                      {app.registrarDecidedAt && (
                        <span className="text-[10px] font-normal text-emerald-700">
                          {new Date(app.registrarDecidedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                    <p className="text-emerald-950 italic font-serif bg-white/60 p-2 rounded border border-emerald-200/50">
                      &quot;{app.registrarRemarks}&quot;
                    </p>
                  </div>
                )}

                {/* Action Strip or Status Indicator */}
                <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {isAwaitingDocketing ? (
                    <>
                      <div className="text-xs text-purple-800 font-medium flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-purple-600" />
                        <span>Action Required: Issue Folio number, dispatch dual acknowledgment receipt, and route to Registrar.</span>
                      </div>

                      <button
                        onClick={() => handleStartDocket(app)}
                        className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
                      >
                        <Stamp className="w-4 h-4" />
                        <span>Acknowledge & Assign Folio to Forward to Registrar</span>
                      </button>
                    </>
                  ) : (
                    <div className="w-full flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1.5 font-medium text-purple-900">
                        <CheckCircle2 className="w-4 h-4 text-purple-600" />
                        Docketed under Folio: <strong className="font-mono font-bold text-purple-700">{app.registryDocketNumber}</strong>
                        {app.registryAcknowledgedAt && (
                          <span className="text-gray-400 font-normal ml-1">
                            ({new Date(app.registryAcknowledgedAt).toLocaleDateString()})
                          </span>
                        )}
                        · Forwarded to Office of the University Registrar
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

      {/* Docketing Modal */}
      {docketingApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-gray-100">
            <div className="border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                  <Stamp className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-black text-gray-900">
                    Registry Folio Docketing & Forwarding
                  </h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    Ref: {docketingApp.referenceNumber}
                  </p>
                </div>
              </div>
            </div>

            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDocket} className="space-y-4">
              <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-200/70 text-xs text-purple-950 space-y-1">
                <p className="font-bold">Subject: {docketingApp.subject}</p>
                <p className="text-purple-800">
                  Applicant: {docketingApp.applicant?.staffProfile?.surname || ''} ({docketingApp.applicant?.staffProfile?.staffId || 'Staff'})
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Custom Registry Folio Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank for automatic Folio generation (e.g. NOUN/REG/APP/2026/001)"
                  value={folioInput}
                  onChange={(e) => setFolioInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs text-gray-900 font-mono focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  If left blank, the system automatically assigns the next official sequential Registry Folio.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Registry Inward Remarks / Dispatch Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Optional docketing remarks or dispatch instructions for the Registrar's Executive Desk..."
                  value={docketRemarks}
                  onChange={(e) => setDocketRemarks(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setDocketingApp(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-sm transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Stamping Folio & Routing...
                    </>
                  ) : (
                    'Confirm Folio & Forward to Registrar'
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
