'use client';

import { useEffect, useState, Fragment } from 'react';
import api from '../../../../lib/api';
import { 
    Search, 
    Calendar, 
    User, 
    Clock, 
    ChevronDown, 
    ChevronUp, 
    Loader2, 
    Filter, 
    ChevronLeft, 
    ChevronRight,
    RefreshCw,
    Info,
    Terminal
} from 'lucide-react';

interface AuditLog {
    id: string;
    userId: string;
    action: string;
    resource: string;
    details: string | null;
    ipAddress: string | null;
    createdAt: string;
    user: {
        id: string;
        name: string | null;
        email: string;
        role: string;
    };
}

interface PaginationData {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function ActivityLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [pagination, setPagination] = useState<PaginationData>({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1
    });
    const [loading, setLoading] = useState(true);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [resourceFilter, setResourceFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [limitFilter, setLimitFilter] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);

    // Available actions & resources for filter options (matching standard ones and database values)
    const actionOptions = [
        'LOGIN', 
        'LOGOUT', 
        'REGISTER', 
        'CREATE', 
        'CREATE_STAFF', 
        'CREATE_FILE', 
        'ADD_EXISTING_FILE', 
        'UPDATE', 
        'DELETE', 
        'VIEW', 
        'DOWNLOAD', 
        'MOVE',
        'LOGIN_2FA',
        'ENABLE_2FA',
        'MANUAL_OVERRIDE'
    ];
    const resourceOptions = [
        'AUTH', 
        'USER', 
        'STAFF', 
        'DOCUMENT', 
        'DOSSIER', 
        'PAYROLL', 
        'LEAVE', 
        'ATTENDANCE',
        'CLINIC'
    ];

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const params: any = {
                page: currentPage,
                limit: limitFilter
            };

            if (searchQuery.trim()) params.search = searchQuery.trim();
            if (actionFilter) params.action = actionFilter;
            if (resourceFilter) params.resource = resourceFilter;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const res = await api.get('/api/system/logs', { params });
            setLogs(res.data.logs || []);
            setPagination(res.data.pagination || {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 1
            });
        } catch (error) {
            console.error('Error loading activity logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = async () => {
        try {
            const res = await api.get('/api/system/audit/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'noun_hrms_compliance_report.csv');
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (error) {
            console.error('Failed to export compliance logs:', error);
            alert('Failed to export compliance logs');
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [currentPage, actionFilter, resourceFilter, limitFilter, startDate, endDate]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setCurrentPage(1);
        fetchLogs();
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setActionFilter('');
        setResourceFilter('');
        setStartDate('');
        setEndDate('');
        setLimitFilter(20);
        setCurrentPage(1);
    };

    const toggleExpandLog = (id: string) => {
        setExpandedLogId(expandedLogId === id ? null : id);
    };

    // Helper to format JSON details nicely
    const formatDetails = (detailsStr: string | null) => {
        if (!detailsStr) return 'No details recorded.';
        try {
            const parsed = JSON.parse(detailsStr);
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            return detailsStr;
        }
    };

    // Helper for action badge styling
    const getActionBadgeClass = (action: string) => {
        const act = action.toUpperCase();
        if (act.includes('CREATE')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        if (act.includes('DELETE')) return 'bg-rose-50 text-rose-700 border-rose-100';
        if (act.includes('UPDATE')) return 'bg-purple-50 text-purple-700 border-purple-100';
        if (act.includes('LOGIN')) return 'bg-blue-50 text-blue-700 border-blue-100';
        if (act.includes('LOGOUT')) return 'bg-amber-50 text-amber-700 border-amber-100';
        if (act.includes('MOVE')) return 'bg-indigo-50 text-indigo-700 border-indigo-100';
        return 'bg-gray-50 text-gray-700 border-gray-200';
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-2xl text-white shadow-lg gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Terminal className="text-blue-400" size={28} /> System Activity Logs
                    </h1>
                    <p className="text-slate-300 text-sm mt-1">Audit trail and security logs tracking administrative changes and user access.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm active:scale-95 duration-100"
                    >
                        Export Compliance Report (CSV)
                    </button>
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="flex items-center gap-2 bg-slate-700/60 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition border border-slate-600 disabled:opacity-50 active:scale-95 duration-100"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
                <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by details, user name, or email..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-50/50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm"
                        >
                            Search
                        </button>
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="border border-gray-250 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-sm transition"
                        >
                            Reset
                        </button>
                    </div>
                </form>

                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-100 text-sm">
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-400" />
                        <span className="font-semibold text-gray-600">Filters:</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Action</span>
                        <select
                            value={actionFilter}
                            onChange={e => { setActionFilter(e.target.value); setCurrentPage(1); }}
                            className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                            <option value="">All Actions</option>
                            {actionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Resource</span>
                        <select
                            value={resourceFilter}
                            onChange={e => { setResourceFilter(e.target.value); setCurrentPage(1); }}
                            className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-semibold text-gray-700 bg-white"
                        >
                            <option value="">All Resources</option>
                            {resourceOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Start Date</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }}
                            className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-semibold text-gray-700 bg-white"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">End Date</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }}
                            className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-semibold text-gray-700 bg-white"
                        />
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Show</span>
                        <select
                            value={limitFilter}
                            onChange={e => { setLimitFilter(parseInt(e.target.value)); setCurrentPage(1); }}
                            className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                            <option value="10">10 rows</option>
                            <option value="20">20 rows</option>
                            <option value="50">50 rows</option>
                            <option value="100">100 rows</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="w-10 px-6 py-4"></th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Resource</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">IP Address</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="text-center py-16">
                                    <div className="flex flex-col items-center gap-2 text-gray-500">
                                        <Loader2 className="animate-spin text-blue-600" size={32} />
                                        <span className="text-sm">Loading activity logs...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-16 text-gray-400">
                                    <Info className="mx-auto text-gray-300 mb-3" size={48} />
                                    <p className="text-lg font-medium">No activity logs found</p>
                                    <p className="text-sm">No log records matched your query parameters.</p>
                                </td>
                            </tr>
                        ) : (
                            logs.map((log) => {
                                const isExpanded = expandedLogId === log.id;
                                return (
                                    <Fragment key={log.id}>
                                        <tr 
                                            onClick={() => toggleExpandLog(log.id)}
                                            className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {isExpanded ? (
                                                    <ChevronUp size={16} className="text-gray-400 mx-auto" />
                                                ) : (
                                                    <ChevronDown size={16} className="text-gray-400 mx-auto" />
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                <div className="flex items-center gap-2">
                                                    <Clock size={14} className="text-gray-400" />
                                                    <span>
                                                        {new Date(log.createdAt).toLocaleString(undefined, {
                                                            dateStyle: 'short',
                                                            timeStyle: 'medium'
                                                        })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getActionBadgeClass(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs border border-slate-200">
                                                        {log.user?.name?.charAt(0) || <User size={12} />}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900">{log.user?.name || 'System User'}</div>
                                                        <div className="text-[10px] text-gray-400 font-medium">{log.user?.email || 'N/A'} • {log.user?.role}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-xs font-semibold">
                                                    {log.resource}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-gray-500">
                                                {log.ipAddress || '127.0.0.1'}
                                            </td>
                                        </tr>

                                        {/* Expandable JSON details panel */}
                                        {isExpanded && (
                                            <tr className="bg-slate-50/50">
                                                <td colSpan={6} className="px-10 py-4 border-l-4 border-blue-500 bg-slate-50/30">
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                                                <Terminal size={12} /> Log Details (Log ID: {log.id})
                                                            </span>
                                                        </div>
                                                        <pre className="text-xs font-mono bg-slate-900 text-slate-200 p-4 rounded-xl overflow-x-auto shadow-inner leading-relaxed">
                                                            {formatDetails(log.details)}
                                                        </pre>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {/* Pagination Controls */}
                {!loading && logs.length > 0 && (
                    <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-150 text-sm">
                        <div className="text-gray-500 font-medium text-xs">
                            Showing <span className="font-bold text-gray-700">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                            <span className="font-bold text-gray-700">
                                {Math.min(pagination.page * pagination.limit, pagination.total)}
                            </span>{' '}
                            of <span className="font-bold text-gray-700">{pagination.total}</span> records
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={pagination.page === 1}
                                className="inline-flex items-center gap-1 bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:hover:bg-white select-none"
                            >
                                <ChevronLeft size={14} /> Previous
                            </button>
                            <div className="flex items-center px-2 text-xs font-semibold text-gray-500">
                                Page {pagination.page} of {pagination.totalPages}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                                disabled={pagination.page === pagination.totalPages}
                                className="inline-flex items-center gap-1 bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:hover:bg-white select-none"
                            >
                                Next <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
