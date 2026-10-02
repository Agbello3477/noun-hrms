'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../lib/api';
import { FolderIcon } from '../../../../components/hr/FolderIcon';
import StaffFileForm from '../../../../components/hr/StaffFileForm';
import BatchDossierUploadModal from '../../../../components/dashboard/BatchDossierUploadModal';
import { Search, Plus, FileInput, X, Archive, TrendingUp, ShieldCheck, Clock, CheckCircle2, XCircle, AlertTriangle, FolderUp, PackageCheck, FolderOpen } from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import Button from '../../../../components/ui/Button';

interface FileUser {
    id: string;
    name: string;
    role: string;
    staffProfile: {
        id?: string;
        staffId: string;
        title?: string | null;
        rank?: string | null;
        level?: string | null;
        cadre?: string | null;
        employmentCategory?: string;
        accountStatus?: string;
        isActivated?: boolean;
        createdById: string | null;
        createdBy?: { name: string };
        createdAt: string;
        unit?: { name: string };
        studyCenter?: { name: string };
        queries?: any[];
        fileRequests?: any[];
    };
}

export default function FileRegistryPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [files, setFiles] = useState<FileUser[]>([]);
    const [filteredFiles, setFilteredFiles] = useState<FileUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Tab view: 'ALL' or 'PENDING_CLEARANCE'
    const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING_CLEARANCE'>('ALL');

    // Filters
    const [filterCenter, setFilterCenter] = useState('');
    const [filterUnit, setFilterUnit] = useState(''); // Directorate/Faculty

    // Structure Data for Filters
    const [centers, setCenters] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showExistingModal, setShowExistingModal] = useState(false);
    const [showBatchModal, setShowBatchModal] = useState(false);

    // Clearance Actions
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const isRegistrarOrAdmin = user && ['REGISTRAR', 'SUPER_USER', 'VICE_CHANCELLOR', 'ADMIN'].includes(user.role);

    const fetchData = async () => {
        try {
            const [fileRes, orgRes] = await Promise.all([
                api.get('/api/registry/files'),
                api.get('/api/org/structure')
            ]);

            if (fileRes.data) {
                setFiles(fileRes.data);
                setFilteredFiles(fileRes.data);
                try { sessionStorage.setItem('noun_registry_files_cache', JSON.stringify(fileRes.data)); } catch {}
            }
            if (orgRes.data) {
                setCenters(orgRes.data.centers);
                setUnits(orgRes.data.units);
                try { sessionStorage.setItem('noun_org_structure_cache', JSON.stringify(orgRes.data)); } catch {}
            }
        } catch (error) {
            console.error('Failed to load registry data', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        try {
            const cachedFiles = sessionStorage.getItem('noun_registry_files_cache');
            if (cachedFiles) {
                const parsed = JSON.parse(cachedFiles);
                setFiles(parsed);
                setFilteredFiles(parsed);
                setLoading(false);
            }
            const cachedOrg = sessionStorage.getItem('noun_org_structure_cache');
            if (cachedOrg) {
                const parsed = JSON.parse(cachedOrg);
                setCenters(parsed.centers || []);
                setUnits(parsed.units || []);
            }
        } catch {}

        fetchData();
    }, []);

    // Filter Logic
    useEffect(() => {
        let res = files;

        if (activeTab === 'PENDING_CLEARANCE') {
            res = res.filter(f => f.staffProfile?.accountStatus === 'PENDING_REGISTRAR_CLEARANCE');
        }

        if (search) {
            const lower = search.toLowerCase();
            res = res.filter(f =>
                f.name.toLowerCase().includes(lower) ||
                (f.staffProfile?.staffId || '').toLowerCase().includes(lower)
            );
        }

        if (filterCenter) {
            res = res.filter(f => f.staffProfile?.studyCenter?.name === filterCenter);
        }

        if (filterUnit) {
            res = res.filter(f => f.staffProfile?.unit?.name === filterUnit);
        }

        setFilteredFiles(res);
    }, [search, filterCenter, filterUnit, files, activeTab]);

    const handleClearStaff = async (profileId: string) => {
        if (!confirm('Are you sure you want to clear and activate this staff file? Portal credentials will be activated.')) return;
        setActionLoadingId(profileId);
        try {
            await api.post(`/api/registry/files/${profileId}/clear`, { remarks: 'Registrar dual-control clearance granted' });
            alert('Staff file cleared and activated successfully.');
            await fetchData();
        } catch (error: any) {
            console.error('Clearance error:', error);
            alert('Failed to clear staff file: ' + (error.response?.data?.message || error.message));
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRejectClearance = async (profileId: string) => {
        const remarks = prompt('Please enter reason for rejecting this staff clearance:');
        if (!remarks) return;
        setActionLoadingId(profileId);
        try {
            await api.post(`/api/registry/files/${profileId}/reject`, { remarks });
            alert('Staff file clearance rejected.');
            await fetchData();
        } catch (error: any) {
            console.error('Rejection error:', error);
            alert('Failed to reject clearance: ' + (error.response?.data?.message || error.message));
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleFileCreated = () => {
        setShowCreateModal(false);
        setShowExistingModal(false);
        fetchData(); // Refresh grid
        alert('File action submitted for dual-control clearance.');
    };

    const pendingClearanceCount = files.filter(f => f.staffProfile?.accountStatus === 'PENDING_REGISTRAR_CLEARANCE').length;

    return (
        <div className="p-6 min-h-screen bg-gray-50 flex flex-col pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">File Registry &amp; Maker-Checker Clearance</h2>
                    <p className="text-gray-500 text-sm">Digitized staff files with dual-control Registrar clearance</p>
                </div>
                <div className="flex flex-wrap gap-2.5 items-center">
                    <button
                        onClick={() => router.push('/registry/file-requests/inward')}
                        className="flex items-center gap-2 px-3.5 py-2 border border-emerald-400 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shadow-xs text-sm font-semibold transition"
                    >
                        <FolderOpen size={16} />
                        File Intake &amp; Folio Desk
                    </button>
                    <button
                        onClick={() => router.push('/registry/file-requests/ready-for-dispatch')}
                        className="flex items-center gap-2 px-3.5 py-2 border border-blue-400 bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-xs text-sm font-semibold transition"
                    >
                        <PackageCheck size={16} />
                        File Dispatch &amp; Custody
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/registry/due-for-promotion')}
                        className="flex items-center gap-2 px-4 py-2 border border-emerald-300 text-emerald-800 bg-emerald-50/90 rounded-lg hover:bg-emerald-100 shadow-sm text-sm font-semibold transition"
                    >
                        <TrendingUp size={16} className="text-emerald-700" />
                        Promotion Maturity &amp; Scheduling
                    </button>
                    {['HR_ADMIN', 'REGISTRAR', 'SUPER_USER'].includes(user?.role || '') && (
                        <button
                            onClick={() => router.push('/dashboard/hr/archive')}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 shadow-sm text-sm font-medium"
                        >
                            <Archive size={16} className="text-gray-500" />
                            View Archive
                        </button>
                    )}
                    <button
                        onClick={() => setShowBatchModal(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-800 bg-blue-50/80 hover:bg-blue-100 rounded-lg shadow-sm text-sm font-semibold transition"
                    >
                        <FolderUp size={16} className="text-blue-700" />
                        Batch Dossier Upload
                    </button>
                    <button
                        onClick={() => setShowExistingModal(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm text-sm font-medium"
                    >
                        <FileInput size={16} />
                        Add Existing File
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 shadow-sm text-sm font-medium"
                    >
                        <Plus size={16} />
                        Create New File
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-gray-200 bg-white rounded-t-xl px-4 pt-3 shadow-sm mb-0">
                <button
                    onClick={() => setActiveTab('ALL')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                        activeTab === 'ALL'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                >
                    All Staff Files ({files.length})
                </button>
                <button
                    onClick={() => setActiveTab('PENDING_CLEARANCE')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                        activeTab === 'PENDING_CLEARANCE'
                            ? 'border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-lg'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                >
                    <Clock size={16} className="text-amber-500" />
                    Pending Registrar Clearance
                    {pendingClearanceCount > 0 && (
                        <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                            {pendingClearanceCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-b-xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by Name or Staff ID..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-blue-100"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <select
                    className="p-2 border rounded-lg text-sm bg-gray-50 min-w-[150px]"
                    value={filterCenter}
                    onChange={(e) => setFilterCenter(e.target.value)}
                >
                    <option value="">All Study Centers</option>
                    {centers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>

                <select
                    className="p-2 border rounded-lg text-sm bg-gray-50 min-w-[200px]"
                    value={filterUnit}
                    onChange={(e) => setFilterUnit(e.target.value)}
                >
                    <option value="">All Units / Faculties / Directorates / Departments</option>
                    <optgroup label="Faculties">
                        {units.filter(u => u.type === 'FACULTY').map(u => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                    </optgroup>
                    <optgroup label="Directorates">
                        {units.filter(u => u.type === 'DIRECTORATE').map(u => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                    </optgroup>
                    <optgroup label="Departments">
                        {units.filter(u => u.type === 'DEPARTMENT').map(u => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                    </optgroup>
                </select>
            </div>

            {/* Content Grid */}
            {loading ? (
                <div className="flex-1 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredFiles.length === 0 ? (
                <div className="flex-1 flex flex-col justify-center items-center text-gray-400 py-12">
                    <FolderIcon staffName="No Files" staffId="---" createdAt={new Date().toISOString()} createdBy={null} />
                    <p className="mt-4">No staff files found matching your criteria.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 justify-items-center">
                    {filteredFiles.map(file => {
                        let folderColor: 'blue' | 'yellow' | 'red' = 'blue';
                        const isPendingClearance = file.staffProfile?.accountStatus === 'PENDING_REGISTRAR_CLEARANCE';
                        const hasOpenQuery = file.staffProfile?.queries && file.staffProfile.queries.length > 0;
                        const hasActiveTransfer = file.staffProfile?.fileRequests && file.staffProfile.fileRequests.length > 0;

                        if (hasOpenQuery) {
                            folderColor = 'red';
                        } else if (hasActiveTransfer || isPendingClearance) {
                            folderColor = 'yellow';
                        }

                        const designationParts = [];
                        if (file.staffProfile?.rank) designationParts.push(file.staffProfile.rank);
                        if (file.staffProfile?.level) designationParts.push(`Level ${file.staffProfile.level}`);
                        const designation = designationParts.join(' - ') || 'Staff';

                        return (
                            <div key={file.id} className="flex flex-col items-center group relative w-full">
                                <FolderIcon
                                    staffName={`${file.staffProfile?.title ? file.staffProfile.title + ' ' : ''}${file.name}`}
                                    staffId={(file.staffProfile?.staffId || 'N/A').replace('NOUN/', '')}
                                    createdAt={file.staffProfile?.createdAt}
                                    createdBy={file.staffProfile?.createdBy?.name || null}
                                    color={folderColor}
                                    role={file.role}
                                    designation={designation}
                                    onClick={() => router.push(`/dashboard/hr/files/${file.id}`)}
                                />

                                {isPendingClearance && (
                                    <div className="mt-1 flex flex-col items-center gap-1 w-full px-2">
                                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-center">
                                            Pending Clearance
                                        </span>
                                        {isRegistrarOrAdmin && file.staffProfile?.id && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleClearStaff(file.staffProfile.id!);
                                                    }}
                                                    disabled={actionLoadingId === file.staffProfile.id}
                                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold shadow"
                                                >
                                                    Clear
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRejectClearance(file.staffProfile.id!);
                                                    }}
                                                    disabled={actionLoadingId === file.staffProfile.id}
                                                    className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-bold"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="text-lg font-bold text-gray-800">Create New Staff File (Maker-Checker Staging)</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            <StaffFileForm mode="CREATE" onSuccess={handleFileCreated} onCancel={() => setShowCreateModal(false)} />
                        </div>
                    </div>
                </div>
            )}

            {/* Existing Modal */}
            {showExistingModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="text-lg font-bold text-gray-800">Add Existing Staff File (Maker-Checker Staging)</h3>
                            <button onClick={() => setShowExistingModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            <StaffFileForm mode="EXISTING" onSuccess={handleFileCreated} onCancel={() => setShowExistingModal(false)} />
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Dossier Upload Modal */}
            {showBatchModal && (
                <BatchDossierUploadModal
                    onClose={() => setShowBatchModal(false)}
                    onSuccess={() => {
                        setShowBatchModal(false);
                        fetchData();
                        alert('Batch dossier documents successfully ingested and linked to staff files!');
                    }}
                />
            )}
        </div>
    );
}
