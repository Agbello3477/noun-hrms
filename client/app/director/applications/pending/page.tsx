'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import ApplicationStatusBadge from '@/components/applications/ApplicationStatusBadge';
import ApplicationDetailsModal from '@/components/applications/ApplicationDetailsModal';

export default function DirectorPendingApplicationsPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Action Modal State
  const [actionApp, setActionApp] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'RECOMMEND' | 'REWRITE' | 'REJECT' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadDirectorQueue();
  }, []);

  const loadDirectorQueue = async () => {
    try {
      setLoading(true);
      let res;
      try {
        res = await api.get('/api/v1/applications/director-queue');
      } catch {
        try {
          res = await api.get('/api/v1/applications/director/queue');
        } catch {
          res = await api.get('/api/applications/director-queue');
        }
      }
      if (res.data?.success) {
        setQueue(res.data.data || res.data.applications || []);
      }
    } catch (err) {
      console.error('Failed to load director queue:', err);
    } finally {
      setLoading(false);
    }
  };

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

      if (res.data?.success) {
        setActionApp(null);
        setActionType(null);
        await loadDirectorQueue();
      } else {
        setActionError(res.data?.error || 'Action processing failed.');
      }
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300">
              Tier-2 Institutional Gate
            </span>
            <span className="text-xs text-gray-500 font-medium">Directorate Vetting Cockpit</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Pending Staff Applications</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review, endorse with statutory minutes, request rewrites, or reject submissions before onward routing to the Registry Inward Desk.
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-extrabold text-blue-600">{queue.length}</span>
          <p className="text-xs text-gray-400 uppercase font-semibold">In Vetting Queue</p>
        </div>
      </div>

      {/* Queue List */}
      {loading ? (
        <div className="flex justify-center items-center h-48 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 text-gray-500 text-sm">
            <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Loading directorate queue...
          </div>
        </div>
      ) : queue.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
            ✓
          </div>
          <h3 className="text-base font-semibold text-gray-800">No applications pending vetting</h3>
          <p className="text-sm text-gray-500 mt-1">
            All institutional applications routed to your Directorate have been processed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {queue.map((app) => {
            const applicant = app.applicant?.staffProfile;
            const applicantName = applicant
              ? `${applicant.firstName} ${applicant.lastName}`
              : app.applicant?.email;

            return (
              <div
                key={app.id}
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:border-gray-300 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {app.referenceNumber}
                    </span>
                    <ApplicationStatusBadge status={app.status} />
                    <span className="text-xs text-gray-400">
                      Submitted: {new Date(app.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedApp(app);
                      setIsDetailsModalOpen(true);
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded transition-colors"
                  >
                    Examine Dossier
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <h3 className="text-base font-bold text-gray-900">{app.subject}</h3>
                    <p className="text-xs text-gray-600 line-clamp-3 bg-slate-50 p-3 rounded border border-slate-100 font-sans">
                      {app.content}
                    </p>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
                    <p className="text-gray-500 font-semibold uppercase text-[10px]">Staff Profile</p>
                    <p className="font-bold text-gray-900 text-sm">{applicantName}</p>
                    <p className="text-gray-600">ID: {applicant?.staffNumber || 'N/A'}</p>
                    <p className="text-gray-600">Dept: {applicant?.department?.name || 'N/A'}</p>
                    <p className="text-gray-600">Unit: {applicant?.unit?.name || 'N/A'}</p>
                  </div>
                </div>

                {/* Director Statutory Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleOpenAction(app, 'REJECT')}
                    className="px-3.5 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                  >
                    Reject Application
                  </button>
                  <button
                    onClick={() => handleOpenAction(app, 'REWRITE')}
                    className="px-3.5 py-1.5 text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                  >
                    Return for Rewrite
                  </button>
                  <button
                    onClick={() => handleOpenAction(app, 'RECOMMEND')}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <span>✓</span> Endorse & Recommend to Registry
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Execution Modal */}
      {actionApp && actionType && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {actionType === 'RECOMMEND' && 'Endorse & Recommend to Registry Inward Desk'}
                {actionType === 'REWRITE' && 'Return Application for Rewrite / Corrections'}
                {actionType === 'REJECT' && 'Decline / Reject Application'}
              </h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                Ref: {actionApp.referenceNumber} · {actionApp.subject}
              </p>
            </div>

            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {actionError}
              </div>
            )}

            <form onSubmit={handleExecuteAction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-sans"
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
                  className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  aria-busy={actionLoading}
                  className={`px-5 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors flex items-center gap-2 ${
                    actionType === 'RECOMMEND'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : actionType === 'REWRITE'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
