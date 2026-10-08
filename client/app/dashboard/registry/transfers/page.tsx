'use client';

import { useState, useEffect } from 'react';
import api from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';
import { 
    ArrowRight, 
    Calendar, 
    History, 
    Plus, 
    Search, 
    ChevronLeft, 
    ChevronRight, 
    ArrowUpDown, 
    Filter, 
    RotateCcw,
    CheckCircle2,
    Clock,
    Download,
    XCircle,
    ShieldCheck,
    AlertTriangle,
    FileText,
    Banknote
} from 'lucide-react';
import TransferStaffModal from '../../../../components/dashboard/TransferStaffModal';
import Button from '../../../../components/ui/Button';

export default function TransferHistoryPage() {
    const { user } = useAuth();
    const [transfers, setTransfers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Active View Tab: 'ALL' or 'PENDING_REGISTRAR'
    const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING_REGISTRAR'>('ALL');

    // Filter, Search, Sort, Pagination States
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterLocation, setFilterLocation] = useState('');
    const [sortBy, setSortBy] = useState('date_desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    // Action State (Authorize / Reject)
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectTransferId, setRejectTransferId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const isRegistrarOrAdmin = user && ['REGISTRAR', 'SUPER_USER', 'VICE_CHANCELLOR'].includes(user.role);

    const fetchHistory = async () => {
        try {
            const { data } = await api.get('/api/registry/transfers');
            setTransfers(data || []);
        } catch (error) {
            console.error('Failed to fetch transfers', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    // Reset to page 1 on filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [search, filterStatus, filterLocation, sortBy, activeTab]);

    const handleAuthorize = async (transferId: string) => {
        if (!confirm('Are you sure you want to authorize and execute this staff posting order? This will atomically update the staff placement, generate their posting order with digital seal, and notify all parties.')) return;

        setActionLoadingId(transferId);
        try {
            await api.post(`/api/registry/transfers/${transferId}/authorize`, {});
            alert('Transfer authorization complete. Posting order sealed and activated.');
            await fetchHistory();
        } catch (error: any) {
            console.error('Authorization failed:', error);
            alert('Failed to authorize transfer: ' + (error.response?.data?.message || error.message));
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRejectSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rejectTransferId || !rejectionReason.trim()) return;

        setActionLoadingId(rejectTransferId);
        try {
            await api.post(`/api/registry/transfers/${rejectTransferId}/reject`, { reason: rejectionReason });
            alert('Transfer posting request rejected.');
            setRejectModalOpen(false);
            setRejectTransferId(null);
            setRejectionReason('');
            await fetchHistory();
        } catch (error: any) {
            console.error('Rejection failed:', error);
            alert('Failed to reject transfer: ' + (error.response?.data?.message || error.message));
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDownloadLetter = async (transferId: string, staffName: string) => {
        try {
            const response = await api.get(`/api/registry/transfers/${transferId}/letter`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Posting-Order-${staffName.replace(/\s+/g, '_')}-${transferId.substring(0, 8)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error: any) {
            console.error('Failed to download posting letter:', error);
            alert('Failed to download posting order letter.');
        }
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading transfer history...</div>;

    // Derived unique locations list
    const uniqueLocations = Array.from(
        new Set(
            transfers.flatMap(t => [t.oldCenterId, t.newCenterId, t.oldUnit?.name, t.newUnit?.name]).filter(Boolean)
        )
    ).sort();

    const pendingRegistrarCount = transfers.filter(t => t.status === 'PENDING_REGISTRAR_AUTHORIZATION').length;

    // Filtered & Sorted Transfers list
    const filteredTransfers = transfers
        .filter(t => {
            if (activeTab === 'PENDING_REGISTRAR') {
                if (t.status !== 'PENDING_REGISTRAR_AUTHORIZATION') return false;
            }

            const matchesSearch = 
                (t.staff?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                (t.staff?.email || '').toLowerCase().includes(search.toLowerCase()) ||
                (t.reason || '').toLowerCase().includes(search.toLowerCase()) ||
                (t.postingOrderRefNumber || '').toLowerCase().includes(search.toLowerCase());
            
            const matchesStatus = 
                filterStatus === 'ALL' ? true :
                filterStatus === 'APPROVED' ? t.status === 'APPROVED' || t.applied === true :
                filterStatus === 'PENDING_REGISTRAR' ? t.status === 'PENDING_REGISTRAR_AUTHORIZATION' :
                filterStatus === 'REJECTED' ? t.status === 'REJECTED' : true;
            
            const matchesLocation = 
                !filterLocation ? true :
                t.oldCenterId === filterLocation || t.newCenterId === filterLocation ||
                t.oldUnit?.name === filterLocation || t.newUnit?.name === filterLocation;

            return matchesSearch && matchesStatus && matchesLocation;
        })
        .sort((a, b) => {
            if (sortBy === 'date_desc') {
                return new Date(b.effectiveDate || b.createdAt).getTime() - new Date(a.effectiveDate || a.createdAt).getTime();
            }
            if (sortBy === 'date_asc') {
                return new Date(a.effectiveDate || a.createdAt).getTime() - new Date(b.effectiveDate || b.createdAt).getTime();
            }
            if (sortBy === 'name_asc') {
                return (a.staff?.name || '').localeCompare(b.staff?.name || '');
            }
            if (sortBy === 'name_desc') {
                return (b.staff?.name || '').localeCompare(a.staff?.name || '');
            }
            return 0;
        });

    // Pagination Calculations
    const totalItems = filteredTransfers.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const paginatedTransfers = filteredTransfers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleResetFilters = () => {
        setSearch('');
        setFilterStatus('ALL');
        setFilterLocation('');
        setSortBy('date_desc');
        setCurrentPage(1);
    };

    const isFiltersActive = search || filterStatus !== 'ALL' || filterLocation || sortBy !== 'date_desc';

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-12">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-gradient-to-r from-blue-900 to-indigo-950 p-6 rounded-2xl text-white shadow-lg">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <History size={24} className="text-blue-300" />
                        Staff Postings & Transfers
                    </h1>
                    <p className="text-sm text-blue-100 mt-1">
                        Maker-Checker (Imputer-Authorizer) dual-control workflow for institutional redeployments and postings.
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 text-sm font-semibold shadow-md transition-all hover:scale-105 active:scale-95"
                >
                    <Plus size={18} />
                    Impute New Staff Transfer
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-gray-200 bg-white rounded-t-xl px-4 pt-3 shadow-sm">
                <button
                    onClick={() => setActiveTab('ALL')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                        activeTab === 'ALL'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                >
                    <History size={16} /> All Postings & History ({transfers.length})
                </button>
                <button
                    onClick={() => setActiveTab('PENDING_REGISTRAR')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                        activeTab === 'PENDING_REGISTRAR'
                            ? 'border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-lg'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                >
                    <Clock size={16} className="text-amber-500" />
                    Pending Registrar Authorization
                    {pendingRegistrarCount > 0 && (
                        <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                            {pendingRegistrarCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Controls / Filters Bar */}
            <div className="bg-white rounded-b-2xl border border-gray-150 p-4 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search staff, email, reason, posting ref..."
                            className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-gray-50/50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-blue-100 text-sm text-black"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Filter by Status */}
                    <div className="flex items-center gap-2">
                        <select
                            className="w-full p-2.5 border rounded-xl text-sm bg-gray-50/50 text-black outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="ALL">All Authorization Statuses</option>
                            <option value="APPROVED">Authorized & Active</option>
                            <option value="PENDING_REGISTRAR">Pending Registrar Authorization</option>
                            <option value="REJECTED">Rejected by Registrar</option>
                        </select>
                    </div>

                    {/* Filter by Location */}
                    <div className="flex items-center gap-2">
                        <select
                            className="w-full p-2.5 border rounded-xl text-sm bg-gray-50/50 text-black outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                            value={filterLocation}
                            onChange={(e) => setFilterLocation(e.target.value)}
                        >
                            <option value="">All Origins & Destinations</option>
                            {uniqueLocations.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                            ))}
                        </select>
                    </div>

                    {/* Sort Order */}
                    <div className="flex items-center gap-2">
                        <select
                            className="w-full p-2.5 border rounded-xl text-sm bg-gray-50/50 text-black outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="date_desc">Effective Date (Newest)</option>
                            <option value="date_asc">Effective Date (Oldest)</option>
                            <option value="name_asc">Staff Name (A - Z)</option>
                            <option value="name_desc">Staff Name (Z - A)</option>
                        </select>
                    </div>
                </div>

                {isFiltersActive && (
                    <div className="flex justify-end pt-1">
                        <button
                            onClick={handleResetFilters}
                            className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 transition-colors"
                        >
                            <RotateCcw size={13} />
                            Reset active filters
                        </button>
                    </div>
                )}
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50/70">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Effective Date
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Staff Details
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Placement Relocation
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Dual-Control Audit
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-150">
                            {paginatedTransfers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                        <History size={40} className="mx-auto mb-2 text-gray-300" />
                                        No transfer records found matching the criteria.
                                    </td>
                                </tr>
                            ) : (
                                paginatedTransfers.map((log) => {
                                    const originName = log.oldUnit?.name || log.oldCenterId || 'Unassigned';
                                    const destName = log.newUnit?.name || log.newCenterId || 'Unknown';
                                    const isPendingAuth = log.status === 'PENDING_REGISTRAR_AUTHORIZATION';
                                    const isApproved = log.status === 'APPROVED' || log.applied === true;

                                    return (
                                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-gray-900 font-medium">
                                                    <Calendar size={14} className="text-gray-400" />
                                                    {log.effectiveDate ? new Date(log.effectiveDate).toLocaleDateString() : 'Immediate'}
                                                </div>
                                                {log.postingOrderRefNumber && (
                                                    <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                                                        Ref: {log.postingOrderRefNumber}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-gray-900">
                                                    {log.staff?.name || 'Staff Member'}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {log.staff?.email || ''}
                                                </div>
                                                {log.relocationAllowance && (
                                                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <Banknote size={10} /> Relocation Allowance: ₦{(log.relocationAllowanceAmount || 0).toLocaleString()}
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-gray-800">
                                                    <span className="font-medium text-gray-600">{originName}</span>
                                                    <ArrowRight size={14} className="text-blue-500 flex-shrink-0" />
                                                    <span className="font-bold text-blue-900">{destName}</span>
                                                </div>
                                                {log.reason && (
                                                    <div className="text-xs text-gray-500 mt-1 line-clamp-1 italic">
                                                        &ldquo;{log.reason}&rdquo;
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="text-xs text-gray-600">
                                                    <span className="text-gray-400">Imputer:</span> {log.initiatedBy?.name || 'HR Admin'}
                                                </div>
                                                <div className="text-xs text-gray-600 mt-0.5">
                                                    <span className="text-gray-400">Authorizer:</span>{' '}
                                                    {log.authorizedBy?.name ? (
                                                        <span className="text-emerald-700 font-medium">{log.authorizedBy.name}</span>
                                                    ) : (
                                                        <span className="text-amber-600 italic">Pending Registrar</span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {isApproved ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <CheckCircle2 size={12} /> Authorized & Active
                                                    </span>
                                                ) : isPendingAuth ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                        <Clock size={12} className="animate-spin" /> Pending Registrar
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                        <XCircle size={12} /> Rejected
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {isPendingAuth && isRegistrarOrAdmin && (
                                                        <>
                                                            <button
                                                                onClick={() => handleAuthorize(log.id)}
                                                                disabled={actionLoadingId === log.id}
                                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm transition"
                                                            >
                                                                {actionLoadingId === log.id ? 'Authorizing...' : 'Authorize'}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setRejectTransferId(log.id);
                                                                    setRejectModalOpen(true);
                                                                }}
                                                                disabled={actionLoadingId === log.id}
                                                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition"
                                                            >
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}

                                                    {isApproved && (
                                                        <button
                                                            onClick={() => handleDownloadLetter(log.id, log.staff?.name || 'Staff')}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition"
                                                            title="Download Official Posting Order Letter PDF"
                                                        >
                                                            <Download size={12} /> Letter
                                                        </button>
                                                    )}
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
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-150 bg-gray-50/50">
                        <div className="text-xs text-gray-500">
                            Showing <span className="font-semibold">{Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}</span> to{' '}
                            <span className="font-semibold">{Math.min(totalItems, currentPage * itemsPerPage)}</span> of{' '}
                            <span className="font-semibold">{totalItems}</span> transfers
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 border rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 transition"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-xs font-semibold text-gray-700">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="p-2 border rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 transition"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Rejection Modal */}
            {rejectModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3 text-rose-600">
                            <AlertTriangle size={24} />
                            <h3 className="text-lg font-bold">Reject Staff Posting Request</h3>
                        </div>
                        <p className="text-xs text-gray-600">
                            Please provide a formal justification for rejecting this transfer order. The imputer and registry folios will be notified.
                        </p>
                        <form onSubmit={handleRejectSubmit} className="space-y-4">
                            <textarea
                                required
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                rows={3}
                                placeholder="Enter reason for rejection..."
                                className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none text-black"
                            />
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="secondary"
                                    type="button"
                                    onClick={() => {
                                        setRejectModalOpen(false);
                                        setRejectTransferId(null);
                                        setRejectionReason('');
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    type="submit"
                                    disabled={actionLoadingId !== null}
                                >
                                    Confirm Rejection
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Transfer Staff Modal */}
            {showModal && (
                <TransferStaffModal
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        setShowModal(false);
                        fetchHistory();
                    }}
                />
            )}
        </div>
    );
}
