'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, Plus, ChevronRight, Users, UserCheck, UserX, Loader2, History, FileText, X, FileCheck } from 'lucide-react';
import api from '../../../../lib/api';
import AddStaffModal from '../../../../components/dashboard/AddStaffModal';
import Pagination from '../../../../components/ui/Pagination';
import TransferHistoryTab from '../../../../components/hr/dossier/TransferHistoryTab';
import DigitalDossier from '../../../../components/dashboard/DigitalDossier';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';

interface Staff {
    id: string;
    name: string;
    email: string;
    role: string;
    staffProfile?: {
        id?: string;
        staffId?: string;
        department?: string;
        rank?: string;
        cadre?: string;
        phone?: string;
        unit?: { name: string };
        studyCenter?: { name: string };
        status?: string;
    };
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const ROLE_COLORS: Record<string, string> = {
    STAFF: 'bg-slate-100 text-slate-700',
    UNIT_HEAD: 'bg-purple-100 text-purple-700',
    UNIT_ADMIN: 'bg-indigo-100 text-indigo-700',
    STUDY_CENTER_MANAGER: 'bg-blue-100 text-blue-700',
    HR_ADMIN: 'bg-rose-100 text-rose-700',
    SUPER_USER: 'bg-red-100 text-red-700',
    VICE_CHANCELLOR: 'bg-amber-100 text-amber-800',
    BURSARY: 'bg-green-100 text-green-700',
    AUDIT: 'bg-cyan-100 text-cyan-700',
};

export default function UnitStaffPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ON_LEAVE'>('ALL');
    const [showModal, setShowModal] = useState(false);
    const [selectedStaffForModal, setSelectedStaffForModal] = useState<Staff | null>(null);
    const [activeDirectorTab, setActiveDirectorTab] = useState<'transfers' | 'dossier'>('transfers');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        if (user && !['UNIT_HEAD', 'UNIT_ADMIN', 'STUDY_CENTER_MANAGER', 'HR_ADMIN', 'ADMIN', 'SUPER_USER', 'VICE_CHANCELLOR'].includes(user.role)) {
            router.push('/dashboard/access-denied');
        }
    }, [user, router]);

    const fetchUnitStaff = async () => {
        try {
            const response = await api.get('/api/staff/unit');
            setStaffList(response.data);
        } catch (error) {
            console.error('Failed to fetch unit staff', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUnitStaff();
    }, []);

    // Reset to page 1 on search/filter change
    useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);

    const filteredStaff = useMemo(() =>
        staffList.filter((s) => {
            const matchesSearch =
                s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.staffProfile?.staffId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.staffProfile?.rank?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'ON_LEAVE' && s.staffProfile?.status === 'ON_LEAVE') ||
                (statusFilter === 'ACTIVE' && s.staffProfile?.status !== 'ON_LEAVE');
            return matchesSearch && matchesStatus;
        }),
        [staffList, searchTerm, statusFilter]
    );

    const totalPages = Math.max(1, Math.ceil(filteredStaff.length / pageSize));
    const paginatedStaff = filteredStaff.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const activeCount = staffList.filter(s => s.staffProfile?.status !== 'ON_LEAVE').length;
    const onLeaveCount = staffList.filter(s => s.staffProfile?.status === 'ON_LEAVE').length;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Unit Staff</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage all staff members within your unit or study centre</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
                >
                    <Plus size={18} /> Add New Staff
                </button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Users size={20} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900">{staffList.length}</p>
                        <p className="text-xs text-gray-500 font-medium">Total Staff</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                        <UserCheck size={20} className="text-green-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
                        <p className="text-xs text-gray-500 font-medium">Active</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <UserX size={20} className="text-orange-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900">{onLeaveCount}</p>
                        <p className="text-xs text-gray-500 font-medium">On Leave</p>
                    </div>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                    <input
                        type="text"
                        placeholder="Search by name, email, staff ID or rank…"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    {(['ALL', 'ACTIVE', 'ON_LEAVE'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setStatusFilter(f)}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                                statusFilter === f
                                    ? f === 'ALL'
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : f === 'ACTIVE'
                                        ? 'bg-green-600 text-white border-green-600 shadow-sm'
                                        : 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {f === 'ALL' ? 'All' : f === 'ACTIVE' ? 'Active' : 'On Leave'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-100">
                                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-500">Staff Member</th>
                                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-500">Staff ID</th>
                                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-500">Role</th>
                                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-500">Unit / Centre</th>
                                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-500">Rank</th>
                                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-500">Status</th>
                                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-2 text-gray-400">
                                            <Loader2 size={28} className="animate-spin text-blue-500" />
                                            <span className="text-sm">Loading staff data…</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedStaff.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-2 text-gray-400">
                                            <Users size={32} className="text-gray-200" />
                                            <p className="text-sm font-medium text-gray-500">No staff members found</p>
                                            <p className="text-xs text-gray-400">Try adjusting your search or filter</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedStaff.map((staff, idx) => {
                                    const isOnLeave = staff.staffProfile?.status === 'ON_LEAVE';
                                    const initials = staff.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';
                                    const roleColor = ROLE_COLORS[staff.role] || 'bg-gray-100 text-gray-700';
                                    return (
                                        <tr
                                            key={staff.id}
                                            className={`group transition-colors hover:bg-blue-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                                        >
                                            {/* Staff Member */}
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                                        {initials}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-900 truncate max-w-[160px]">{staff.name}</p>
                                                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{staff.email}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Staff ID */}
                                            <td className="px-5 py-3.5">
                                                <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                                                    {staff.staffProfile?.staffId || '—'}
                                                </span>
                                            </td>

                                            {/* Role */}
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${roleColor}`}>
                                                    {staff.role.replace(/_/g, ' ')}
                                                </span>
                                            </td>

                                            {/* Unit / Centre */}
                                            <td className="px-5 py-3.5 text-gray-600 max-w-[150px]">
                                                <span className="truncate block text-sm">
                                                    {staff.staffProfile?.unit?.name || staff.staffProfile?.studyCenter?.name || '—'}
                                                </span>
                                            </td>

                                            {/* Rank */}
                                            <td className="px-5 py-3.5 text-gray-600 text-sm">
                                                {staff.staffProfile?.rank || '—'}
                                            </td>

                                            {/* Status */}
                                            <td className="px-5 py-3.5">
                                                {isOnLeave ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-100">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
                                                        On Leave
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                                        Active
                                                    </span>
                                                )}
                                            </td>

                                            {/* Action */}
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedStaffForModal(staff);
                                                            setActiveDirectorTab('transfers');
                                                        }}
                                                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg border border-indigo-200 shadow-2xs transition"
                                                    >
                                                        <History size={13} />
                                                        Dossier &amp; History
                                                    </button>
                                                    <Link
                                                        href={`/dashboard/staff/${staff.id}`}
                                                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition"
                                                    >
                                                        Profile <ChevronRight size={13} />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && filteredStaff.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredStaff.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(size: number) => { setPageSize(size); setCurrentPage(1); }}
                        pageSizeOptions={PAGE_SIZE_OPTIONS}
                    />
                )}
            </div>

            {/* Add Staff Modal */}
            {showModal && (
                <AddStaffModal
                    onClose={() => setShowModal(false)}
                    onSuccess={fetchUnitStaff}
                />
            )}

            {/* Director Personnel Modal: Posting & Transfer History vs Digital Dossier & Credentials */}
            {selectedStaffForModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 duration-200 border border-slate-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                    {selectedStaffForModal.name?.charAt(0) || 'S'}
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                        <span>{selectedStaffForModal.name}</span>
                                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                            {selectedStaffForModal.staffProfile?.staffId || 'NO ID'}
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Directorate Staff Audit &bull; {selectedStaffForModal.staffProfile?.rank || selectedStaffForModal.role} &bull; {selectedStaffForModal.staffProfile?.unit?.name || selectedStaffForModal.staffProfile?.studyCenter?.name || 'Unit'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedStaffForModal(null)}
                                className="p-1.5 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Navigation Tab Switcher */}
                        <div className="flex border-b border-slate-100 bg-slate-50/60 px-6 pt-2 gap-2">
                            <button
                                onClick={() => setActiveDirectorTab('transfers')}
                                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                                    activeDirectorTab === 'transfers'
                                        ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <History size={14} />
                                <span>Posting &amp; Transfer History</span>
                            </button>
                            <button
                                onClick={() => setActiveDirectorTab('dossier')}
                                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                                    activeDirectorTab === 'dossier'
                                        ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <FileText size={14} />
                                <span>Digital Dossier &amp; Credentials</span>
                            </button>
                        </div>

                        {/* Modal Content Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Metadata Summary Banner */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Unit / Department</span>
                                    <span className="text-xs font-bold text-slate-800 mt-1 block truncate">
                                        {selectedStaffForModal.staffProfile?.unit?.name || 'Unassigned Unit'}
                                    </span>
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Study Centre</span>
                                    <span className="text-xs font-bold text-slate-800 mt-1 block truncate">
                                        {selectedStaffForModal.staffProfile?.studyCenter?.name || 'HQ'}
                                    </span>
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Current Status</span>
                                    <span className="text-xs font-bold text-emerald-700 mt-1 block">
                                        {selectedStaffForModal.staffProfile?.status === 'ON_LEAVE' ? 'On Approved Leave' : 'Active Duty'}
                                    </span>
                                </div>
                            </div>

                            {/* Tab Content */}
                            {activeDirectorTab === 'transfers' ? (
                                <div className="animate-in fade-in duration-200">
                                    <TransferHistoryTab staffId={selectedStaffForModal.id || selectedStaffForModal.staffProfile?.id || ''} />
                                </div>
                            ) : (
                                <div className="animate-in fade-in duration-200">
                                    <DigitalDossier
                                        staffId={selectedStaffForModal.staffProfile?.id || selectedStaffForModal.id}
                                        staffName={selectedStaffForModal.name}
                                        readOnly={true}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 border-t border-slate-100 px-6 py-3.5 flex justify-end">
                            <button
                                onClick={() => setSelectedStaffForModal(null)}
                                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors shadow-2xs"
                            >
                                Close Modal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
