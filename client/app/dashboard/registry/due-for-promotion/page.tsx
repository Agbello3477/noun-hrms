'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '../../../../lib/api';
import {
    TrendingUp, Search, RefreshCw, Shield, CheckCircle2,
    XCircle, ChevronLeft, ChevronRight, AlertTriangle,
    Download, Calendar, User, Briefcase, Star, Filter,
    Clock, PlayCircle, ToggleLeft, ToggleRight, ClipboardList
} from 'lucide-react';

interface PromotionLog {
    id: string;
    calendarYear: number;
    status: string;
    triggeredBy: string;
    cronExecutedAt: string;
    snapshotRank: string | null;
    snapshotLevel: string | null;
    snapshotUnit: string | null;
    staffProfile: {
        staffId: string | null;
        surname: string | null;
        otherNames: string | null;
        title: string | null;
        rank: string | null;
        level: string | null;
        step: string | null;
        cadre: string | null;
        department: string | null;
        isDueForPromotion: boolean;
        promotionFlaggedAt: string | null;
        dateOfLastPromotion: string | null;
        unit: { name: string } | null;
        studyCenter: { name: string } | null;
        user: { email: string } | null;
    };
}

interface StaffItem {
    id: string;
    name: string;
    email: string;
    role: string;
    staffProfile?: {
        id: string;
        staffId?: string | null;
        surname?: string | null;
        otherNames?: string | null;
        title?: string | null;
        rank?: string | null;
        level?: string | null;
        step?: string | null;
        cadre?: string | null;
        isDueForPromotion?: boolean;
        promotionFlaggedAt?: string | null;
        dateOfLastPromotion?: string | null;
        unit?: { name: string } | null;
        studyCenter?: { name: string } | null;
        department?: string | null;
    };
}

const ALLOWED_ROLES = ['HR_ADMIN', 'VICE_CHANCELLOR', 'SUPER_USER', 'ADMIN'];
const FLAG_MANAGE_ROLES = ['HR_ADMIN', 'SUPER_USER', 'ADMIN'];

export default function DueForPromotionPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'records' | 'flag'>('records');

    // Records tab
    const [records, setRecords] = useState<PromotionLog[]>([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(15);
    const [loadingRecs, setLoadingRecs] = useState(true);
    const [search, setSearch] = useState('');
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear());

    // Flag tab
    const [allStaff, setAllStaff] = useState<StaffItem[]>([]);
    const [staffSearch, setStaffSearch] = useState('');
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [flagging, setFlagging] = useState<string | null>(null);
    const [staffPage, setStaffPage] = useState(1);
    const [staffPageSize, setStaffPageSize] = useState(15);

    // Shared
    const [runningCron, setRunningCron] = useState(false);
    const [cronResult, setCronResult] = useState<{ processed: number; skipped: number; errors: string[] } | null>(null);
    const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (!authLoading && user && !ALLOWED_ROLES.includes(user.role)) {
            router.replace('/dashboard');
        }
    }, [user, authLoading, router]);

    const showToast = (text: string, type: 'success' | 'error') => {
        setToast({ text, type });
        setTimeout(() => setToast(null), 4500);
    };

    const fetchRecords = useCallback(async () => {
        setLoadingRecs(true);
        try {
            const res = await api.get('/api/staff/promotions/due', {
                params: { search, year: yearFilter, page, limit }
            });
            setRecords(res.data.data);
            setTotal(res.data.total);
            setPages(res.data.pages);
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to load promotion records.', 'error');
        } finally {
            setLoadingRecs(false);
        }
    }, [search, yearFilter, page, limit]);

    useEffect(() => {
        if (user && ALLOWED_ROLES.includes(user.role)) fetchRecords();
    }, [fetchRecords, user]);

    const fetchAllStaff = useCallback(async () => {
        setLoadingStaff(true);
        try {
            const res = await api.get('/api/staff');
            setAllStaff(res.data);
        } catch {
            showToast('Failed to load staff list.', 'error');
        } finally {
            setLoadingStaff(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'flag' && user && FLAG_MANAGE_ROLES.includes(user.role) && allStaff.length === 0) {
            fetchAllStaff();
        }
    }, [activeTab, user, fetchAllStaff, allStaff.length]);

    const handleToggleFlag = async (profileId: string, currentFlag: boolean) => {
        setFlagging(profileId);
        try {
            await api.put(`/api/staff/promotions/flag/${profileId}`, { isDue: !currentFlag });
            showToast(!currentFlag ? 'Staff flagged as due for promotion.' : 'Promotion flag cleared.', 'success');
            setAllStaff(prev => prev.map(s =>
                s.staffProfile?.id === profileId
                    ? { ...s, staffProfile: { ...s.staffProfile!, isDueForPromotion: !currentFlag, promotionFlaggedAt: !currentFlag ? new Date().toISOString() : null } }
                    : s
            ));
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to update flag.', 'error');
        } finally {
            setFlagging(null);
        }
    };

    const handleRunCron = async () => {
        if (!confirm('This will immediately process all flagged staff and send notifications. Continue?')) return;
        setRunningCron(true);
        setCronResult(null);
        try {
            const res = await api.post('/api/staff/promotions/run-cron');
            const result = res.data.result;
            setCronResult(result);
            showToast(`Job complete: ${result.processed} notified, ${result.skipped} skipped, ${result.errors.length} errors.`,
                result.errors.length > 0 ? 'error' : 'success');
            setActiveTab('records');
            fetchRecords();
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to run promotion job.', 'error');
        } finally {
            setRunningCron(false);
        }
    };

    const handleExport = () => {
        const rows = [
            ['Staff ID', 'Name', 'Rank', 'Level', 'Unit/Dept', 'Status', 'Flagged Date', 'Trigger', 'Year'],
            ...records.map(r => {
                const p = r.staffProfile;
                const name = `${p.title || ''} ${p.surname || ''} ${p.otherNames || ''}`.trim();
                const unit = p.unit?.name || p.studyCenter?.name || p.department || '';
                return [p.staffId || '', name, r.snapshotRank || p.rank || '', r.snapshotLevel || '', unit, r.status,
                    p.promotionFlaggedAt ? new Date(p.promotionFlaggedAt).toLocaleDateString('en-NG') : '', r.triggeredBy, r.calendarYear];
            })
        ];
        const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `due-for-promotion-${yearFilter}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const fmtDate = (d: string | null) =>
        d ? new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    const statusColor = (s: string) => {
        if (s === 'DUE_FOR_PROMOTION') return 'bg-amber-100 text-amber-800 border-amber-300';
        if (s === 'PROMOTED') return 'bg-green-100 text-green-800 border-green-300';
        if (s === 'WITHDRAWN') return 'bg-red-100 text-red-800 border-red-300';
        return 'bg-gray-100 text-gray-700 border-gray-300';
    };

    if (authLoading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
        </div>
    );

    if (!user || !ALLOWED_ROLES.includes(user.role)) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
            <Shield className="h-16 w-16 text-red-400" />
            <h1 className="text-2xl font-bold text-gray-800">403 — Access Denied</h1>
            <p className="text-gray-500 max-w-md">This area is restricted to Registry HR Admins and the Vice-Chancellor only.</p>
            <button onClick={() => router.replace('/dashboard')}
                className="mt-2 px-5 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition">
                Return to Dashboard
            </button>
        </div>
    );

    const isSuperUser = user.role === 'SUPER_USER';
    const canFlag = FLAG_MANAGE_ROLES.includes(user.role);
    const filteredStaff = allStaff.filter(s => {
        if (!staffSearch) return true;
        const q = staffSearch.toLowerCase();
        return s.name?.toLowerCase().includes(q) || s.staffProfile?.staffId?.toLowerCase().includes(q) ||
            s.staffProfile?.rank?.toLowerCase().includes(q) || s.staffProfile?.surname?.toLowerCase().includes(q) ||
            s.staffProfile?.otherNames?.toLowerCase().includes(q);
    });
    const staffTotalPages = Math.max(1, Math.ceil(filteredStaff.length / staffPageSize));
    const pagedStaff = filteredStaff.slice((staffPage - 1) * staffPageSize, staffPage * staffPageSize);

    return (
        <div className="min-h-screen bg-gray-50">
            {toast && (
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl shadow-lg px-5 py-3 text-sm font-medium
                    ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    {toast.text}
                </div>
            )}

            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow">
                            <TrendingUp className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 leading-tight">Staff Promotion Monitoring</h1>
                            <p className="text-xs text-gray-500">Registry — Annual Promotion Workflow</p>
                        </div>
                    </div>
                    {isSuperUser && (
                        <button onClick={handleRunCron} disabled={runningCron}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700 transition disabled:opacity-60">
                            {runningCron ? <><RefreshCw size={14} className="animate-spin" /> Running...</> : <><PlayCircle size={14} /> Run Cron Now</>}
                        </button>
                    )}
                </div>
                {/* Tabs */}
                <div className="max-w-7xl mx-auto px-6 flex gap-1 border-t border-gray-100">
                    {([{ id: 'records', label: 'Promotion Records', icon: ClipboardList },
                        ...(canFlag ? [{ id: 'flag', label: 'Flag Staff', icon: ToggleRight }] : [])] as const).map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setActiveTab(id as 'records' | 'flag')}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                                ${activeTab === id ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                            <Icon size={15} />{label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
                {cronResult && (
                    <div className={`rounded-xl border p-4 flex items-start gap-3 text-sm
                        ${cronResult.errors.length > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                        {cronResult.errors.length > 0 ? <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />}
                        <div>
                            <p className="font-semibold mb-0.5">Promotion Job Complete</p>
                            <p>Processed: <strong>{cronResult.processed}</strong> &nbsp;|&nbsp; Skipped: <strong>{cronResult.skipped}</strong> &nbsp;|&nbsp; Errors: <strong>{cronResult.errors.length}</strong></p>
                        </div>
                    </div>
                )}

                {/* RECORDS TAB */}
                {activeTab === 'records' && (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Records', value: total, icon: User, color: 'text-blue-600 bg-blue-50' },
                                { label: 'Year', value: yearFilter, icon: Calendar, color: 'text-amber-600 bg-amber-50' },
                                { label: 'Pages', value: pages, icon: Filter, color: 'text-purple-600 bg-purple-50' },
                                { label: 'Cron Schedule', value: 'Jan 1, 00:00', icon: Clock, color: 'text-green-600 bg-green-50' },
                            ].map(({ label, value, icon: Icon, color }) => (
                                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
                                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}><Icon size={18} /></div>
                                    <div><p className="text-xs text-gray-500">{label}</p><p className="text-lg font-bold text-gray-900">{value}</p></div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                                <input id="promotion-search" type="text" placeholder="Search by name, staff ID, rank..."
                                    value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
                            </div>
                            <select id="year-filter" value={yearFilter} onChange={e => { setYearFilter(parseInt(e.target.value)); setPage(1); }}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
                                {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <select id="records-per-page" value={limit} onChange={e => { setLimit(parseInt(e.target.value)); setPage(1); }}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
                                {[10, 15, 25, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
                            </select>
                            <button onClick={fetchRecords} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"><RefreshCw size={15} /></button>
                            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition font-medium">
                                <Download size={14} /> Export CSV
                            </button>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {loadingRecs ? (
                                <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" /></div>
                            ) : records.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                                    <Star size={36} className="opacity-30" />
                                    <p className="text-sm font-medium">No promotion records found for {yearFilter}</p>
                                    <p className="text-xs">Flag staff in the &quot;Flag Staff&quot; tab, then run the cron job.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200 text-left">
                                                {['Staff', 'Rank / Level', 'Unit / Department', 'Status', 'Flagged On', 'Triggered By', 'Last Promoted'].map(h => (
                                                    <th key={h} className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {records.map(record => {
                                                const p = record.staffProfile;
                                                const name = `${p.title ? p.title + ' ' : ''}${p.surname || ''} ${p.otherNames || ''}`.trim();
                                                const unit = p.unit?.name || p.studyCenter?.name || p.department || '—';
                                                return (
                                                    <tr key={record.id} className="hover:bg-amber-50/40 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                                    {(p.surname || 'U')[0].toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className="font-semibold text-gray-900">{name || 'Unknown'}</p>
                                                                    <p className="text-xs text-gray-400">{p.staffId || '—'} · {p.cadre || '—'}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium text-gray-800">{record.snapshotRank || p.rank || '—'}</p>
                                                            <p className="text-xs text-gray-500">{record.snapshotLevel || (p.level ? `${p.level}${p.step ? '/' + p.step : ''}` : '—')}</p>
                                                        </td>
                                                        <td className="px-4 py-3"><div className="flex items-center gap-1.5 text-gray-700"><Briefcase size={13} className="text-gray-400" /><span>{unit}</span></div></td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColor(record.status)}`}>
                                                                <Star size={10} /> {record.status.replace(/_/g, ' ')}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600">{fmtDate(p.promotionFlaggedAt)}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${record.triggeredBy === 'CRON' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                                                {record.triggeredBy}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-500">{fmtDate(p.dateOfLastPromotion)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                                <p className="text-xs text-gray-500">
                                    {total === 0
                                        ? 'No records'
                                        : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total} record${total !== 1 ? 's' : ''}`
                                    }
                                </p>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setPage(1)} disabled={page === 1}
                                        className="p-1.5 rounded-lg text-gray-500 hover:bg-white disabled:opacity-40 transition border border-transparent hover:border-gray-200 text-xs font-medium px-2">«</button>
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                        className="p-1.5 rounded-lg text-gray-500 hover:bg-white disabled:opacity-40 transition border border-transparent hover:border-gray-200"><ChevronLeft size={16} /></button>
                                    {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                                        const start = Math.max(1, Math.min(page - 2, pages - 4));
                                        const pg = start + i;
                                        return pg <= pages ? (
                                            <button key={pg} onClick={() => setPage(pg)}
                                                className={`min-w-[32px] h-8 rounded-lg text-xs font-semibold transition border ${
                                                    pg === page
                                                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                                        : 'text-gray-600 bg-white border-gray-200 hover:border-amber-300 hover:text-amber-600'
                                                }`}>{pg}</button>
                                        ) : null;
                                    })}
                                    <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                                        className="p-1.5 rounded-lg text-gray-500 hover:bg-white disabled:opacity-40 transition border border-transparent hover:border-gray-200"><ChevronRight size={16} /></button>
                                    <button onClick={() => setPage(pages)} disabled={page === pages}
                                        className="p-1.5 rounded-lg text-gray-500 hover:bg-white disabled:opacity-40 transition border border-transparent hover:border-gray-200 text-xs font-medium px-2">»</button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 text-sm text-amber-800">
                            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-semibold mb-0.5">How this module works</p>
                                <p>Every <strong>January 1st at 00:00 WAT</strong>, the system automatically scans all staff flagged by the Registry and pushes their records here. Each eligible staff member receives an in-app notification and an official email alert. The Registry then communicates interview/review dates manually.</p>
                            </div>
                        </div>
                    </>
                )}

                {/* FLAG TAB */}
                {activeTab === 'flag' && canFlag && (
                    <>
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                                <input id="flag-staff-search" type="text" placeholder="Search staff by name, ID or rank..."
                                    value={staffSearch} onChange={e => { setStaffSearch(e.target.value); setStaffPage(1); }}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50" />
                            </div>
                            <select id="flag-per-page" value={staffPageSize}
                                onChange={e => { setStaffPageSize(parseInt(e.target.value)); setStaffPage(1); }}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
                                {[10, 15, 25, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
                            </select>
                            <button onClick={fetchAllStaff} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"><RefreshCw size={15} /></button>
                            <span className="text-xs text-gray-500 font-medium">
                                {filteredStaff.filter(s => s.staffProfile?.isDueForPromotion).length} flagged &bull; {filteredStaff.length} total
                            </span>
                        </div>

                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 flex items-center gap-2 text-xs text-blue-700">
                            <AlertTriangle size={14} className="flex-shrink-0" />
                            Toggling a flag marks the staff member for the <strong>&nbsp;next cron run&nbsp;</strong>. Notifications are sent only when the cron executes (Jan 1st or manually by SUPER_USER).
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {loadingStaff ? (
                                <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" /></div>
                            ) : filteredStaff.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
                                    <User size={32} className="opacity-30" /><p className="text-sm">No staff found.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200 text-left">
                                                {['Staff Member', 'Rank / Level', 'Unit / Department', 'Flagged?', 'Action'].map(h => (
                                                    <th key={h} className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {pagedStaff.map(staff => {
                                                const p = staff.staffProfile;
                                                if (!p) return null;
                                                const name = `${p.title ? p.title + ' ' : ''}${p.surname || staff.name || ''}`.trim();
                                                const unit = p.unit?.name || p.studyCenter?.name || p.department || '—';
                                                const isFlagged = p.isDueForPromotion ?? false;
                                                const isProcessing = flagging === p.id;
                                                return (
                                                    <tr key={staff.id} className={`transition-colors ${isFlagged ? 'bg-amber-50/50' : 'hover:bg-gray-50'}`}>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0
                                                                    ${isFlagged ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gray-400'}`}>
                                                                    {(p.surname || staff.name || 'U')[0].toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className="font-semibold text-gray-900">{name || staff.name}</p>
                                                                    <p className="text-xs text-gray-400">{p.staffId || '—'} · {staff.email}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium text-gray-800">{p.rank || '—'}</p>
                                                            <p className="text-xs text-gray-500">{p.level ? `${p.level}${p.step ? '/' + p.step : ''}` : '—'} · {p.cadre || '—'}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-700">{unit}</td>
                                                        <td className="px-4 py-3">
                                                            {isFlagged ? (
                                                                <div>
                                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                                                                        <Star size={10} /> Flagged
                                                                    </span>
                                                                    {p.promotionFlaggedAt && <p className="text-xs text-gray-400 mt-0.5">{fmtDate(p.promotionFlaggedAt)}</p>}
                                                                </div>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">Not flagged</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <button id={`flag-toggle-${p.id}`}
                                                                onClick={() => handleToggleFlag(p.id, isFlagged)}
                                                                disabled={isProcessing}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-60
                                                                    ${isFlagged ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'}`}>
                                                                {isProcessing ? <RefreshCw size={12} className="animate-spin" /> : isFlagged ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                                                                {isFlagged ? 'Remove Flag' : 'Flag for Promotion'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {/* Flag Staff Pagination */}
                            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                                <p className="text-xs text-gray-500">
                                    {filteredStaff.length === 0
                                        ? 'No staff'
                                        : `Showing ${(staffPage - 1) * staffPageSize + 1}–${Math.min(staffPage * staffPageSize, filteredStaff.length)} of ${filteredStaff.length} staff`
                                    }
                                </p>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setStaffPage(1)} disabled={staffPage === 1}
                                        className="p-1.5 rounded-lg text-gray-500 hover:bg-white disabled:opacity-40 transition border border-transparent hover:border-gray-200 text-xs font-medium px-2">«</button>
                                    <button onClick={() => setStaffPage(p => Math.max(1, p - 1))} disabled={staffPage === 1}
                                        className="p-1.5 rounded-lg text-gray-500 hover:bg-white disabled:opacity-40 transition border border-transparent hover:border-gray-200"><ChevronLeft size={16} /></button>
                                    {Array.from({ length: Math.min(staffTotalPages, 5) }, (_, i) => {
                                        const start = Math.max(1, Math.min(staffPage - 2, staffTotalPages - 4));
                                        const pg = start + i;
                                        return pg <= staffTotalPages ? (
                                            <button key={pg} onClick={() => setStaffPage(pg)}
                                                className={`min-w-[32px] h-8 rounded-lg text-xs font-semibold transition border ${
                                                    pg === staffPage
                                                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                                        : 'text-gray-600 bg-white border-gray-200 hover:border-amber-300 hover:text-amber-600'
                                                }`}>{pg}</button>
                                        ) : null;
                                    })}
                                    <button onClick={() => setStaffPage(p => Math.min(staffTotalPages, p + 1))} disabled={staffPage === staffTotalPages}
                                        className="p-1.5 rounded-lg text-gray-500 hover:bg-white disabled:opacity-40 transition border border-transparent hover:border-gray-200"><ChevronRight size={16} /></button>
                                    <button onClick={() => setStaffPage(staffTotalPages)} disabled={staffPage === staffTotalPages}
                                        className="p-1.5 rounded-lg text-gray-500 hover:bg-white disabled:opacity-40 transition border border-transparent hover:border-gray-200 text-xs font-medium px-2">»</button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
