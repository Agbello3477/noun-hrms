'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import ApplicationStatusBadge from '@/components/applications/ApplicationStatusBadge';
import ApplicationDetailsModal from '@/components/applications/ApplicationDetailsModal';

export default function RegistryInwardDocketPage() {
  const [filter, setFilter] = useState<'AWAITING' | 'DOCKETED'>('AWAITING');
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Docketing Action
  const [docketingId, setDocketingId] = useState<string | null>(null);
  const [folioInput, setFolioInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadRegistryQueue();
  }, [filter]);

  const loadRegistryQueue = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/v1/applications/registry/queue?filter=${filter}`);
      if (res.data?.success) {
        setApplications(res.data.applications || []);
      }
    } catch (err) {
      console.error('Failed to load registry queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDocket = (app: any) => {
    setDocketingId(app.id);
    setFolioInput('');
    setActionError(null);
  };

  const handleConfirmDocket = async (appId: string) => {
    try {
      setIsSubmitting(true);
      setActionError(null);

      const payload: any = {};
      if (folioInput.trim()) {
        payload.customFolioNumber = folioInput.trim();
      }

      const res = await api.post(`/api/v1/applications/${appId}/registry-acknowledge`, payload);

      if (res.data?.success) {
        setDocketingId(null);
        setFolioInput('');
        await loadRegistryQueue();
      } else {
        setActionError(res.data?.error || 'Docket acknowledgment failed.');
      }
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err.message || 'Docket acknowledgment failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-purple-100 text-purple-800 border border-purple-300">
              Tier-3 Registry Gate
            </span>
            <span className="text-xs text-gray-500 font-medium">Inward Application Desk</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Registry Inward Docket & Folio Desk</h1>
          <p className="text-sm text-gray-500 mt-1">
            Formally acknowledge directorate-endorsed applications, assign statutory Registry Folio numbers, and dispatch acknowledgment receipts.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setFilter('AWAITING')}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${
              filter === 'AWAITING'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Awaiting Docketing
          </button>
          <button
            onClick={() => setFilter('DOCKETED')}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${
              filter === 'DOCKETED'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Docketed & Forwarded
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {actionError}
        </div>
      )}

      {/* Queue List */}
      {loading ? (
        <div className="flex justify-center items-center h-48 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 text-gray-500 text-sm">
            <span className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            Loading registry inward desk...
          </div>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 mx-auto flex items-center justify-center mb-3">
            ✓
          </div>
          <h3 className="text-base font-semibold text-gray-800">
            {filter === 'AWAITING' ? 'No applications awaiting docketing' : 'No forwarded dockets found'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {filter === 'AWAITING'
              ? 'All directorate-endorsed applications have been assigned folios.'
              : 'Forwarded dockets will appear here once acknowledged.'}
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

            const isBeingDocketed = docketingId === app.id;

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
                      Endorsed by Director: {app.directorRecommendedAt ? new Date(app.directorRecommendedAt).toLocaleDateString() : 'N/A'}
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
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1">
                      <p className="font-bold text-amber-900">
                        Director&apos;s Statutory Endorsement ({directorName}):
                      </p>
                      <p className="text-amber-950 italic">&ldquo;{app.directorRemarks || 'Recommended for registry action.'}&rdquo;</p>
                    </div>
                  </div>

                  <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
                    <p className="text-gray-500 font-semibold uppercase text-[10px]">Staff Details</p>
                    <p className="font-bold text-gray-900 text-sm">{applicantName}</p>
                    <p className="text-gray-600">ID: {applicant?.staffNumber || 'N/A'}</p>
                    <p className="text-gray-600">Dept: {applicant?.department?.name || 'N/A'}</p>
                  </div>
                </div>

                {/* Docket Action Strip */}
                {filter === 'AWAITING' && (
                  <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-end sm:items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">
                      Action will generate formal Folio Number and dual-dispatch acknowledgment receipts.
                    </p>

                    {isBeingDocketed ? (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="text"
                          placeholder="Custom Folio (leave empty for auto)"
                          value={folioInput}
                          onChange={(e) => setFolioInput(e.target.value)}
                          className="px-3 py-1.5 border border-purple-300 rounded text-xs focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleConfirmDocket(app.id)}
                          disabled={isSubmitting}
                          aria-busy={isSubmitting}
                          className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded text-xs font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {isSubmitting ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Generating Folio...
                            </>
                          ) : (
                            'Confirm & Forward'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocketingId(null)}
                          disabled={isSubmitting}
                          className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartDocket(app)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                      >
                        <span>📋</span> Acknowledge & Assign Folio Number
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
