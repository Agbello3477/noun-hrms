'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import ApplicationDetailsModal from '@/components/applications/ApplicationDetailsModal';
import Pagination from '@/components/ui/Pagination';

export default function MasterApplicationArchivePage() {
  const [archives, setArchives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const paginatedArchives = archives.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(archives.length / pageSize) || 1;

  useEffect(() => {
    loadMasterArchive();
  }, [yearFilter, categoryFilter, statusFilter]);

  const loadMasterArchive = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (yearFilter) params.append('year', yearFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (search.trim()) params.append('search', search.trim());

      let res;
      try {
        res = await api.get(`/api/v1/applications/archive/master?${params.toString()}`);
      } catch {
        try {
          res = await api.get(`/api/v1/applications/archive?${params.toString()}`);
        } catch {
          res = await api.get(`/api/applications/archive?${params.toString()}`);
        }
      }
      if (res.data?.success) {
        setArchives(res.data.data || res.data.archives || res.data.applications || []);
      }
    } catch (err) {
      console.error('Failed to load master archive:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadMasterArchive();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
              Statutory Depository
            </span>
            <span className="text-xs text-slate-400">National Open University of Nigeria</span>
          </div>
          <h1 className="text-2xl font-bold mt-1">Registry Master Application Archive</h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            Immutable permanent repository of all institutional applications, directorate endorsements, and registrar executive determinations with full cryptographic audit copies.
          </p>
        </div>
        <div className="text-right bg-slate-800/80 px-4 py-2.5 rounded-lg border border-slate-700">
          <span className="text-3xl font-black text-blue-400">{archives.length}</span>
          <p className="text-[11px] text-slate-400 uppercase font-semibold">Archived Records</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="Search by Folio, Ref No, or Subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white text-gray-700"
          >
            <option value="">All Academic Years</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white text-gray-700"
          >
            <option value="">All Categories</option>
            <option value="POSTING_REQUEST">Posting Request</option>
            <option value="CONCURRENCE">Concurrence</option>
            <option value="STUDY_FELLOWSHIP">Study Fellowship</option>
            <option value="SPECIAL_CLEARANCE">Special Clearance</option>
            <option value="GENERAL_MEMORANDUM">General Memorandum</option>
            <option value="ADMINISTRATIVE_APPEAL">Administrative Appeal</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white text-gray-700"
          >
            <option value="">All Determinations</option>
            <option value="APPROVED">Approved</option>
            <option value="DECLINED">Declined</option>
            <option value="REJECTED_BY_DIRECTOR">Rejected by Director</option>
          </select>
        </div>
      </div>

      {/* Archives Table */}
      {loading ? (
        <div className="flex justify-center items-center h-48 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-3 text-gray-500 text-sm">
            <span className="w-5 h-5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
            Loading archive depository...
          </div>
        </div>
      ) : archives.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500 text-sm">No permanently archived records match your criteria.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                <th className="p-3.5">Folio / Reference</th>
                <th className="p-3.5">Subject & Category</th>
                <th className="p-3.5">Applicant</th>
                <th className="p-3.5">Directorate</th>
                <th className="p-3.5">Final Determination</th>
                <th className="p-3.5">Archived Date</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedArchives.map((item) => {
                const app = item.application;
                const applicant = app?.applicant?.staffProfile;
                const applicantName = applicant
                  ? `${applicant.firstName} ${applicant.lastName}`
                  : app?.applicant?.email || 'N/A';

                const director = app?.director?.staffProfile;
                const directorName = director
                  ? `${director.firstName} ${director.lastName}`
                  : app?.director?.email || 'N/A';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 font-mono">
                      <div className="font-bold text-purple-700">{item.archivedDocketNumber}</div>
                      <div className="text-[11px] text-gray-500">{app?.referenceNumber}</div>
                    </td>
                    <td className="p-3.5 max-w-xs">
                      <div className="font-bold text-gray-900 truncate">{app?.subject}</div>
                      <div className="text-[11px] text-gray-500">{app?.category?.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-medium text-gray-800">{applicantName}</div>
                      <div className="text-[11px] text-gray-500">{applicant?.staffNumber}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="text-gray-700">{directorName}</div>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[10px] uppercase border ${
                          item.finalStatus === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : item.finalStatus === 'DECLINED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {item.finalStatus}
                      </span>
                    </td>
                    <td className="p-3.5 text-gray-500">
                      {new Date(item.archivedAt).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => {
                          const fullApp = {
                            ...(app || {}),
                            id: app?.id || item.id,
                            referenceNumber: app?.referenceNumber || item.archivedDocketNumber || 'N/A',
                            registryDocketNumber: app?.registryDocketNumber || item.archivedDocketNumber,
                            subject: app?.subject || item.subject || 'Archived Institutional Dossier',
                            category: app?.category || 'INSTITUTIONAL_APPLICATION',
                            status: app?.status || (item.finalStatus === 'APPROVED' ? 'APPROVED_BY_REGISTRAR' : item.finalStatus === 'DECLINED' ? 'DECLINED_BY_REGISTRAR' : item.finalStatus || 'APPROVED_BY_REGISTRAR'),
                            content: app?.content || item.content || 'Archived record stored in Registry permanent repository.',
                            attachmentUrls: app?.attachmentUrls || item.attachmentUrls || [],
                            createdAt: app?.createdAt || item.archivedAt,
                            archive: item,
                          };
                          setSelectedApp(fullApp);
                          setIsDetailsModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors shadow-2xs"
                      >
                        Audit Dossier
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={archives.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
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
