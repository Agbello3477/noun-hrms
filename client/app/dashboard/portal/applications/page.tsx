'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import ApplicationStatusBadge from '@/components/applications/ApplicationStatusBadge';
import ApplicationProgressStepper from '@/components/applications/ApplicationProgressStepper';
import ApplicationDetailsModal from '@/components/applications/ApplicationDetailsModal';
import NewApplicationModal from '@/components/applications/NewApplicationModal';

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Resubmit drawer state
  const [resubmittingApp, setResubmittingApp] = useState<any | null>(null);
  const [resubmitContent, setResubmitContent] = useState('');
  const [resubmitComments, setResubmitComments] = useState('');
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);

  useEffect(() => {
    loadMyApplications();
  }, []);

  const loadMyApplications = async () => {
    try {
      setLoading(true);
      let res;
      try {
        res = await api.get('/api/v1/applications/my-applications');
      } catch {
        res = await api.get('/api/applications/my-applications');
      }
      if (res.data?.success) {
        setApplications(res.data.data || res.data.applications || []);
      }
    } catch (err) {
      console.error('Failed to load my applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = (app: any) => {
    setSelectedApp(app);
    setIsDetailsModalOpen(true);
  };

  const handleStartResubmit = (app: any) => {
    setResubmittingApp(app);
    setResubmitContent(app.content || '');
    setResubmitComments('');
    setResubmitError(null);
  };

  const handleExecuteResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resubmittingApp) return;

    try {
      setIsResubmitting(true);
      setResubmitError(null);
      const res = await api.post(`/api/v1/applications/${resubmittingApp.id}/resubmit`, {
        content: resubmitContent,
        comments: resubmitComments
      });

      if (res.data?.success) {
        setResubmittingApp(null);
        await loadMyApplications();
      } else {
        setResubmitError(res.data?.error || 'Failed to resubmit application.');
      }
    } catch (err: any) {
      setResubmitError(err?.response?.data?.error || err.message || 'Resubmission failed');
    } finally {
      setIsResubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applicant Workspace</h1>
          <p className="text-sm text-gray-500 mt-1">
            Statutory &ldquo;Through-Director-to-Registrar&rdquo; applications, endorsements, and real-time status tracking.
          </p>
        </div>
        <button
          onClick={() => setIsNewModalOpen(true)}
          className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Application
        </button>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="flex justify-center items-center h-48 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 text-gray-500 text-sm">
            <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Loading your applications...
          </div>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-800">No applications on file</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            You have not submitted any formal applications through your Director yet.
          </p>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm"
          >
            Create Your First Application
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:border-gray-300 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-4">
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
                    Submitted: {new Date(app.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenDetails(app)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors"
                  >
                    View Dossier
                  </button>
                  {app.status === 'RETURNED_FOR_REWRITE' && (
                    <button
                      onClick={() => handleStartResubmit(app)}
                      className="text-xs font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded transition-colors"
                    >
                      Edit & Resubmit
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900">{app.subject}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Category: <span className="font-medium text-gray-700">{app.category ? String(app.category).replace(/_/g, ' ') : 'General Application'}</span> · 
                  Director: <span className="font-medium text-gray-700">{app.director?.staffProfile ? `${app.director.staffProfile.firstName || ''} ${app.director.staffProfile.lastName || ''}`.trim() : app.director?.name || app.director?.email || 'Directorate'}</span>
                </p>
              </div>

              {/* Progress Stepper inline */}
              <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                <ApplicationProgressStepper status={app.status} />
              </div>

              {/* Alert banner if returned for rewrite */}
              {app.status === 'RETURNED_FOR_REWRITE' && app.directorRemarks && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  <span className="font-bold">Director Request for Revision:</span> &ldquo;{app.directorRemarks}&rdquo;
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resubmit Modal */}
      {resubmittingApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Revise & Resubmit Application</h3>
                <p className="text-xs text-gray-500 font-mono">{resubmittingApp.referenceNumber}</p>
              </div>
              <button
                onClick={() => setResubmittingApp(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {resubmitError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-xs">
                {resubmitError}
              </div>
            )}

            <form onSubmit={handleExecuteResubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Updated Application Content *
                </label>
                <textarea
                  required
                  rows={8}
                  value={resubmitContent}
                  onChange={(e) => setResubmitContent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Notes / Response to Director
                </label>
                <input
                  type="text"
                  placeholder="e.g. Attached requested admission letter and adjusted resumption dates."
                  value={resubmitComments}
                  onChange={(e) => setResubmitComments(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setResubmittingApp(null)}
                  disabled={isResubmitting}
                  className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResubmitting}
                  aria-busy={isResubmitting}
                  className="px-5 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  {isResubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Resubmitting...
                    </>
                  ) : (
                    'Resubmit to Director'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Modal */}
      <NewApplicationModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={() => loadMyApplications()}
      />

      {/* Details Modal */}
      <ApplicationDetailsModal
        application={selectedApp}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
      />
    </div>
  );
}
