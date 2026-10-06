'use client';

import { useState, useEffect } from 'react';
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
    Users
} from 'lucide-react';
import Button from '../../../../components/ui/Button';
import Pagination from '../../../../components/ui/Pagination';

export default function RegistryAuditReportsPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const [activeReportTab, setActiveReportTab] = useState<'disciplinary-leave' | 'staff-movement'>('disciplinary-leave');

    // Filter states
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [unitId, setUnitId] = useState('');
    const [actionType, setActionType] = useState('');
    const [leaveType, setLeaveType] = useState('');
    const [employmentCategory, setEmploymentCategory] = useState('');

    // Organization data for dropdowns
    const [units, setUnits] = useState<any[]>([]);

    // Preview data states
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'csv' | null>(null);

    // Pagination states
    const [discPage, setDiscPage] = useState(1);
    const [discPageSize, setDiscPageSize] = useState(10);
    const [transPage, setTransPage] = useState(1);
    const [transPageSize, setTransPageSize] = useState(10);

    const disciplinaryList = reportData?.disciplinary || [];
    const paginatedDisciplinary = disciplinaryList.slice((discPage - 1) * discPageSize, discPage * discPageSize);
    const totalDiscPages = Math.ceil(disciplinaryList.length / discPageSize) || 1;

    const transfersList = reportData?.transfers || [];
    const paginatedTransfers = transfersList.slice((transPage - 1) * transPageSize, transPage * transPageSize);
    const totalTransPages = Math.ceil(transfersList.length / transPageSize) || 1;

    const isAuthorized = user && ['HR_ADMIN', 'REGISTRAR', 'SUPER_USER', 'VICE_CHANCELLOR', 'AUDIT', 'ADMIN'].includes(user.role);

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
            alert('Failed to load report data. ' + (error.response?.data?.message || error.message));
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
            alert('Failed to download report. ' + (error.response?.data?.message || error.message));
        } finally {
            setDownloadingFormat(null);
        }
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
                            <FileText className="w-7 h-7 text-indigo-300" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Central Registry Audit Reports</h1>
                            <p className="text-slate-300 text-sm mt-0.5">
                                Official statutory governance, dual-control movements, and disciplinary compliance records.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary"
                        onClick={() => handleExport('csv')}
                        disabled={downloadingFormat !== null}
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200"
                    >
                        <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400" />
                        {downloadingFormat === 'csv' ? 'Exporting CSV...' : 'Export CSV'}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => handleExport('pdf')}
                        disabled={downloadingFormat !== null}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        {downloadingFormat === 'pdf' ? 'Generating PDF...' : 'Download Official PDF'}
                    </Button>
                </div>
            </div>

            {/* Tab Selector */}
            <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-3 shadow-sm">
                <button
                    onClick={() => setActiveReportTab('disciplinary-leave')}
                    className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold border-b-2 transition-all ${
                        activeReportTab === 'disciplinary-leave'
                            ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                >
                    <AlertTriangle className="w-4 h-4" />
                    1. Disciplinary & Leave SLA Audit
                </button>
                <button
                    onClick={() => setActiveReportTab('staff-movement')}
                    className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold border-b-2 transition-all ${
                        activeReportTab === 'staff-movement'
                            ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                >
                    <ArrowRightLeft className="w-4 h-4" />
                    2. Staff Movement & Dual-Control File Audit
                </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-5 rounded-b-xl border border-gray-100 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Directorate / Unit</label>
                        <select
                            value={unitId}
                            onChange={e => setUnitId(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">All Units & Directorates</option>
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>

                    {activeReportTab === 'disciplinary-leave' ? (
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Disciplinary Action Type</label>
                            <select
                                value={actionType}
                                onChange={e => setActionType(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">All Disciplinary Records</option>
                                <option value="QUERY">Formal Queries</option>
                                <option value="OFFICIAL_WARNING">Official Warnings / Admonitions</option>
                            </select>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Employment Category</label>
                            <select
                                value={employmentCategory}
                                onChange={e => setEmploymentCategory(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">All Categories</option>
                                <option value="PERMANENT">Permanent Staff</option>
                                <option value="CONTRACT">Contract Staff</option>
                                <option value="NYSC_CORPERS">NYSC Corps Members</option>
                                <option value="VOLUNTEER">Volunteers</option>
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setStartDate('');
                            setEndDate('');
                            setUnitId('');
                            setActionType('');
                            setLeaveType('');
                            setEmploymentCategory('');
                        }}
                    >
                        Reset Filters
                    </Button>
                    <Button variant="primary" onClick={fetchReportPreview} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Apply Filters & Refresh Preview
                    </Button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            {reportData?.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {activeReportTab === 'disciplinary-leave' ? (
                        <>
                            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Disciplinary Actions</div>
                                <div className="text-2xl font-bold text-gray-900 mt-2">{reportData.summary.totalDisciplinary}</div>
                                <div className="text-xs text-gray-400 mt-1">Queries & Official Warnings</div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-sm">
                                <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Disciplinary SLA Breaches</div>
                                <div className="text-2xl font-bold text-rose-700 mt-2">{reportData.summary.totalDisciplinaryBreaches}</div>
                                <div className="text-xs text-rose-400 mt-1">Defaulted & Unanswered</div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Leave Applications Processed</div>
                                <div className="text-2xl font-bold text-indigo-900 mt-2">{reportData.summary.totalLeaves}</div>
                                <div className="text-xs text-gray-400 mt-1">Annual, Casual, Maternity, etc.</div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-amber-100 shadow-sm">
                                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Leave SLA Breaches</div>
                                <div className="text-2xl font-bold text-amber-800 mt-2">{reportData.summary.totalLeaveBreaches}</div>
                                <div className="text-xs text-amber-500 mt-1">Resolution &gt; 48 Hours</div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">New Staff Files Created</div>
                                <div className="text-2xl font-bold text-gray-900 mt-2">{reportData.summary.totalStaffCreated}</div>
                                <div className="text-xs text-gray-400 mt-1">Maker-Checker Onboarded</div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm">
                                <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Permanent Staff</div>
                                <div className="text-2xl font-bold text-emerald-700 mt-2">{reportData.summary.permanentStaff}</div>
                                <div className="text-xs text-emerald-400 mt-1">Full Pensionable Records</div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
                                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Total Staff Postings</div>
                                <div className="text-2xl font-bold text-blue-800 mt-2">{reportData.summary.totalTransfers}</div>
                                <div className="text-xs text-blue-400 mt-1">Inter-Unit & Center Transfers</div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-amber-100 shadow-sm">
                                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Pending Registrar Authorization</div>
                                <div className="text-2xl font-bold text-amber-800 mt-2">{reportData.summary.pendingTransfers}</div>
                                <div className="text-xs text-amber-500 mt-1">Awaiting Dual-Control Seal</div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Report Content Preview Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">
                            {activeReportTab === 'disciplinary-leave' ? 'Disciplinary & Leave Records Audit Preview' : 'Staff Onboarding & Dual-Control Postings Preview'}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">Showing live synchronized registry database entries.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                        <span>Generating live audit preview...</span>
                    </div>
                ) : activeReportTab === 'disciplinary-leave' ? (
                    <div className="divide-y divide-gray-100">
                        <div className="p-4 bg-gray-50 font-bold text-xs text-gray-700 uppercase tracking-wider">
                            Disciplinary Actions ({reportData?.disciplinary?.length || 0})
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-xs">
                                <thead className="bg-slate-50 text-gray-600 font-semibold">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Staff Name & ID</th>
                                        <th className="px-4 py-3 text-left">Unit</th>
                                        <th className="px-4 py-3 text-left">Action Type</th>
                                        <th className="px-4 py-3 text-left">Subject</th>
                                        <th className="px-4 py-3 text-left">Status</th>
                                        <th className="px-4 py-3 text-left">SLA Breached</th>
                                        <th className="px-4 py-3 text-left">Issued By</th>
                                        <th className="px-4 py-3 text-left">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(!reportData?.disciplinary || reportData.disciplinary.length === 0) ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-8 text-center text-gray-400">No disciplinary records match current filter criteria.</td>
                                        </tr>
                                    ) : (
                                        paginatedDisciplinary.map((d: any) => (
                                            <tr key={d.id} className="hover:bg-slate-50/70">
                                                <td className="px-4 py-3 font-medium text-gray-900">{d.staffName} <span className="text-gray-400">({d.staffId})</span></td>
                                                <td className="px-4 py-3 text-gray-600">{d.unit}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                                        d.actionType === 'QUERY' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {d.actionType}
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
                                                <td className="px-4 py-3 text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</td>
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
                ) : (
                    <div className="divide-y divide-gray-100">
                        <div className="p-4 bg-gray-50 font-bold text-xs text-gray-700 uppercase tracking-wider">
                            Staff Transfers & Postings Dual-Control Audit ({reportData?.transfers?.length || 0})
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-xs">
                                <thead className="bg-slate-50 text-gray-600 font-semibold">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Staff Name & ID</th>
                                        <th className="px-4 py-3 text-left">Rank</th>
                                        <th className="px-4 py-3 text-left">Origin ➔ Destination</th>
                                        <th className="px-4 py-3 text-left">Dual-Control Status</th>
                                        <th className="px-4 py-3 text-left">Imputer</th>
                                        <th className="px-4 py-3 text-left">Authorizing Registrar</th>
                                        <th className="px-4 py-3 text-left">Effective Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(!reportData?.transfers || reportData.transfers.length === 0) ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No transfer records match current filter criteria.</td>
                                        </tr>
                                    ) : (
                                        paginatedTransfers.map((t: any) => (
                                            <tr key={t.id} className="hover:bg-slate-50/70">
                                                <td className="px-4 py-3 font-medium text-gray-900">{t.staffName} <span className="text-gray-400">({t.staffId})</span></td>
                                                <td className="px-4 py-3 text-gray-600">{t.rank}</td>
                                                <td className="px-4 py-3 text-gray-800 font-medium">{t.origin} ➔ {t.destination}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                                        t.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                                                        t.status === 'PENDING_REGISTRAR_AUTHORIZATION' ? 'bg-amber-100 text-amber-800' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                        {t.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">{t.imputerName}</td>
                                                <td className="px-4 py-3 text-gray-700 font-medium">{t.authorizedByName}</td>
                                                <td className="px-4 py-3 text-gray-500">{t.effectiveDate}</td>
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
            </div>
        </div>
    );
}
