'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Archive, RotateCcw, Lock, ShieldAlert, FolderOpen, Calendar, User } from 'lucide-react';
import api from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';
import { FolderIcon } from '../../../../components/hr/FolderIcon';

interface ArchivedFile {
  id: string;
  staffId: string;
  surname: string;
  otherNames: string;
  title: string | null;
  rank: string | null;
  level: string | null;
  deletedAt: string | null;
  status?: string;
  user: {
    name: string;
    email: string;
    role: string;
  };
  unit: { name: string } | null;
  studyCenter: { name: string } | null;
}

export default function RegistryArchivePage() {
  const router = useRouter();
  const { user } = useAuth();
  
  // Security Code Gate
  const [securityCode, setSecurityCode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  
  // Data States
  const [archivedFiles, setArchivedFiles] = useState<ArchivedFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<ArchivedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Role restriction check
  const isAuthorized = user && ['HR_ADMIN', 'SUPER_USER'].includes(user.role);

  // Load archived files once authenticated
  const fetchArchivedFiles = async (code: string) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/registry/files/archive?code=${encodeURIComponent(code)}`);
      setArchivedFiles(data);
      setFilteredFiles(data);
      setIsAuthenticated(true);
      setAuthError('');
    } catch (err: any) {
      console.error(err);
      setAuthError(err.response?.data?.message || 'Access Denied. Incorrect security code.');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle Search & Status filtering
  useEffect(() => {
    const term = search.toLowerCase().trim();
    let filtered = archivedFiles;

    if (term) {
      filtered = filtered.filter(
        file =>
          file.user.name.toLowerCase().includes(term) ||
          (file.staffId && file.staffId.toLowerCase().includes(term))
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(
        file => (file.status || 'ACTIVE').toUpperCase() === statusFilter.toUpperCase()
      );
    }

    setFilteredFiles(filtered);
  }, [search, statusFilter, archivedFiles]);

  const handleSecuritySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (securityCode.trim() !== 'NOUN2026') {
      setAuthError('Incorrect security code. Access denied.');
      return;
    }
    fetchArchivedFiles(securityCode.trim());
  };

  const handleRestoreFile = async (file: ArchivedFile) => {
    const activeCode = securityCode;
    if (!confirm(`Are you sure you want to restore the staff file for ${file.user.name}? This will restore their active portal status.`)) {
      return;
    }

    setRestoringId(file.id);
    try {
      await api.post(`/api/registry/files/archive/${file.id}/restore`, {
        code: activeCode
      });
      alert('Staff file successfully restored.');
      // Refresh list
      fetchArchivedFiles(activeCode);
    } catch (err: any) {
      alert('Failed to restore staff file: ' + (err.response?.data?.message || err.message));
    } finally {
      setRestoringId(null);
    }
  };

  // 1. Role-check: Access Denied
  if (user && !isAuthorized) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-20 text-center bg-white rounded-2xl border border-red-100 shadow-md">
        <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-650 mb-6">
          The File Registry Archive is restricted to HR Administrators and Super Users only.
        </p>
        <button 
          onClick={() => router.push('/dashboard')}
          className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // 2. Authentication lockscreen gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-150 shadow-xl p-8 w-full max-w-md">
          <div className="h-12 w-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100">
            <Lock size={24} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-1">Archive Security Gate</h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            Enter the authorized security code to access archived staff files.
          </p>
          
          {authError && (
            <div className="bg-red-50 border border-red-150 text-red-700 p-3 rounded-xl text-xs mb-4 text-center">
              {authError}
            </div>
          )}

          <form onSubmit={handleSecuritySubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Security Code</label>
              <input
                type="password"
                required
                className="w-full border p-3 rounded-xl mt-1 focus:ring-2 focus:ring-blue-100 outline-none text-black text-center tracking-widest font-mono text-lg"
                placeholder="••••••••"
                value={securityCode}
                onChange={(e) => setSecurityCode(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-900 hover:bg-blue-850 text-white rounded-xl font-bold transition-colors shadow-sm text-sm"
            >
              {loading ? 'Authenticating...' : 'Unlock Archive'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={() => router.push('/dashboard/hr/files')} 
          className="flex items-center text-gray-500 hover:text-blue-700 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to File Registry
        </button>
        <div className="text-xs font-mono text-gray-500 bg-gray-250/30 px-3 py-1 rounded border">
          Security Mode: ACTIVE
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Archive className="text-gray-500" /> Registry Archive
        </h1>
        <p className="text-sm text-gray-500">
          View historically archived staff files and restore active status.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search archived files by Name or Staff ID..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-blue-100 text-black"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter selection menu */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-shrink-0">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Reason:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-medium text-gray-750 bg-white"
          >
            <option value="">All Reasons</option>
            <option value="RETIRED">Retired</option>
            <option value="DECEASED">Deceased</option>
            <option value="RESIGNED">Resigned</option>
            <option value="FIRED">Fired</option>
          </select>
        </div>
      </div>

      {/* Grid of Archived Folders */}
      {filteredFiles.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200 py-20">
          <FolderOpen size={48} className="text-gray-300 mb-2" />
          <p className="text-sm">No archived files found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFiles.map(file => {
            const designationParts = [];
            if (file.rank) designationParts.push(file.rank);
            if (file.level) designationParts.push(`Level ${file.level}`);
            const designation = designationParts.join(' - ') || 'Staff';

            return (
              <div 
                key={file.id} 
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group"
              >
                {/* Header folder indicator */}
                <div className="flex gap-4 items-start mb-4">
                  <div className="opacity-45 select-none pointer-events-none">
                    <FolderIcon 
                      staffName="" 
                      staffId="" 
                      createdAt="" 
                      createdBy="" 
                      color="blue" 
                      role="" 
                      designation="" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">
                      {file.title ? `${file.title} ` : ''}{file.user.name}
                    </h3>
                    <p className="text-xs text-gray-500 font-mono truncate">{file.staffId || 'NO ID'}</p>
                    <p className="text-xs text-gray-600 truncate mt-1">{designation}</p>
                  </div>
                </div>

                {/* Details list */}
                <div className="text-xs text-gray-500 space-y-1.5 mb-4 border-t pt-3 border-gray-100">
                  <div className="flex justify-between">
                    <span>Placement:</span>
                    <span className="font-medium text-gray-800 truncate max-w-[180px]">
                      {file.unit?.name || file.studyCenter?.name || 'HQ'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Archive Status:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border uppercase tracking-wider ${
                      file.status === 'RETIRED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      file.status === 'DECEASED' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                      file.status === 'RESIGNED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      file.status === 'FIRED' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-gray-50 text-gray-650 border-gray-200'
                    }`}>
                      {file.status || 'Archived'}
                    </span>
                  </div>
                  {file.deletedAt && (
                    <div className="flex justify-between items-center text-red-650">
                      <span className="flex items-center gap-1"><Calendar size={12} /> Archived on:</span>
                      <span className="font-medium">{new Date(file.deletedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Action button */}
                <button
                  onClick={() => handleRestoreFile(file)}
                  disabled={restoringId === file.id}
                  className="w-full py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCcw size={14} />
                  {restoringId === file.id ? 'Restoring...' : 'Restore to Registry'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
