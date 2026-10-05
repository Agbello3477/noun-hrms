'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import ApplicationStatusBadge from '@/components/applications/ApplicationStatusBadge';
import ApplicationDetailsModal from '@/components/applications/ApplicationDetailsModal';

export default function RegistrarApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Executive Determination Modal
  const [decisionApp, setDecisionApp] = useState<any | null>(null);
  const [decisionType, setDecisionType] = useState<'APPROVED' | 'DECLINED' | null>(null);
  const [executiveMinute, setExecutiveMinute] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRegistrarQueue();
  }, []);

  const loadRegistrarQueue = async () => {
    try {
      setLoading(true);
      let res;
      try {
        res = await api.get('/api/v1/applications/registrar/queue');
      } catch {
        try {
          res = await api.get('/api/v1/applications/registrar-queue');
        } catch {
          res = await api.get('/api/applications/registrar-queue');
        }
      }
      if (res.data?.success) {
        setApplications(res.data.data || res.data.applications || []);
      }
    } catch (err) {
      console.error('Failed to load registrar docket:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDecision = (app: any, type: 'APPROVED' | 'DECLINED') => {
    setDecisionApp(app);
    setDecisionType(type);
    setExecutiveMinute('');
    setError(null);
  };

  const handleExecuteDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionApp || !decisionType) return;

    if (!executiveMinute.trim()) {
      setError('An official Registrar minute / executive directive is mandatory.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const trimmedRemarks = executiveMinute.trim();
      const res = await api.post(`/api/v1/applications/${decisionApp.id}/registrar-decision`, {
        decision: decisionType,
        remarks: trimmedRemarks,
        registrarRemarks: trimmedRemarks
      });

      if (res.data?.success) {
        setDecisionApp(null);
        setDecisionType(null);
        await loadRegistrarQueue();
      } else {
        setError(res.data?.error || 'Executive decision processing failed.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Executive decision failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-950 p-6 rounded-xl text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Tier-4 Final Institutional Authority
            </span>
            <span className="text-xs text-emerald-200">Office of the University Registrar</span>
          </div>
          <h1 className="text-2xl font-bold mt-1">Executive Application Docket</h1>
          <p className="text-sm text-emerald-100/80 mt-1 max-w-2xl">
            Adjudicate statutory staff applications endorsed through Directorate and docketed by Registry Inward Desk. Final decisions are permanently committed to the University Registry Master Archive.
          </p>
        </div>
        <div className="text-right bg-white/10 px-4 py-2.5 rounded-lg border border-white/10 backdrop-blur-sm">
          <span className="text-3xl font-black text-emerald-400">{applications.length}</span>
          <p className="text-[11px] text-emerald-200 uppercase font-semibold">Awaiting Determination</p>
        </div>
      </div>

      {/* Queue List */}
      {loading ? (
        <div className="flex justify-center items-center h-48 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 text-gray-500 text-sm">
            <span className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            Loading registrar executive docket...
          </div>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
            ✓
          </div>
          <h3 className="text-base font-semibold text-gray-800">No applications pending executive determination</h3>
          <p className="text-sm text-gray-500 mt-1">
            All docketed institutional applications have received final decisions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const applicant = app.applicant?.staffProfile;
            const applicantName = applicant
              ? `${applicant.firstName} ${applicant.lastName}`
              : app.applicant?.email;

            const director = app.director?.staffProfile;
            const directorName = director
              ? `${director.firstName} ${director.lastName}`
              : app.director?.email;

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
                    {app.registryDocketNumber && (
                      <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        Folio: {app.registryDocketNumber}
                      </span>
                    )}
                    <ApplicationStatusBadge status={app.status} />
                    <span className="text-xs text-gray-400">
                      Docketed: {app.registryAcknowledgedAt ? new Date(app.registryAcknowledgedAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedApp(app);
                      setIsDetailsModalOpen(true);
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded transition-colors"
                  >
                    Examine Full Dossier
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-3">
                    <h3 className="text-base font-bold text-gray-900">{app.subject}</h3>
                    
                    {/* Director Endorsement */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs">
                      <span className="font-bold text-amber-900">
                        Director Endorsement ({directorName}):
                      </span>
                      <p className="text-amber-950 italic mt-0.5">&ldquo;{app.directorRemarks || 'Recommended.'}&rdquo;</p>
                    </div>

                    <div className="text-xs text-gray-600 line-clamp-3 bg-slate-50 p-3 rounded border border-slate-100">
                      {app.content}
                    </div>
                  </div>

                  <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
                    <p className="text-gray-500 font-semibold uppercase text-[10px]">Staff Details</p>
                    <p className="font-bold text-gray-900 text-sm">{applicantName}</p>
                    <p className="text-gray-600">ID: {applicant?.staffNumber || 'N/A'}</p>
                    <p className="text-gray-600">Dept: {applicant?.department?.name || 'N/A'}</p>
                    <p className="text-gray-600">Unit: {applicant?.unit?.name || 'N/A'}</p>
                  </div>
                </div>

                {/* Registrar Executive Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleOpenDecision(app, 'DECLINED')}
                    className="px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                  >
                    Decline Application
                  </button>
                  <button
                    onClick={() => handleOpenDecision(app, 'APPROVED')}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <span>✓</span> Grant Executive Approval
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decision Modal */}
      {decisionApp && decisionType && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {decisionType === 'APPROVED' ? 'Grant University Registrar Approval' : 'Decline Application'}
              </h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                Folio: {decisionApp.registryDocketNumber || decisionApp.referenceNumber} · {decisionApp.subject}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleExecuteDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Registrar&apos;s Minute & Directive *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={
                    decisionType === 'APPROVED'
                      ? 'e.g. Approved. Establishment division to formalize posting notice in accordance with University Regulations.'
                      : 'Provide statutory grounds and administrative directives regarding this determination...'
                  }
                  value={executiveMinute}
                  onChange={(e) => setExecutiveMinute(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 font-sans"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setDecisionApp(null);
                    setDecisionType(null);
                  }}
                  disabled={submitting}
                  className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  aria-busy={submitting}
                  className={`px-5 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors flex items-center gap-2 ${
                    decisionType === 'APPROVED'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-rose-700 hover:bg-rose-800'
                  }`}
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Committing Executive Order...
                    </>
                  ) : decisionType === 'APPROVED' ? (
                    'Confirm Approval & Archive'
                  ) : (
                    'Confirm Decline & Archive'
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
