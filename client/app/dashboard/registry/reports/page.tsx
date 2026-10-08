'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '../../../../lib/api';
import { 
    FileText, 
    Download, 
    Calendar, 
    Filter, 
    AlertTriangle, 
    ShieldCheck, 
    UserCheck, 
    RefreshCw, 
    FileSpreadsheet, 
    Layers, 
    Clock, 
    ArrowRightLeft, 
    CheckCircle2, 
    XCircle,
    Building2,
    Users,
    FolderPlus,
    History,
    TrendingUp,
    TrendingDown,
    Search,
    ShieldAlert
} from 'lucide-react';
import Button from '../../../../components/ui/Button';
import Pagination from '../../../../components/ui/Pagination';

export default function RegistryAuditReportsPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const [activeReportTab, setActiveReportTab] = useState<'staff-movement' | 'disciplinary-leave'>('staff-movement');
    const [movementSubTab, setMovementSubTab] = useState<'all' | 'new-files' | 'transfers' | 'centers'>('all');

    // Filter states
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [unitId, setUnitId] = useState('');
    const [actionType, setActionType] = useState('');
    const [leaveType, setLeaveType] = useState('');
    const [employmentCategory, setEmploymentCategory] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Organization data for dropdowns
    const [units, setUnits] = useState<any[]>([]);
    const [centers, setCenters] = useState<any[]>([]);

    // Preview data states
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'csv' | null>(null);

    // Pagination states
    const [discPage, setDiscPage] = useState(1);
    const [discPageSize, setDiscPageSize] = useState(10);
    const [staffCreationsPage, setStaffCreationsPage] = useState(1);
    const [staffCreationsPageSize, setStaffCreationsPageSize] = useState(10);
    const [transPage, setTransPage] = useState(1);
    const [transPageSize, setTransPageSize] = useState(10);
    const [centerPage, setCenterPage] = useState(1);
    const [centerPageSize, setCenterPageSize] = useState(10);

    const isAuthorized = user && ['HR_ADMIN', 'REGISTRAR', 'SUPER_USER', 'VICE_CHANCELLOR', 'AUDIT', 'ADMIN', 'REGISTRY_ADMIN'].includes(user.role);

    useEffect(() => {
        if (!authLoading && !isAuthorized) {
            router.push('/dashboard/access-denied');
        }
    }, [user, authLoading, isAuthorized, router]);

    useEffect(() => {
        const fetchOrg = async () => {
            try {
                const res = await api.get('/api/org/structure');
                if (res.data?.units) setUnits(res.data.units);
                if (res.data?.centers) setCenters(res.data.centers);
            } catch (err) {
                console.error('Failed to load org structure', err);
            }
        };
        fetchOrg();
    }, []);

    const fetchReportPreview = async () => {
        if (!isAuthorized) return;
        setLoading(true);
        try {
            const endpoint = activeReportTab === 'disciplinary-leave'
                ? '/api/registry/reports/disciplinary-leave-audit'
                : '/api/registry/reports/staff-movement-audit';

            const params: any = { format: 'json' };
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (unitId) params.unitId = unitId;

            if (activeReportTab === 'disciplinary-leave') {
                if (actionType) params.actionType = actionType;
                if (leaveType) params.leaveType = leaveType;
            } else {
                if (employmentCategory) params.employmentCategory = employmentCategory;
            }

            const { data } = await api.get(endpoint, { params });
            setReportData(data);
        } catch (error: any) {
            console.error('Error fetching report preview:', error);
            alert('Failed to load report data: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReportPreview();
    }, [activeReportTab]);

    const handleExport = async (format: 'pdf' | 'csv') => {
        setDownloadingFormat(format);
        try {
            const endpoint = activeReportTab === 'disciplinary-leave'
                ? '/api/registry/reports/disciplinary-leave-audit'
                : '/api/registry/reports/staff-movement-audit';

            const params: any = { format };
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (unitId) params.unitId = unitId;

            if (activeReportTab === 'disciplinary-leave') {
                if (actionType) params.actionType = actionType;
                if (leaveType) params.leaveType = leaveType;
            } else {
                if (employmentCategory) params.employmentCategory = employmentCategory;
            }

            const response = await api.get(endpoint, {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([response.data], {
                type: format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8;'
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const filename = `${activeReportTab}-audit-report-${new Date().toISOString().split('T')[0]}.${format}`;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error: any) {
            console.error('Download error:', error);
            alert('Failed to download report: ' + (error.response?.data?.message || error.message));
        } finally {
            setDownloadingFormat(null);
        }
    };

    // Filter lists by search query
    const staffCreationsList = useMemo(() => {
        const list = reportData?.staffCreations || [];
        if (!searchQuery) return list;
        const s = searchQuery.toLowerCase();
        return list.filter((item: any) => 
            (item.staffName || '').toLowerCase().includes(s) ||
            (item.staffId || '').toLowerCase().includes(s) ||
            (item.unit || '').toLowerCase().includes(s) ||
            (item.imputerName || '').toLowerCase().includes(s)
        );
    }, [reportData?.staffCreations, searchQuery]);

    const transfersList = useMemo(() => {
        const list = reportData?.transfers || [];
        if (!searchQuery) return list;
        const s = searchQuery.toLowerCase();
        return list.filter((item: any) => 
            (item.staffName || '').toLowerCase().includes(s) ||
            (item.staffId || '').toLowerCase().includes(s) ||
            (item.origin || '').toLowerCase().includes(s) ||
            (item.destination || '').toLowerCase().includes(s) ||
            (item.imputerName || '').toLowerCase().includes(s) ||
            (item.authorizedByName || '').toLowerCase().includes(s)
        );
    }, [reportData?.transfers, searchQuery]);

    const centerSummaryList = useMemo(() => {
        const list = reportData?.centerMovementSummary || [];
        if (!searchQuery) return list;
        const s = searchQuery.toLowerCase();
        return list.filter((item: any) => (item.centerName || '').toLowerCase().includes(s));
    }, [reportData?.centerMovementSummary, searchQuery]);

    const disciplinaryList = useMemo(() => {
        const list = reportData?.disciplinary || [];
        if (!searchQuery) return list;
        const s = searchQuery.toLowerCase();
        return list.filter((item: any) => 
            (item.staffName || '').toLowerCase().includes(s) ||
            (item.staffId || '').toLowerCase().includes(s) ||
            (item.title || '').toLowerCase().includes(s)
        );
    }, [reportData?.disciplinary, searchQuery]);

    // Paginated datasets
    const paginatedStaffCreations = staffCreationsList.slice((staffCreationsPage - 1) * staffCreationsPageSize, staffCreationsPage * staffCreationsPageSize);
    const totalStaffCreationPages = Math.ceil(staffCreationsList.length / staffCreationsPageSize) || 1;

    const paginatedTransfers = transfersList.slice((transPage - 1) * transPageSize, transPage * transPageSize);
    const totalTransPages = Math.ceil(transfersList.length / transPageSize) || 1;

    const paginatedCenters = centerSummaryList.slice((centerPage - 1) * centerPageSize, centerPage * centerPageSize);
    const totalCenterPages = Math.ceil(centerSummaryList.length / centerPageSize) || 1;

    const paginatedDisciplinary = disciplinaryList.slice((discPage - 1) * discPageSize, discPage * discPageSize);
    const totalDiscPages = Math.ceil(disciplinaryList.length / discPageSize) || 1;

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-400/30">
                            <Building2 className="w-7 h-7 text-emerald-300" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Staff File Creation &amp; Transfer Audit Report</h1>
                            <p className="text-slate-300 text-sm mt-0.5">
                                Dedicated statutory registry reporting — Dual-control movement logs, maker-checker clearances, and center inflow/outflow matrix.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary"
                        onClick={() => handleExport('csv')}
                        disabled={downloadingFormat !== null}
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-xs font-semibold"
                    >
                        <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-400" />
                        {downloadingFormat === 'csv' ? 'Exporting CSV...' : 'Export Excel / CSV'}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => handleExport('pdf')}
                        disabled={downloadingFormat !== null}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 text-xs font-semibold"
                    >
                        <Download className="w-4 h-4 mr-1.5" />
                        {downloadingFormat === 'pdf' ? 'Generating PDF...' : 'Download Official PDF'}
                    </Button>
                </div>
            </div>

            {/* Main Report Domain Selector */}
            <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-3 shadow-sm">
                <button
                    onClick={() => { setActiveReportTab('staff-movement'); setMovementSubTab('all'); }}
                    className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold border-b-2 transition-all ${
                        activeReportTab === 'staff-movement'
                            ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                >
                    <ArrowRightLeft className="w-4 h-4" />
                    1. Staff File Creation &amp; Transfer Movement Audit
                </button>
                <button
                    onClick={() => setActiveReportTab('disciplinary-leave')}
                    className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold border-b-2 transition-all ${
                        activeReportTab === 'disciplinary-leave'
                            ? 'border-rose-600 text-rose-700 bg-rose-50/50 rounded-t-lg'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                >
                    <AlertTriangle className="w-4 h-4" />
                    2. Disciplinary Actions &amp; Leave SLA Compliance
                </button>
            </div>

            {/* Fast Filter Bar */}
            <div className="bg-white p-5 rounded-b-xl border border-gray-100 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Directorate / Unit / Center</label>
                        <select
                            value={unitId}
                            onChange={e => setUnitId(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="">All Operational Locations</option>
                            <optgroup label="HQ Directorates & Academic Units">
                                {units.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Study Centers">
                                {centers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    {activeReportTab === 'staff-movement' ? (
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Contract / Employment Type</label>
                            <select
                                value={employmentCategory}
                                onChange={e => setEmploymentCategory(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="">All Employment Categories</option>
                                <option value="PERMANENT">Permanent Staff</option>
                                <option value="CONTRACT">Contract Staff</option>
                                <option value="NYSC_CORPERS">NYSC Corps Members</option>
                                <option value="VOLUNTEER">Volunteers</option>
                            </select>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Disciplinary Action Type</label>
                            <select
                                value={actionType}
                                onChange={e => setActionType(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="">All Disciplinary Records</option>
                                <option value="QUERY">Formal Defense Queries</option>
                                <option value="OFFICIAL_WARNING">Official Warnings / Admonitions</option>
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-3 pt-2">
                    <div className="w-full md:w-72">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, ID, location, or imputer..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setStartDate('');
                                setEndDate('');
                                setUnitId('');
                                setEmploymentCategory('');
                                setActionType('');
                                setSearchQuery('');
                            }}
                            className="text-xs"
                        >
                            Reset Filters
                        </Button>
                        <Button variant="primary" onClick={fetchReportPreview} disabled={loading} className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white">
                            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                            Refresh Live Preview
                        </Button>
                    </div>
                </div>
            </div>

            {/* KPI Summary Cards */}
            {reportData?.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {activeReportTab === 'staff-movement' ? (
                        <>
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">New Files Created</div>
                                <div className="text-2xl font-bold text-slate-900 mt-1">{reportData.summary.totalStaffCreated}</div>
                                <div className="text-xs text-slate-400 mt-0.5">Maker-Checker Onboarded</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
                                <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Permanent Staff Files</div>
                                <div className="text-2xl font-bold text-emerald-700 mt-1">{reportData.summary.permanentStaff}</div>
                                <div className="text-xs text-emerald-400 mt-0.5">Pensionable Dossiers</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Transfer &amp; Posting Logs</div>
                                <div className="text-2xl font-bold text-blue-700 mt-1">{reportData.summary.totalTransfers}</div>
                                <div className="text-xs text-blue-400 mt-0.5">Inter-Center &amp; Unit Postings</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm">
                                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Pending Registrar Queue</div>
                                <div className="text-2xl font-bold text-amber-800 mt-1">{reportData.summary.pendingTransfers}</div>
                                <div className="text-xs text-amber-500 mt-0.5">Awaiting Dual-Control Seal</div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Disciplinary Actions</div>
                                <div className="text-2xl font-bold text-slate-900 mt-1">{reportData.summary.totalDisciplinary}</div>
                                <div className="text-xs text-slate-400 mt-0.5">Queries &amp; Warnings</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm">
                                <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Disciplinary SLA Breaches</div>
                                <div className="text-2xl font-bold text-rose-700 mt-1">{reportData.summary.totalDisciplinaryBreaches}</div>
                                <div className="text-xs text-rose-400 mt-0.5">Defaulted &amp; Unanswered</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Leave Applications</div>
                                <div className="text-2xl font-bold text-slate-900 mt-1">{reportData.summary.totalLeaves}</div>
                                <div className="text-xs text-slate-400 mt-0.5">Total processed requests</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm">
                                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Leave SLA Breaches</div>
                                <div className="text-2xl font-bold text-amber-800 mt-1">{reportData.summary.totalLeaveBreaches}</div>
                                <div className="text-xs text-amber-500 mt-0.5">Resolution &gt; 48 Hours</div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Sub-Tabs for Staff Movement Audit */}
            {activeReportTab === 'staff-movement' && (
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                    <button
                        onClick={() => setMovementSubTab('all')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            movementSubTab === 'all'
                                ? 'bg-white text-emerald-800 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Layers size={14} /> Full Movement Report
                    </button>
                    <button
                        onClick={() => setMovementSubTab('new-files')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            movementSubTab === 'new-files'
                                ? 'bg-white text-emerald-800 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <FolderPlus size={14} /> 1. New Files Created ({staffCreationsList.length})
                    </button>
                    <button
                        onClick={() => setMovementSubTab('transfers')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            movementSubTab === 'transfers'
                                ? 'bg-white text-emerald-800 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <History size={14} /> 2. Transfer &amp; Posting Matrix ({transfersList.length})
                    </button>
                    <button
                        onClick={() => setMovementSubTab('centers')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            movementSubTab === 'centers'
                                ? 'bg-white text-emerald-800 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Building2 size={14} /> 3. Center-by-Center Movement ({centerSummaryList.length})
                    </button>
                </div>
            )}

            {/* Content Tables */}
            <div className="space-y-6">
                {/* SECTION 1: CENTER-BY-CENTER MOVEMENT SUMMARY */}
                {activeReportTab === 'staff-movement' && (movementSubTab === 'all' || movementSubTab === 'centers') && (
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-4 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                                    <Building2 size={15} /> Center-by-Center Inflow &amp; Outflow Movement Summary ({centerSummaryList.length})
                                </h3>
                                <p className="text-[11px] text-emerald-800 mt-0.5">Calculated net personnel shift per Study Center / HQ Directorate.</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-xs">
                                <thead className="bg-slate-50 text-gray-600 font-semibold">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Study Center / Directorate</th>
                                        <th className="px-4 py-3 text-center text-emerald-700">New Files Created</th>
                                        <th className="px-4 py-3 text-center text-blue-700">Transfers In</th>
                                        <th className="px-4 py-3 text-center text-rose-700">Transfers Out</th>
                                        <th className="px-4 py-3 text-center font-bold">Net Delta (+/-)</th>
                                        <th className="px-4 py-3 text-right text-amber-700">Pending Incoming</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {centerSummaryList.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-6 text-gray-400">No center movement records match current filters.</td></tr>
                                    ) : (
                                        paginatedCenters.map((c: any) => (
                                            <tr key={c.centerId} className="hover:bg-slate-50/70">
                                                <td className="px-4 py-3 font-semibold text-gray-900">{c.centerName}</td>
                                                <td className="px-4 py-3 text-center font-semibold text-emerald-700">+{c.newFilesCreated}</td>
                                                <td className="px-4 py-3 text-center font-semibold text-blue-700">+{c.transfersIn}</td>
                                                <td className="px-4 py-3 text-center font-semibold text-rose-700">-{c.transfersOut}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                                                        c.netMovement > 0 
                                                            ? 'bg-emerald-100 text-emerald-800' 
                                                            : c.netMovement < 0 
                                                            ? 'bg-rose-100 text-rose-800' 
                                                            : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {c.netMovement > 0 ? <TrendingUp size={12} /> : c.netMovement < 0 ? <TrendingDown size={12} /> : null}
                                                        {c.netMovement > 0 ? `+${c.netMovement}` : c.netMovement}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-amber-700 font-medium">
                                                    {c.pendingArrivals > 0 ? `${c.pendingArrivals} pending` : '0'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {centerSummaryList.length > 0 && (
                                <Pagination
                                    currentPage={centerPage}
                                    totalPages={totalCenterPages}
                                    totalItems={centerSummaryList.length}
                                    pageSize={centerPageSize}
                                    onPageChange={setCenterPage}
                                    onPageSizeChange={setCenterPageSize}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* SECTION 2: NEW FILES CREATED (MAKER-CHECKER) */}
                {activeReportTab === 'staff-movement' && (movementSubTab === 'all' || movementSubTab === 'new-files') && (
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <FolderPlus size={15} /> 1. New Staff Files Created &amp; Maker-Checker Clearances ({staffCreationsList.length})
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Full audit log: Timestamp, Imputer Name, Registrar Authorization Date, Contract Type, Starting Step, Level, Cadre.
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-xs">
                                <thead className="bg-slate-50 text-gray-600 font-semibold">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Timestamp</th>
                                        <th className="px-4 py-3 text-left">Staff Name &amp; ID</th>
                                        <th className="px-4 py-3 text-left">Unit / Center</th>
                                        <th className="px-4 py-3 text-left">Contract / Category</th>
                                        <th className="px-4 py-3 text-left">Starting Grade &amp; Step</th>
                                        <th className="px-4 py-3 text-left">Imputer Name</th>
                                        <th className="px-4 py-3 text-left">Registrar Auth Date</th>
                                        <th className="px-4 py-3 text-right">Account Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {staffCreationsList.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center py-6 text-gray-400">No staff file creation records found for selected period.</td></tr>
                                    ) : (
                                        paginatedStaffCreations.map((s: any) => (
                                            <tr key={s.id} className="hover:bg-slate-50/70">
                                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(s.createdAt).toLocaleDateString()}</td>
                                                <td className="px-4 py-3 font-semibold text-gray-900">
                                                    {s.staffName} <span className="text-gray-400 font-normal">({s.staffId})</span>
                                                    <div className="text-[10px] text-gray-500 font-normal">{s.rank}</div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">{s.unit}</td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                                                        {s.employmentCategory}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-800 font-medium">
                                                    {s.level || 'Standard'} / Step {s.step || '1'}
                                                    <div className="text-[10px] text-gray-400">{s.cadre}</div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">{s.imputerName}</td>
                                                <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">
                                                    {s.registrarAuthorizationDate}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        s.accountStatus === 'CLEARED_ACTIVE' || s.accountStatus === 'ACTIVE'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : s.accountStatus === 'PENDING_REGISTRAR_CLEARANCE'
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : 'bg-rose-100 text-rose-800'
                                                    }`}>
                                                        {s.accountStatus}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {staffCreationsList.length > 0 && (
                                <Pagination
                                    currentPage={staffCreationsPage}
                                    totalPages={totalStaffCreationPages}
                                    totalItems={staffCreationsList.length}
                                    pageSize={staffCreationsPageSize}
                                    onPageChange={setStaffCreationsPage}
                                    onPageSizeChange={setStaffCreationsPageSize}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* SECTION 3: TRANSFER & POSTING MATRIX */}
                {activeReportTab === 'staff-movement' && (movementSubTab === 'all' || movementSubTab === 'transfers') && (
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <History size={15} /> 2. Staff Transfer &amp; Posting Matrix (Dual-Control Audit) ({transfersList.length})
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Origin-to-destination logs, authorizer signature/ref, duration at previous post, and pending transfer queues.
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-xs">
                                <thead className="bg-slate-50 text-gray-600 font-semibold">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Staff Name &amp; ID</th>
                                        <th className="px-4 py-3 text-left">Rank</th>
                                        <th className="px-4 py-3 text-left">Origin ➔ Destination</th>
                                        <th className="px-4 py-3 text-left">Duration at Prev Post</th>
                                        <th className="px-4 py-3 text-left">Imputer</th>
                                        <th className="px-4 py-3 text-left">Authorizing Registrar &amp; Signature</th>
                                        <th className="px-4 py-3 text-left">Effective Date</th>
                                        <th className="px-4 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {transfersList.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center py-6 text-gray-400">No transfer/posting records found for selected period.</td></tr>
                                    ) : (
                                        paginatedTransfers.map((t: any) => (
                                            <tr key={t.id} className="hover:bg-slate-50/70">
                                                <td className="px-4 py-3 font-semibold text-gray-900">
                                                    {t.staffName} <span className="text-gray-400 font-normal">({t.staffId})</span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">{t.rank}</td>
                                                <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">
                                                    {t.origin} <span className="text-emerald-600 font-bold">➔</span> {t.destination}
                                                </td>
                                                <td className="px-4 py-3 text-indigo-700 font-semibold whitespace-nowrap">
                                                    {t.durationAtPreviousPost}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">{t.imputerName}</td>
                                                <td className="px-4 py-3 text-gray-700">
                                                    <div className="font-medium">{t.authorizedByName}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono">{t.authorizerSignature}</div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{t.effectiveDate}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        t.status === 'APPROVED' || t.status === 'AUTHORIZED'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : t.status === 'PENDING_REGISTRAR_AUTHORIZATION'
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : 'bg-rose-100 text-rose-800'
                                                    }`}>
                                                        {t.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {transfersList.length > 0 && (
                                <Pagination
                                    currentPage={transPage}
                                    totalPages={totalTransPages}
                                    totalItems={transfersList.length}
                                    pageSize={transPageSize}
                                    onPageChange={setTransPage}
                                    onPageSizeChange={setTransPageSize}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* SECTION 4: DISCIPLINARY & LEAVE SLA RECORDS */}
                {activeReportTab === 'disciplinary-leave' && (
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-4 bg-rose-50/60 border-b border-rose-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold text-rose-950 uppercase tracking-wider flex items-center gap-1.5">
                                    <AlertTriangle size={15} /> Disciplinary Actions &amp; SLA Compliance Audit ({disciplinaryList.length})
                                </h3>
                                <p className="text-[11px] text-rose-800 mt-0.5">Institutional Queries, Official Folio Warnings, and SLA Defense Monitors.</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-xs">
                                <thead className="bg-slate-50 text-gray-600 font-semibold">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Staff Name &amp; ID</th>
                                        <th className="px-4 py-3 text-left">Unit</th>
                                        <th className="px-4 py-3 text-left">Action Type</th>
                                        <th className="px-4 py-3 text-left">Subject</th>
                                        <th className="px-4 py-3 text-left">Status</th>
                                        <th className="px-4 py-3 text-left">SLA Breached</th>
                                        <th className="px-4 py-3 text-left">Issued By</th>
                                        <th className="px-4 py-3 text-right">Date Issued</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {disciplinaryList.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center py-6 text-gray-400">No disciplinary records match current filters.</td></tr>
                                    ) : (
                                        paginatedDisciplinary.map((d: any) => (
                                            <tr key={d.id} className="hover:bg-slate-50/70">
                                                <td className="px-4 py-3 font-semibold text-gray-900">{d.staffName} <span className="text-gray-400 font-normal">({d.staffId})</span></td>
                                                <td className="px-4 py-3 text-gray-600">{d.unit}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        d.actionType === 'QUERY' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {d.actionType === 'QUERY' ? 'Formal Query' : 'Official Warning'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{d.title}</td>
                                                <td className="px-4 py-3">
                                                    <span className="font-semibold text-gray-700">{d.status}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {d.slaBreached ? (
                                                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                                                            <XCircle className="w-3.5 h-3.5" /> YES
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> NO
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">{d.issuedBy}</td>
                                                <td className="px-4 py-3 text-right text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {disciplinaryList.length > 0 && (
                                <Pagination
                                    currentPage={discPage}
                                    totalPages={totalDiscPages}
                                    totalItems={disciplinaryList.length}
                                    pageSize={discPageSize}
                                    onPageChange={setDiscPage}
                                    onPageSizeChange={setDiscPageSize}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
