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
    Clock
} from 'lucide-react';
import TransferStaffModal from '../../../../components/dashboard/TransferStaffModal';

export default function TransferHistoryPage() {
    const { user } = useAuth();
    const [transfers, setTransfers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Filter, Search, Sort, Pagination States
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterLocation, setFilterLocation] = useState('');
    const [sortBy, setSortBy] = useState('date_desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    const fetchHistory = async () => {
        try {
            const { data } = await api.get('/api/registry/transfers');
            setTransfers(data);
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
    }, [search, filterStatus, filterLocation, sortBy]);

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading transfer history...</div>;

    // Derived unique locations list
    const uniqueLocations = Array.from(
        new Set(
            transfers.flatMap(t => [t.oldCenterId, t.newCenterId]).filter(Boolean)
        )
    ).sort();

    // Filtered & Sorted Transfers list
    const filteredTransfers = transfers
        .filter(t => {
            const matchesSearch = 
                (t.staff?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                (t.staff?.email || '').toLowerCase().includes(search.toLowerCase()) ||
                (t.reason || '').toLowerCase().includes(search.toLowerCase());
            
            const matchesStatus = 
                filterStatus === 'ALL' ? true :
                filterStatus === 'APPLIED' ? t.applied === true :
                filterStatus === 'PENDING' ? t.applied === false : true;
            
            const matchesLocation = 
                !filterLocation ? true :
                t.oldCenterId === filterLocation || t.newCenterId === filterLocation;

            return matchesSearch && matchesStatus && matchesLocation;
        })
        .sort((a, b) => {
            if (sortBy === 'date_desc') {
                return new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime();
            }
            if (sortBy === 'date_asc') {
                return new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime();
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
        <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-950 flex items-center gap-2">
                        <History size={24} className="text-blue-700" />
                        Transfer & Postings Log
                    </h1>
                    <p className="text-sm text-gray-500">
                        View, search, and manage staff postings, study center relocations, and transfer timelines.
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 text-sm font-semibold shadow-sm transition-all hover:shadow-md"
                >
                    <Plus size={18} />
                    New Staff Transfer
                </button>
            </div>

            {/* Premium Controls / Filters Bar */}
            <div className="bg-white rounded-2xl border border-gray-150 p-4 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by staff, email, reason..."
                            className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-gray-50/50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-blue-100 text-sm text-black"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Filter by Status */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider hidden xl:inline">Status:</span>
                        <select
                            className="w-full p-2.5 border rounded-xl text-sm bg-gray-50/50 text-black outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="APPLIED">Applied / Complete</option>
                            <option value="PENDING">Pending Activation</option>
                        </select>
                    </div>

                    {/* Filter by Location */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider hidden xl:inline">Location:</span>
                        <select
                            className="w-full p-2.5 border rounded-xl text-sm bg-gray-50/50 text-black outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                            value={filterLocation}
                            onChange={(e) => setFilterLocation(e.target.value)}
                        >
                            <option value="">All Locations</option>
                            {uniqueLocations.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                            ))}
                        </select>
                    </div>

                    {/* Sort Order */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider hidden xl:inline">Sort:</span>
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

                {/* Reset Filters Option */}
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
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50/70">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-550 uppercase tracking-wider">
                                    Effective Date
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-550 uppercase tracking-wider">
                                    Staff Details
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-550 uppercase tracking-wider">
                                    Placement Relocation
                                </th>
                                <th scope="col" className="px-6 py-4 scope-col text-left text-xs font-semibold text-gray-550 uppercase tracking-wider">
                                    Reason / Description
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-550 uppercase tracking-wider">
                                    Initiated By
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-550 uppercase tracking-wider">
                                    Transfer Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-150">
                            {paginatedTransfers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-450 text-sm">
                                        <History size={40} className="mx-auto mb-2 text-gray-300" />
                                        No transfer records found matching the criteria.
                                    </td>
                                </tr>
                            ) : (
                                paginatedTransfers.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                        {/* Date */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={15} className="text-gray-400" />
                                                {new Date(log.effectiveDate).toLocaleDateString(undefined, {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                        </td>

                                        {/* Staff Details */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-bold text-sm mr-3">
                                                    {log.staff?.name?.charAt(0) || 'S'}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900">{log.staff?.name || 'Unknown Staff'}</div>
                                                    <div className="text-xs text-gray-550">{log.staff?.email}</div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Movement */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-800 whitespace-normal">
                                                <span className="bg-gray-100 text-gray-700 py-1 px-2.5 rounded-lg text-xs font-medium max-w-[200px] break-words">
                                                    {log.oldCenterId || 'Unassigned'}
                                                </span>
                                                <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                                                <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 py-1 px-2.5 rounded-lg text-xs font-medium max-w-[200px] break-words">
                                                    {log.newCenterId}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Reason */}
                                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-normal break-words max-w-[280px]">
                                            {log.reason || 'No reason specified'}
                                        </td>

                                        {/* Initiator */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-550 font-medium">
                                            {log.initiatedBy?.name || 'System / Auto'}
                                        </td>

                                        {/* Transfer Status */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {log.applied ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                    <CheckCircle2 size={13} />
                                                    Active / Applied
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                                                    <Clock size={13} />
                                                    Pending Login
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
							)}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="bg-gray-50/50 border-t border-gray-150 px-6 py-4 flex items-center justify-between">
                        <div className="text-xs font-medium text-gray-550">
                            Showing <span className="font-semibold text-gray-800">{Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}</span> to{' '}
                            <span className="font-semibold text-gray-800">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{' '}
                            <span className="font-semibold text-gray-800">{totalItems}</span> entries
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="h-8 px-2.5 border rounded-lg flex items-center justify-center text-gray-650 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-xs font-semibold gap-1"
                            >
                                <ChevronLeft size={14} />
                                Previous
                            </button>
                            
                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => (
                                    <button
                                        key={pageNumber}
                                        onClick={() => setCurrentPage(pageNumber)}
                                        className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
                                            currentPage === pageNumber
                                                ? 'bg-blue-700 text-white shadow-sm'
                                                : 'text-gray-650 hover:bg-gray-100 border border-transparent'
                                        }`}
                                    >
                                        {pageNumber}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="h-8 px-2.5 border rounded-lg flex items-center justify-center text-gray-650 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-xs font-semibold gap-1"
                            >
                                Next
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Transfer staff modal */}
            {showModal && (
                <TransferStaffModal
                    onClose={() => setShowModal(false)}
                    onSuccess={fetchHistory}
                />
            )}
        </div>
    );
}
