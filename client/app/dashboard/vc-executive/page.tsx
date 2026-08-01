"use client";

import React, { useState, useEffect } from 'react';
import api from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { 
    TrendingUp, Users, ShieldAlert, HeartPulse, FileText, CheckCircle2, 
    AlertCircle, Download, Check, RefreshCw, Landmark, ChevronRight, Layers, ArrowUpRight
} from 'lucide-react';

interface VCKPIs {
    totalActiveStaff: number;
    staffDueForPromotion: number;
    activeSecurityThreats: number;
    todayClinicConsultations: number;
    totalActiveResearchProjects: number;
}

interface VCAnalytics {
    staffByDept: { department: string; count: number }[];
    staffByState: { state: string; count: number }[];
    incidentCategories: { category: string; count: number }[];
    highRiskZones: { location: string; count: number }[];
    clinicTrends: { month: string; nurse: number; doctor: number; pharmacy: number }[];
    promotionProgress: { pending: number; cleared: number; withdrawn: number };
}

interface PendingPayrollRecord {
    id: string;
    month: string;
    year: number;
    grossPay: number;
    netPay: number;
    tax: number;
    pension: number;
    status: string;
    user: {
        name: string;
        email: string;
    };
}

export default function VCExecutiveDashboard() {
    const { user, isLoading } = useAuth();
    const [kpis, setKpis] = useState<VCKPIs | null>(null);
    const [analytics, setAnalytics] = useState<VCAnalytics | null>(null);
    const [pendingPayroll, setPendingPayroll] = useState<PendingPayrollRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const fetchData = async () => {
        try {
            setError('');
            const [analyticsRes, payrollRes] = await Promise.all([
                api.get('/api/analytics/vc-executive'),
                api.get('/api/payroll/pending')
            ]);
            setKpis(analyticsRes.data.kpis);
            setAnalytics(analyticsRes.data.analytics);
            setPendingPayroll(payrollRes.data);
        } catch (err: any) {
            console.error('Error fetching VC data:', err);
            setError('Failed to aggregate executive metrics. Ensure you have Vice-Chancellor permissions.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isLoading && user) {
            fetchData();
        }
    }, [isLoading, user]);

    const handleApprovePayroll = async (month?: string, year?: number) => {
        try {
            setApproving(true);
            setMessage('');
            
            // Standard approve payload
            const payload = month && year 
                ? { month, year } 
                : { recordIds: pendingPayroll.map(r => r.id) };

            await api.post('/api/payroll/approve', payload);
            setMessage('Payroll batch approved and marked for disbursement successfully.');
            // Refresh data
            await fetchData();
        } catch (err: any) {
            console.error('Payroll approval error:', err);
            setError(err.response?.data?.message || 'Failed to approve payroll batch.');
        } finally {
            setApproving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[70vh] flex-col items-center justify-center gap-3 text-slate-500 font-bold">
                <RefreshCw className="animate-spin text-emerald-700" size={32} />
                <span>Aggregating Executive Metrics (Redis Cached)...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center max-w-lg mx-auto space-y-4">
                <AlertCircle className="text-red-500 mx-auto" size={48} />
                <h2 className="text-xl font-black text-slate-900">Access Restricted</h2>
                <p className="text-sm text-slate-500 font-semibold">{error}</p>
            </div>
        );
    }

    // Calculate pending payroll totals
    const totalPendingPayrollGross = pendingPayroll.reduce((sum, r) => sum + r.grossPay, 0);
    const totalPendingPayrollNet = pendingPayroll.reduce((sum, r) => sum + r.netPay, 0);

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-300">
            {/* Executive Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 border-slate-200">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                        <TrendingUp className="text-emerald-700" size={32} />
                        Vice-Chancellor Executive Command
                    </h1>
                    <p className="text-sm text-slate-500 font-semibold mt-1">
                        Real-time pre-aggregated metrics and strategic action console.
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black flex items-center gap-2 border border-emerald-200 transition shadow-sm"
                >
                    <RefreshCw size={14} />
                    <span>Refresh Command Data</span>
                </button>
            </div>

            {/* KPI Cards */}
            {kpis && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[11px] uppercase tracking-wider font-extrabold">Active Workforce</span>
                            <Users className="text-emerald-600" size={20} />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-slate-900">{kpis.totalActiveStaff}</span>
                            <span className="text-xs font-bold text-slate-400 block mt-1">Non-academic & academic</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[11px] uppercase tracking-wider font-extrabold">Due For Promotion</span>
                            <TrendingUp className="text-amber-500" size={20} />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-slate-900">{kpis.staffDueForPromotion}</span>
                            <span className="text-xs font-bold text-slate-400 block mt-1">Registry flagged candidates</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[11px] uppercase tracking-wider font-extrabold">Security Threats</span>
                            <ShieldAlert className="text-red-500" size={20} />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-slate-900">{kpis.activeSecurityThreats}</span>
                            <span className="text-xs font-bold text-slate-400 block mt-1">Open incident logs</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[11px] uppercase tracking-wider font-extrabold">Clinic Consults Today</span>
                            <HeartPulse className="text-blue-500" size={20} />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-slate-900">{kpis.todayClinicConsultations}</span>
                            <span className="text-xs font-bold text-slate-400 block mt-1">Today&apos;s encounters</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[11px] uppercase tracking-wider font-extrabold">Research Projects</span>
                            <FileText className="text-indigo-600" size={20} />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-slate-900">{kpis.totalActiveResearchProjects}</span>
                            <span className="text-xs font-bold text-slate-400 block mt-1">Active ongoing research</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Strategic Actions: Payroll Runs & approvals (Module 2 integration) */}
            {pendingPayroll.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 rounded-3xl p-6 md:p-8 text-white shadow-xl space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-700/60 pb-4">
                        <div className="flex items-center gap-3">
                            <Landmark className="text-amber-400" size={32} />
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-wider text-amber-300">Pending Monthly Payroll Approval</h3>
                                <p className="text-xs text-emerald-200 font-bold">HR/Finance generated a draft payroll run awaiting VC approval.</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest">Total Net Disbursement</div>
                            <div className="text-2xl font-black text-white">₦{totalPendingPayrollNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                    </div>

                    {message && (
                        <div className="bg-emerald-900/60 border border-emerald-500/30 rounded-2xl p-4 text-xs font-bold flex items-center gap-2 text-emerald-200">
                            <CheckCircle2 size={16} />
                            <span>{message}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-emerald-900/40 p-5 rounded-2xl border border-emerald-800">
                            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-300">Batch Breakdown</span>
                            <div className="space-y-2 mt-3 text-xs font-bold">
                                <div className="flex justify-between">
                                    <span>Staff Count:</span>
                                    <span>{pendingPayroll.length} Employees</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Gross Salaries:</span>
                                    <span>₦{totalPendingPayrollGross.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Tax Deductions (PAYE):</span>
                                    <span>₦{pendingPayroll.reduce((sum, r) => sum + r.tax, 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-emerald-900/40 p-5 rounded-2xl border border-emerald-800 flex flex-col justify-center">
                            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-300">Statutory Compliance</span>
                            <p className="text-[11px] text-emerald-200 font-semibold leading-relaxed mt-2">
                                Deductions for PAYE, 8% pension contributions, NHF, and NHIS have been automatically validated against CONUASS/CONTISS scales.
                            </p>
                        </div>

                        <div className="flex items-center justify-end">
                            <button
                                disabled={approving}
                                onClick={() => handleApprovePayroll()}
                                className="w-full md:w-auto px-8 py-4 bg-amber-400 hover:bg-amber-300 text-emerald-950 rounded-2xl text-sm font-black transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                            >
                                {approving ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
                                <span>Disburse & Approve Payroll</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Visual Analytics & Heatmaps (Module 1 requirements) */}
            {analytics && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Visual 1: Staff Distribution by Department */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="border-b pb-3 border-slate-100 flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Staff Distribution by Department</h4>
                            <span className="text-[10px] font-bold text-slate-400">Total active staff</span>
                        </div>
                        <div className="space-y-3">
                            {analytics.staffByDept.slice(0, 6).map((dept, idx) => {
                                const maxCount = Math.max(...analytics.staffByDept.map(d => d.count), 1);
                                const percentage = (dept.count / maxCount) * 100;
                                return (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold text-slate-700">
                                            <span>{dept.department.replace('_', ' ')}</span>
                                            <span>{dept.count} Staff</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                            <div 
                                                style={{ width: `${percentage}%` }}
                                                className="bg-emerald-600 h-full rounded-full"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Visual 2: Staff Distribution by State of Origin */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="border-b pb-3 border-slate-100 flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Staff Federal Character (Top States)</h4>
                            <span className="text-[10px] font-bold text-slate-400">36 States mapping</span>
                        </div>
                        <div className="space-y-3">
                            {analytics.staffByState.slice(0, 6).map((state, idx) => {
                                const maxCount = Math.max(...analytics.staffByState.map(s => s.count), 1);
                                const percentage = (state.count / maxCount) * 100;
                                return (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold text-slate-700">
                                            <span className="capitalize">{state.state}</span>
                                            <span>{state.count} Staff</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                            <div 
                                                style={{ width: `${percentage}%` }}
                                                className="bg-indigo-600 h-full rounded-full"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Visual 3: Security Threat Incident Categories & Hot-Spot Zones (Heatmap) */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="border-b pb-3 border-slate-100">
                            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">High-Risk Campus Zones (Threat Heatmap)</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {/* Hot Spot locations */}
                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Threat Levels by Location</h5>
                                <div className="space-y-2">
                                    {analytics.highRiskZones.slice(0, 5).map((zone, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                                            <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{zone.location}</span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                                zone.count > 5 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {zone.count} Incidents
                                            </span>
                                        </div>
                                    ))}
                                    {analytics.highRiskZones.length === 0 && (
                                        <p className="text-xs text-slate-400 italic">No security incidents logged</p>
                                    )}
                                </div>
                            </div>

                            {/* Threat categories */}
                            <div className="space-y-3 border-l pl-4 border-slate-200">
                                <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Incident Category Breakdown</h5>
                                <div className="space-y-2">
                                    {analytics.incidentCategories.slice(0, 5).map((cat, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold text-slate-700">
                                                <span className="text-[11px]">{cat.category}</span>
                                                <span>{cat.count}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                <div 
                                                    style={{ width: `${Math.min(cat.count * 10, 100)}%` }}
                                                    className="bg-red-500 h-full rounded-full"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {analytics.incidentCategories.length === 0 && (
                                        <p className="text-xs text-slate-400 italic">No threats logged</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Visual 4: Clinic Attendance Trends & Promotion Pipeline */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="border-b pb-3 border-slate-100 flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Clinic Visitation Trends</h4>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-around text-center text-xs font-bold border-b pb-2">
                                <div>
                                    <span className="text-blue-500 text-lg font-black block">
                                        {analytics.clinicTrends.reduce((sum, t) => sum + t.nurse, 0)}
                                    </span>
                                    <span className="text-[10px] text-slate-400 uppercase">Triage (Nurses)</span>
                                </div>
                                <div>
                                    <span className="text-emerald-600 text-lg font-black block">
                                        {analytics.clinicTrends.reduce((sum, t) => sum + t.doctor, 0)}
                                    </span>
                                    <span className="text-[10px] text-slate-400 uppercase">Consults (Doctors)</span>
                                </div>
                                <div>
                                    <span className="text-amber-500 text-lg font-black block">
                                        {analytics.clinicTrends.reduce((sum, t) => sum + t.pharmacy, 0)}
                                    </span>
                                    <span className="text-[10px] text-slate-400 uppercase">Pharmacy Dispatch</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Monthly Progression</h5>
                                <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                                    {analytics.clinicTrends.map((trend, idx) => (
                                        <div key={idx} className="flex justify-between text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded-lg">
                                            <span>{trend.month}</span>
                                            <div className="flex gap-4">
                                                <span className="text-blue-600">N: {trend.nurse}</span>
                                                <span className="text-emerald-700">D: {trend.doctor}</span>
                                                <span className="text-amber-600">P: {trend.pharmacy}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
