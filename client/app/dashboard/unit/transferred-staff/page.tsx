'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, FileText, ArrowRight, UserCheck, X, History, MapPin, Download, CheckCircle2, Building2 } from 'lucide-react';
import api from '../../../../lib/api';
import DigitalDossier from '../../../../components/dashboard/DigitalDossier';
import TransferHistoryTab from '../../../../components/hr/dossier/TransferHistoryTab';
import Pagination from '../../../../components/ui/Pagination';

interface TransferLogItem {
    id: string;
    effectiveDate: string;
    status: string;
    reason?: string;
    oldLocation?: string;
    newLocation?: string;
    oldUnit?: { id: string; name: string };
    newUnit?: { id: string; name: string };
    authorizedBy?: { id: string; name: string; email: string };
    initiatedBy?: { id: string; name: string };
    digitalSignatureRef?: string;
}

interface Staff {
    id: string; // User UUID
    name: string;
    email: string;
    role: string;
    staffProfile?: {
        id: string; // Profile UUID
        staffId: string; // ID code like N001
        rank: string;
        phone: string;
        unit?: { name: string; code?: string };
        studyCenter?: { name: string; code?: string };
    };
    latestTransfer?: TransferLogItem | null;
    transfers?: TransferLogItem[];
}

export default function TransferredStaffPage() {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
    const [activeModalTab, setActiveModalTab] = useState<'transfers' | 'dossier'>('transfers');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const fetchTransferredStaff = async () => {
        try {
            const response = await api.get('/api/staff/transferred');
            const data = Array.isArray(response.data) ? response.data : [];
            setStaffList(data);
        } catch (error) {
            console.error('Failed to fetch transferred staff', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTransferredStaff(); }, []);
    useEffect(() => { setCurrentPage(1); }, [searchTerm]);

    const filteredStaff = useMemo(() => staffList.filter((staff) => {
        const term = searchTerm.toLowerCase();
        const staffName = (staff.name || '').toLowerCase();
        const staffId = (staff.staffProfile?.staffId || '').toLowerCase();
        const oldLoc = (staff.latestTransfer?.oldLocation || '').toLowerCase();
        const newLoc = (staff.latestTransfer?.newLocation || staff.staffProfile?.unit?.name || staff.staffProfile?.studyCenter?.name || '').toLowerCase();
        return staffName.includes(term) || staffId.includes(term) || oldLoc.includes(term) || newLoc.includes(term);
    }), [staffList, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredStaff.length / pageSize));
    const paginatedStaff = filteredStaff.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handleOpenModal = (staff: Staff, defaultTab: 'transfers' | 'dossier' = 'transfers') => {
        setSelectedStaff(staff);
        setActiveModalTab(defaultTab);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header section with glassmorphic style */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-xl">
                <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
                <div className="relative z-10 space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold backdrop-blur-md border border-indigo-500/30">
                        <UserCheck size={14} />
                        Institutional Placement Audit &bull; Dossier Reference
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Transferred Personnel Directory</h1>
                    <p className="text-indigo-200/80 max-w-2xl text-sm sm:text-base">
                        Comprehensive registry of personnel previously stationed in your Directorate, Faculty, Department, or Study Center with complete posting histories and reference dossiers.
                    </p>
                </div>
            </div>

            {/* Statistics and Search Panel */}
            <div className="grid gap-6 md:grid-cols-4">
                <div className="md:col-span-3 rounded-xl bg-white p-4 shadow-sm border border-slate-100 flex items-center">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by staff name, Staff ID, origin, or destination..."
                            className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
                    <span className="text-2xl font-black text-indigo-600">{staffList.length}</span>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Transferred Personnel</span>
                </div>
            </div>

            {/* Staff list card directory */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <th className="px-6 py-4">Staff Member</th>
                                <th className="px-6 py-4">Staff ID</th>
                                <th className="px-6 py-4">Former Placement</th>
                                <th className="px-6 py-4">Current Duty Station</th>
                                <th className="px-6 py-4">Transfer Date</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                                            <span>Loading transferred personnel records...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredStaff.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center py-6">
                                            <FileText className="h-12 w-12 text-slate-300 mb-2" />
                                            <p className="font-semibold text-slate-700">No transferred personnel records found</p>
                                            <p className="text-xs text-slate-400 mt-1">No former personnel from your unit or center have redeployment logs.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedStaff.map((staff) => {
                                    const latest = staff.latestTransfer;
                                    const oldLoc = latest?.oldLocation || 'Previous Duty Station';
                                    const newLoc = latest?.newLocation || staff.staffProfile?.unit?.name || staff.staffProfile?.studyCenter?.name || 'Assigned';
                                    const transferDateStr = latest?.effectiveDate
                                        ? new Date(latest.effectiveDate).toLocaleDateString('en-NG', { dateStyle: 'medium' })
                                        : 'Recorded';

                                    return (
                                        <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 font-bold text-white shadow-sm">
                                                        {staff.name?.charAt(0) || 'U'}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900">{staff.name}</div>
                                                        <div className="text-xs text-slate-500">{staff.staffProfile?.rank || staff.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-700 font-bold">
                                                {staff.staffProfile?.staffId || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                <div className="flex items-center gap-1.5">
                                                    <Building2 size={14} className="text-slate-400" />
                                                    <span className="text-xs font-medium text-slate-700">{oldLoc}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-100">
                                                    {newLoc}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                                {transferDateStr}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(staff, 'transfers')}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all border border-indigo-200"
                                                        title="View Posting Timeline &amp; Directives"
                                                    >
                                                        <History size={13} />
                                                        <span>Transfer History</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenModal(staff, 'dossier')}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
                                                        title="Reference Digital Dossier"
                                                    >
                                                        <FileText size={13} />
                                                        <span>Dossier</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && filteredStaff.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredStaff.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(s: number) => { setPageSize(s); setCurrentPage(1); }}
                    />
                )}
            </div>

            {/* Dossier & Transfer History Modal Overlay */}
            {selectedStaff && selectedStaff.staffProfile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <UserCheck size={20} className="text-indigo-600" />
                                    <span>Staff Record: {selectedStaff.name}</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    ReadOnly Reference &bull; Staff ID: {selectedStaff.staffProfile.staffId} &bull; Rank: {selectedStaff.staffProfile.rank || 'N/A'}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedStaff(null)}
                                className="p-1.5 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Navigation Tabs */}
                        <div className="flex border-b border-slate-100 bg-slate-50/50 px-6 pt-2">
                            <button
                                onClick={() => setActiveModalTab('transfers')}
                                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                                    activeModalTab === 'transfers'
                                        ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <History size={14} />
                                <span>Posting &amp; Transfer History</span>
                            </button>
                            <button
                                onClick={() => setActiveModalTab('dossier')}
                                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                                    activeModalTab === 'dossier'
                                        ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-sm'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <FileText size={14} />
                                <span>Digital Dossier &amp; Credentials</span>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Metadata summary cards */}
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Former Placement</div>
                                    <div className="text-xs font-bold text-slate-800 mt-1 truncate">
                                        {selectedStaff.latestTransfer?.oldLocation || 'Previous Duty Station'}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Placement</div>
                                    <div className="text-xs font-bold text-indigo-700 mt-1 truncate">
                                        {selectedStaff.latestTransfer?.newLocation || selectedStaff.staffProfile.unit?.name || selectedStaff.staffProfile.studyCenter?.name || '-'}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Phone</div>
                                    <div className="text-xs font-bold text-slate-800 mt-1">{selectedStaff.staffProfile.phone || '-'}</div>
                                </div>
                            </div>

                            {/* Tab Body */}
                            {activeModalTab === 'transfers' ? (
                                <TransferHistoryTab staffId={selectedStaff.id || selectedStaff.staffProfile.id} />
                            ) : (
                                <DigitalDossier 
                                    staffId={selectedStaff.staffProfile.id} 
                                    staffName={selectedStaff.name}
                                    readOnly={true}
                                />
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end">
                            <button
                                onClick={() => setSelectedStaff(null)}
                                className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-bold text-slate-700 transition-colors shadow-sm"
                            >
                                Close Reference
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
