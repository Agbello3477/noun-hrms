'use client';

import { useState, useEffect } from 'react';
import { useSwrData } from '../../../hooks/useSwrData';
import { 
    Users, Calendar, Briefcase, Activity, Clock, CheckCircle2, 
    AlertTriangle, TrendingUp, BarChart3, Filter, FileText, 
    Layers, RefreshCw, ArrowRight, ShieldCheck, PieChart
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../lib/api';
import Button from '../../../components/ui/Button';
import Pagination from '../../../components/ui/Pagination';

interface AnalyticsData {
    totalWorkforce: number;
    activeLeaves: {
        study: number;
        withoutPay: number;
        sick: number;
        sabbatical: number;
        maternity: number;
        paternity: number;
        annual: number;
    };
    genderDistribution: { gender: string; _count: { _all: number } }[];
    zoneDistribution: { zone: string; count: number }[];
}

interface SlaKpiData {
    scope: string;
    timeframe: string;
    unitName: string;
    metrics: {
        totalRequests: number;
        totalResolved: number;
        totalPending: number;
        averageProcessingTimeHours: number;
        averageProcessingTimeDays: number;
        processedWithinSlaCount: number;
        slaSuccessRate: number;
        slaBreachCount: number;
        overdueBottleneckRate: number;
    };
    categories: {
        category: string;
        total: number;
        resolved: number;
        pending: number;
        breached: number;
        avgHours: number;
        avgDays: number;
        successRate: number;
    }[];
    bottlenecks: {
        id: string;
        category: string;
        title: string;
        staffName: string;
        status: string;
        submittedAt: string;
        expectedResolutionAt: string | null;
        turnaroundHours: number | null;
        isBreached: boolean;
        isResolved: boolean;
    }[];
}

export default function AnalyticsPage() {
    const { user, isLoading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<'kpi' | 'demographics'>('kpi');

    // KPI Filters
    const [kpiScope, setKpiScope] = useState<'institutional' | 'unit' | 'personal'>('institutional');
    const [kpiTimeframe, setKpiTimeframe] = useState<'7d' | '30d' | '90d' | '365d'>('30d');
    const [kpiData, setKpiData] = useState<SlaKpiData | null>(null);
    const [kpiLoading, setKpiLoading] = useState(false);

    const [bottleneckPage, setBottleneckPage] = useState(1);
    const [bottleneckPageSize, setBottleneckPageSize] = useState(10);

    const bottlenecksList = kpiData?.bottlenecks || [];
    const paginatedBottlenecks = bottlenecksList.slice((bottleneckPage - 1) * bottleneckPageSize, bottleneckPage * bottleneckPageSize);
    const totalBottleneckPages = Math.ceil(bottlenecksList.length / bottleneckPageSize) || 1;

    // Workforce Demographics Data
    const { data: demoData, isLoading: demoLoading, error: demoError } = useSwrData<AnalyticsData>(
        user ? '/api/analytics/dashboard' : null,
        { ttl: 120000, sessionPersist: true }
    );

    const isExecutive = user && ['HR_ADMIN', 'REGISTRAR', 'SUPER_USER', 'VICE_CHANCELLOR', 'ADMIN', 'AUDIT'].includes(user.role);
    const isUnitManager = user && ['UNIT_HEAD', 'STUDY_CENTER_MANAGER', 'UNIT_ADMIN'].includes(user.role);

    // Set initial scope based on user role
    useEffect(() => {
        if (user) {
            if (isExecutive) {
                setKpiScope('institutional');
            } else if (isUnitManager) {
                setKpiScope('unit');
            } else {
                setKpiScope('personal');
            }
        }
    }, [user, isExecutive, isUnitManager]);

    // Fetch SLA KPI metrics
    const fetchSlaKpi = async () => {
        setKpiLoading(true);
        try {
            const res = await api.get('/api/analytics/sla-kpi', {
                params: {
                    scope: kpiScope,
                    timeframe: kpiTimeframe
                }
            });
            setKpiData(res.data);
        } catch (err) {
            console.error('Failed to load SLA KPI metrics:', err);
        } finally {
            setKpiLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchSlaKpi();
        }
    }, [user, kpiScope, kpiTimeframe]);

    return (
        <div className="space-y-6 pb-12">
            {/* Header with Subsystem Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Analytics &amp; Performance Intelligence</h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Operational SLA Turnaround Timeframes, Staff KPI Evaluations &amp; Workforce Demographics
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('kpi')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs ${
                            activeTab === 'kpi'
                                ? 'bg-white text-emerald-800 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Clock size={15} className="text-emerald-700" />
                        Service Request SLA &amp; Staff KPI
                    </button>
                    <button
                        onClick={() => setActiveTab('demographics')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs ${
                            activeTab === 'demographics'
                                ? 'bg-white text-emerald-800 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Users size={15} className="text-blue-600" />
                        Workforce Demographics &amp; Leaves
                    </button>
                </div>
            </div>

            {/* TAB 1: SERVICE REQUEST SLA & STAFF KPI ENGINE */}
            {activeTab === 'kpi' && (
                <div className="space-y-6">
                    {/* Controls & Scope Toolbar */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Evaluation Scope:</span>
                            {isExecutive && (
                                <button
                                    onClick={() => setKpiScope('institutional')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                                        kpiScope === 'institutional'
                                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    Institutional (University-Wide)
                                </button>
                            )}
                            {(isExecutive || isUnitManager) && (
                                <button
                                    onClick={() => setKpiScope('unit')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                                        kpiScope === 'unit'
                                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    Directorate / Unit Level
                                </button>
                            )}
                            <button
                                onClick={() => setKpiScope('personal')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                                    kpiScope === 'personal'
                                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                Personal Performance
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-slate-500">Period:</span>
                                <select
                                    value={kpiTimeframe}
                                    onChange={(e) => setKpiTimeframe(e.target.value as any)}
                                    className="text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="7d">Last 7 Days</option>
                                    <option value="30d">Last 30 Days</option>
                                    <option value="90d">Last Quarter (90 Days)</option>
                                    <option value="365d">Full Year (365 Days)</option>
                                </select>
                            </div>

                            <button
                                onClick={fetchSlaKpi}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                                title="Refresh SLA KPI Data"
                            >
                                <RefreshCw size={15} className={kpiLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {/* KPI High-Level Core Metrics Grid */}
                    {kpiLoading && !kpiData ? (
                        <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700" />
                            <p className="text-xs font-medium">Computing service request SLA turnarounds &amp; KPI metrics...</p>
                        </div>
                    ) : kpiData ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Metric 1: Average Processing Time */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                                    <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase mb-2">
                                        <span>Average Processing Time</span>
                                        <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                                            <Clock size={16} />
                                        </div>
                                    </div>
                                    <div className="text-2xl font-black text-slate-900">
                                        {kpiData.metrics.averageProcessingTimeHours}h
                                        <span className="text-xs font-medium text-slate-500 ml-1.5">
                                            ({kpiData.metrics.averageProcessingTimeDays} days)
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-2">
                                        Institutional SLA average turnaround time
                                    </p>
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600" />
                                </div>

                                {/* Metric 2: % Processed Within SLA */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                                    <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase mb-2">
                                        <span>% Processed Within SLA</span>
                                        <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                            <CheckCircle2 size={16} />
                                        </div>
                                    </div>
                                    <div className="text-2xl font-black text-emerald-700">
                                        {kpiData.metrics.slaSuccessRate}%
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-2">
                                        {kpiData.metrics.processedWithinSlaCount} of {kpiData.metrics.totalResolved} resolved on-time
                                    </p>
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600" />
                                </div>

                                {/* Metric 3: Overdue Bottleneck Rate */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                                    <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase mb-2">
                                        <span>Overdue Bottleneck Rate</span>
                                        <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                                            <AlertTriangle size={16} />
                                        </div>
                                    </div>
                                    <div className="text-2xl font-black text-rose-700">
                                        {kpiData.metrics.overdueBottleneckRate}%
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-2">
                                        {kpiData.metrics.slaBreachCount} requests currently exceeding SLA deadline
                                    </p>
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-600" />
                                </div>

                                {/* Metric 4: Request Pipeline Volume */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                                    <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase mb-2">
                                        <span>Total Request Volume</span>
                                        <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                                            <Layers size={16} />
                                        </div>
                                    </div>
                                    <div className="text-2xl font-black text-slate-900">
                                        {kpiData.metrics.totalRequests}
                                        <span className="text-xs font-semibold text-emerald-700 ml-2">
                                            ({kpiData.metrics.totalResolved} closed)
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-2">
                                        {kpiData.metrics.totalPending} pending action across departments
                                    </p>
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-600" />
                                </div>
                            </div>

                            {/* Categorical SLA Performance Breakdown */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-extrabold text-slate-900 text-base">
                                            SLA &amp; Turnaround Performance by Operational Category
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Granular benchmarking across Leave, File Requests, Official Applications &amp; Disciplinary Queries
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                                    {kpiData.categories.map((cat) => (
                                        <div key={cat.category} className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-bold text-slate-800 text-xs truncate" title={cat.category}>
                                                    {cat.category}
                                                </h4>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                                    cat.successRate >= 90
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : cat.successRate >= 75
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : 'bg-rose-100 text-rose-800'
                                                }`}>
                                                    {cat.successRate}% On-Time
                                                </span>
                                            </div>

                                            <div className="space-y-1 text-xs">
                                                <div className="flex justify-between text-slate-600">
                                                    <span>Total Submitted:</span>
                                                    <span className="font-bold text-slate-900">{cat.total}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-600">
                                                    <span>Avg. Turnaround:</span>
                                                    <span className="font-bold text-slate-900">{cat.avgHours}h ({cat.avgDays}d)</span>
                                                </div>
                                                <div className="flex justify-between text-slate-600">
                                                    <span>Pending:</span>
                                                    <span className="font-bold text-slate-900">{cat.pending}</span>
                                                </div>
                                                <div className="flex justify-between text-rose-700 font-semibold">
                                                    <span>SLA Breaches:</span>
                                                    <span>{cat.breached}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Overdue Bottlenecks Table */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                                            <AlertTriangle size={18} className="text-rose-600" />
                                            Active Overdue Bottlenecks &amp; SLA Escalation Monitor
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Requests exceeding institutional processing deadlines requiring expedited action
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                                        {kpiData.bottlenecks.length} Critical Items
                                    </span>
                                </div>

                                {kpiData.bottlenecks.length === 0 ? (
                                    <div className="text-center py-8 text-emerald-700 text-xs border border-dashed border-emerald-200 rounded-xl bg-emerald-50/30">
                                        <CheckCircle2 size={24} className="mx-auto mb-1.5 opacity-80" />
                                        All operational requests within this period were processed in compliance with institutional SLA timeframes.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                                                    <th className="px-4 py-3">Category</th>
                                                    <th className="px-4 py-3">Title / Subject</th>
                                                    <th className="px-4 py-3">Staff / Applicant</th>
                                                    <th className="px-4 py-3">Submitted At</th>
                                                    <th className="px-4 py-3">SLA Deadline</th>
                                                    <th className="px-4 py-3">Status</th>
                                                </tr>
                                            </thead>
                                             <tbody className="divide-y divide-slate-100">
                                                {paginatedBottlenecks.map((item) => (
                                                    <tr key={item.id} className="hover:bg-rose-50/40 transition">
                                                        <td className="px-4 py-3 font-semibold text-slate-700">{item.category}</td>
                                                        <td className="px-4 py-3 font-bold text-slate-900">{item.title}</td>
                                                        <td className="px-4 py-3 text-slate-600">{item.staffName}</td>
                                                        <td className="px-4 py-3 text-slate-500">{new Date(item.submittedAt).toLocaleDateString('en-NG')}</td>
                                                        <td className="px-4 py-3 font-bold text-rose-700">
                                                            {item.expectedResolutionAt ? new Date(item.expectedResolutionAt).toLocaleDateString('en-NG') : 'Exceeded'}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                                                SLA BREACH
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <Pagination
                                            currentPage={bottleneckPage}
                                            totalPages={totalBottleneckPages}
                                            totalItems={bottlenecksList.length}
                                            pageSize={bottleneckPageSize}
                                            onPageChange={setBottleneckPage}
                                            onPageSizeChange={setBottleneckPageSize}
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    ) : null}
                </div>
            )}

            {/* TAB 2: WORKFORCE DEMOGRAPHICS & LEAVES (LEGACY DATA) */}
            {activeTab === 'demographics' && (
                <div className="space-y-6">
                    {demoLoading && !demoData ? (
                        <div className="p-8 text-center text-gray-500">Loading demographics...</div>
                    ) : demoError && !demoData ? (
                        <div className="p-8 text-center text-red-500 font-medium">Failed to load workforce demographics.</div>
                    ) : demoData ? (
                        <>
                            {/* Overview Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-600">
                                    <div className="flex items-center justify-between mb-4">
                                        <Users className="text-blue-600" size={24} />
                                        <span className="text-xs font-semibold text-gray-400 uppercase">Total Workforce</span>
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900">{demoData.totalWorkforce}</div>
                                    <div className="text-xs text-green-600 mt-2 flex items-center gap-1">
                                        <Activity size={12} /> Live Data
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-yellow-500">
                                    <div className="flex items-center justify-between mb-4">
                                        <Calendar className="text-yellow-500" size={24} />
                                        <span className="text-xs font-semibold text-gray-400 uppercase">Staff on Annual Leave</span>
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900">{demoData.activeLeaves.annual}</div>
                                </div>

                                <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
                                    <div className="flex items-center justify-between mb-4">
                                        <Briefcase className="text-purple-500" size={24} />
                                        <span className="text-xs font-semibold text-gray-400 uppercase">Study Leave</span>
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900">{demoData.activeLeaves.study}</div>
                                </div>

                                <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-red-500">
                                    <div className="flex items-center justify-between mb-4">
                                        <Activity className="text-red-500" size={24} />
                                        <span className="text-xs font-semibold text-gray-400 uppercase">Sick Leave</span>
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900">{demoData.activeLeaves.sick}</div>
                                </div>
                            </div>

                            {/* Detailed Stats */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Leave Breakdown */}
                                <div className="bg-white p-6 rounded-lg shadow-sm">
                                    <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Leave Distribution</h3>
                                    <div className="space-y-4">
                                        <StatRow label="Sabbatical" value={demoData.activeLeaves.sabbatical} total={demoData.totalWorkforce} color="bg-indigo-500" />
                                        <StatRow label="Maternity / Paternity" value={demoData.activeLeaves.maternity + demoData.activeLeaves.paternity} total={demoData.totalWorkforce} color="bg-pink-500" />
                                        <StatRow label="Leave Without Pay" value={demoData.activeLeaves.withoutPay} total={demoData.totalWorkforce} color="bg-gray-500" />
                                    </div>
                                </div>

                                {/* Gender Dist */}
                                <div className="bg-white p-6 rounded-lg shadow-sm">
                                    <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Gender Demographics</h3>
                                    <div className="space-y-4">
                                        {demoData.genderDistribution.map((g) => (
                                            <StatRow
                                                key={g.gender}
                                                label={g.gender || 'Not Specified'}
                                                value={g._count._all}
                                                total={demoData.totalWorkforce}
                                                color="bg-teal-500"
                                            />
                                        ))}
                                        {demoData.genderDistribution.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No gender data available</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Geo-Political Zones Distribution */}
                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Geo-Political Zone Demographics</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                    {demoData.zoneDistribution.map((z) => (
                                        <StatRow
                                            key={z.zone}
                                            label={z.zone}
                                            value={z.count}
                                            total={demoData.totalWorkforce}
                                            color="bg-blue-600"
                                        />
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
            )}
        </div>
    );
}

const StatRow = ({ label, value, total, color }: { label: string, value: number, total: number, color: string }) => {
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div className="flex items-center gap-4">
            <div className="w-32 text-sm text-gray-600 font-medium truncate">{label}</div>
            <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.max(percent, 5)}%` }}></div>
            </div>
            <div className="w-12 text-right text-sm font-bold text-gray-800">{value}</div>
        </div>
    );
};
