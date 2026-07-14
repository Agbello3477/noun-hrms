'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../lib/api';
import {
    DollarSign,
    ShieldAlert,
    CheckCircle2,
    XCircle,
    FileText,
    PlusCircle,
    UserCheck,
    Calendar,
    ChevronRight,
    Loader2,
    RefreshCw,
    Search
} from 'lucide-react';

interface Voucher {
    id: string;
    title: string;
    amount: number;
    description: string;
    category: string;
    status: string;
    unitId: string | null;
    auditComment: string | null;
    createdAt: string;
    createdByUser: {
        name: string | null;
        email: string;
        role: string;
    };
}

interface ReconciliationReport {
    payrollRecordId: string;
    userId: string;
    name: string;
    email: string;
    staffId: string;
    grossPay: number;
    netPay: number;
    flags: {
        level: 'CRITICAL' | 'WARNING';
        type: string;
        message: string;
    }[];
}

interface AuditScanResult {
    month: string;
    year: number;
    scannedRecords: number;
    flaggedCount: number;
    reports: ReconciliationReport[];
}

export default function BursaryDashboardPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'vouchers' | 'reconciliation'>('vouchers');
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [loadingVouchers, setLoadingVouchers] = useState(true);

    // Filter states for vouchers
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    // New Voucher Modal states
    const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
    const [voucherForm, setVoucherForm] = useState({
        title: '',
        amount: '',
        description: '',
        category: 'ALLOWANCE'
    });
    const [submittingVoucher, setSubmittingVoucher] = useState(false);

    // Audit action dialog states
    const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
    const [actionComment, setActionComment] = useState('');
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [actionType, setActionType] = useState<'AUDIT' | 'REJECT' | ''>('');

    // Reconciliation states
    const [reconMonth, setReconMonth] = useState('July');
    const [reconYear, setReconYear] = useState('2026');
    const [scanResult, setScanResult] = useState<AuditScanResult | null>(null);
    const [scanning, setScanning] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    useEffect(() => {
        fetchVouchers();
    }, [statusFilter, categoryFilter]);

    const fetchVouchers = async () => {
        try {
            setLoadingVouchers(true);
            const params: any = {};
            if (statusFilter) params.status = statusFilter;
            if (categoryFilter) params.category = categoryFilter;

            const res = await api.get('/api/vouchers', { params });
            setVouchers(res.data);
        } catch (error) {
            console.error('Failed to load vouchers:', error);
        } finally {
            setLoadingVouchers(false);
        }
    };

    const handleCreateVoucher = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingVoucher(true);
        setMsg(null);

        try {
            await api.post('/api/vouchers', voucherForm);
            setMsg({ type: 'success', text: 'Payment voucher requested successfully!' });
            setVoucherForm({ title: '', amount: '', description: '', category: 'ALLOWANCE' });
            setIsVoucherModalOpen(false);
            fetchVouchers();
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || 'Failed to submit payment voucher request';
            setMsg({ type: 'error', text: errorMsg });
        } finally {
            setSubmittingVoucher(false);
        }
    };

    const handleWorkflowAction = async (voucherId: string, status: string, comment?: string) => {
        try {
            await api.put(`/api/vouchers/${voucherId}/status`, { status, auditComment: comment });
            setMsg({ type: 'success', text: `Voucher updated to status: ${status}` });
            setIsActionModalOpen(false);
            setSelectedVoucher(null);
            setActionComment('');
            setActionType('');
            fetchVouchers();
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || 'Failed to process workflow update';
            setMsg({ type: 'error', text: errorMsg });
        }
    };

    const handleRunReconciliation = async () => {
        setScanning(true);
        setMsg(null);
        setScanResult(null);

        try {
            const res = await api.get('/api/payroll/reconciliation', {
                params: { month: reconMonth, year: Number(reconYear) }
            });
            setScanResult(res.data);
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || 'Failed to run payroll audit reconciliation';
            setMsg({ type: 'error', text: errorMsg });
        } finally {
            setScanning(false);
        }
    };

    return (
        <div className="space-y-8 p-1 md:p-2">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Bursary & Financial Audit Command</h1>
                    <p className="text-sm font-medium text-slate-500 mt-2">
                        Automate steps calculations, audit reconciliation flags, and manage payment vouchers.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsVoucherModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-3 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-700/10 hover:-translate-y-0.5 transition-all"
                    >
                        <PlusCircle size={16} /> New Payment Voucher
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {msg && (
                <div className={`p-4 rounded-xl border flex items-start gap-2 animate-in fade-in slide-in-from-top-4 duration-300 text-xs font-semibold ${
                    msg.type === 'success' ? 'bg-green-50 text-green-800 border-green-100' : 'bg-red-50 text-red-800 border-red-100'
                }`}>
                    {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}
                    <span className="flex-1">{msg.text}</span>
                </div>
            )}

            {/* Tab Swapping Header */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('vouchers')}
                    className={`pb-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'vouchers' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <FileText size={18} /> Payment Vouchers ({vouchers.length})
                </button>
                <button
                    onClick={() => setActiveTab('reconciliation')}
                    className={`pb-4 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'reconciliation' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <ShieldAlert size={18} /> Payroll Audit Reconciliation
                </button>
            </div>

            {/* TAB CONTENT: VOUCHERS LIST */}
            {activeTab === 'vouchers' && (
                <div className="space-y-6">
                    {/* Filters Bar */}
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50/50 p-4 rounded-2xl border">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filters:</div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-white border rounded-lg px-3 py-2 text-xs font-semibold outline-none text-slate-700 focus:border-emerald-500"
                        >
                            <option value="">All Statuses</option>
                            <option value="PENDING">Pending (Unit Head Review)</option>
                            <option value="RECOMMENDED_BY_HEAD">Recommended (Bursary Audit)</option>
                            <option value="AUDITED_BY_BURSARY">Audited (Final Admin Approval)</option>
                            <option value="APPROVED">Approved / Paid</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="bg-white border rounded-lg px-3 py-2 text-xs font-semibold outline-none text-slate-700 focus:border-emerald-500"
                        >
                            <option value="">All Categories</option>
                            <option value="ALLOWANCE">Allowance</option>
                            <option value="TRAVEL">Travel</option>
                            <option value="FUNDING">Funding</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </div>

                    {/* Vouchers Table */}
                    {loadingVouchers ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                        </div>
                    ) : vouchers.length === 0 ? (
                        <div className="border rounded-2xl bg-white p-12 text-center text-slate-400 font-medium">
                            No payment vouchers matching selected filters.
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                            <table className="w-full text-left text-xs font-semibold text-slate-700">
                                <thead className="bg-slate-50/75 border-b uppercase text-[10px] text-slate-400 tracking-wider">
                                    <tr>
                                        <th className="p-4">Title / Category</th>
                                        <th className="p-4">Amount</th>
                                        <th className="p-4">Requester</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {vouchers.map((v) => (
                                        <tr key={v.id} className="hover:bg-slate-50/50">
                                            <td className="p-4">
                                                <div className="font-extrabold text-slate-800">{v.title}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">{v.category}</div>
                                            </td>
                                            <td className="p-4 text-slate-900 font-extrabold">
                                                ₦{v.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold">{v.createdByUser.name || 'Anonymous'}</div>
                                                <div className="text-gray-400 text-[10px]">{v.createdByUser.email}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${
                                                    v.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    v.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                    v.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-blue-50 text-blue-700 border-blue-200'
                                                }`}>
                                                    {v.status.replace(/_/g, ' ')}
                                                </span>
                                                {v.auditComment && (
                                                    <div className="text-[10px] font-medium text-gray-500 italic mt-1.5">
                                                        "Comment: {v.auditComment}"
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    {/* RECOMMEND BUTTON: Unit Head on PENDING */}
                                                    {v.status === 'PENDING' && (user?.role === 'UNIT_HEAD' || user?.role === 'SUPER_USER' || user?.role === 'ADMIN') && (
                                                        <button
                                                            onClick={() => handleWorkflowAction(v.id, 'RECOMMENDED_BY_HEAD')}
                                                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                                                        >
                                                            Recommend
                                                        </button>
                                                    )}

                                                    {/* AUDIT BUTTON: Bursary on RECOMMENDED */}
                                                    {v.status === 'RECOMMENDED_BY_HEAD' && (user?.role === 'BURSARY' || user?.role === 'SUPER_USER' || user?.role === 'ADMIN') && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedVoucher(v);
                                                                setActionType('AUDIT');
                                                                setIsActionModalOpen(true);
                                                            }}
                                                            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                                                        >
                                                            Audit Pass
                                                        </button>
                                                    )}

                                                    {/* APPROVE BUTTON: VC or Admins on AUDITED */}
                                                    {v.status === 'AUDITED_BY_BURSARY' && ['SUPER_USER', 'HR_ADMIN', 'ADMIN', 'VICE_CHANCELLOR'].includes(user?.role || '') && (
                                                        <button
                                                            onClick={() => handleWorkflowAction(v.id, 'APPROVED')}
                                                            className="bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-sm"
                                                        >
                                                            Approve
                                                        </button>
                                                    )}

                                                    {/* REJECT BUTTON: Visible for review steps */}
                                                    {v.status !== 'APPROVED' && v.status !== 'REJECTED' && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedVoucher(v);
                                                                setActionType('REJECT');
                                                                setIsActionModalOpen(true);
                                                            }}
                                                            className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                                                        >
                                                            Reject
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: PAYROLL AUDIT RECONCILIATION */}
            {activeTab === 'reconciliation' && (
                <div className="space-y-6">
                    {/* Scanner Config Bar */}
                    <div className="flex flex-wrap items-end gap-4 bg-slate-50/50 p-6 rounded-2xl border">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Audit Month</label>
                            <select
                                value={reconMonth}
                                onChange={(e) => setReconMonth(e.target.value)}
                                className="bg-white border rounded-xl px-4 py-2.5 text-xs font-semibold outline-none text-slate-700 w-44"
                            >
                                {monthNames.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Audit Year</label>
                            <input
                                type="number"
                                value={reconYear}
                                onChange={(e) => setReconYear(e.target.value)}
                                className="bg-white border rounded-xl px-4 py-2.5 text-xs font-semibold outline-none text-slate-700 w-32"
                            />
                        </div>
                        <button
                            onClick={handleRunReconciliation}
                            disabled={scanning}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-500 text-white font-bold text-xs px-5 py-3.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-700/15"
                        >
                            {scanning ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Scan Pending Ledger
                        </button>
                    </div>

                    {/* Scan Results Panel */}
                    {scanResult ? (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="border p-5 rounded-2xl bg-white shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-500 shadow-inner">
                                        <Calendar size={24} />
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Scanned Cycle</span>
                                        <strong className="block text-xl text-slate-800 mt-0.5">{scanResult.month} {scanResult.year}</strong>
                                    </div>
                                </div>
                                <div className="border p-5 rounded-2xl bg-white shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 shadow-inner">
                                        <UserCheck size={24} />
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Ledger Accounts</span>
                                        <strong className="block text-xl text-slate-800 mt-0.5">{scanResult.scannedRecords} Pending Records</strong>
                                    </div>
                                </div>
                                <div className="border p-5 rounded-2xl bg-white shadow-sm flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-inner ${
                                        scanResult.flaggedCount > 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'
                                    }`}>
                                        <ShieldAlert size={24} />
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Audit Discrepancies</span>
                                        <strong className="block text-xl text-slate-800 mt-0.5">{scanResult.flaggedCount} Flagged Accounts</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Discrepancy Flag Lists */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-slate-800">Flagged Audit Accounts</h3>
                                {scanResult.flaggedCount === 0 ? (
                                    <div className="border p-8 text-center rounded-2xl bg-green-50 text-green-800 border-green-100 flex flex-col items-center gap-2">
                                        <CheckCircle2 size={32} className="text-green-600" />
                                        <span className="font-bold text-sm">Ledger Clean! No discrepancies or audit flags found for this cycle.</span>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {scanResult.reports.map((report) => (
                                            <div key={report.payrollRecordId} className="border p-5 rounded-2xl bg-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div className="space-y-3">
                                                    <div>
                                                        <strong className="text-slate-800 text-sm">{report.name}</strong>
                                                        <span className="text-[10px] text-gray-400 font-bold ml-2">ID: {report.staffId}</span>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {report.flags.map((flag, idx) => (
                                                            <div key={idx} className={`text-xs font-semibold p-2.5 rounded-lg border flex items-start gap-1.5 ${
                                                                flag.level === 'CRITICAL' ? 'bg-red-50 text-red-800 border-red-100' : 'bg-amber-50 text-amber-800 border-amber-100'
                                                            }`}>
                                                                {flag.level === 'CRITICAL' ? <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" /> : <ShieldAlert size={16} className="text-amber-500 mt-0.5 shrink-0" />}
                                                                <span className="flex-1">{flag.message}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="text-left md:text-right shrink-0">
                                                    <span className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Ledger Net Salary</span>
                                                    <strong className="block text-base text-red-600 mt-0.5">₦{report.netPay.toLocaleString()}</strong>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="border p-12 text-center text-slate-400 font-medium rounded-2xl bg-white">
                            Select month/year and scan the pending ledger to verify audit status.
                        </div>
                    )}
                </div>
            )}

            {/* MODAL: CREATE VOUCHER */}
            {isVoucherModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4">
                        <h2 className="text-xl font-bold text-slate-800">New Payment Voucher Request</h2>
                        <form onSubmit={handleCreateVoucher} className="space-y-4 text-xs font-semibold text-slate-500">
                            <div>
                                <label className="block mb-1">Title / Purpose</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Travel allowance for Enugu Center inspection"
                                    className="w-full border rounded-xl p-3 text-slate-700 outline-none focus:border-emerald-500"
                                    value={voucherForm.title}
                                    onChange={(e) => setVoucherForm({ ...voucherForm, title: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block mb-1">Amount (₦)</label>
                                    <input
                                        type="number"
                                        required
                                        placeholder="120000"
                                        className="w-full border rounded-xl p-3 text-slate-700 outline-none focus:border-emerald-500"
                                        value={voucherForm.amount}
                                        onChange={(e) => setVoucherForm({ ...voucherForm, amount: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1">Category</label>
                                    <select
                                        className="w-full border rounded-xl p-3 text-slate-700 outline-none focus:border-emerald-500"
                                        value={voucherForm.category}
                                        onChange={(e) => setVoucherForm({ ...voucherForm, category: e.target.value })}
                                    >
                                        <option value="ALLOWANCE">Allowance</option>
                                        <option value="TRAVEL">Travel</option>
                                        <option value="FUNDING">Funding</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block mb-1">Description</label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Provide detailed breakdown and justification for the finance audit team..."
                                    className="w-full border rounded-xl p-3 text-slate-700 outline-none focus:border-emerald-500"
                                    value={voucherForm.description}
                                    onChange={(e) => setVoucherForm({ ...voucherForm, description: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsVoucherModalOpen(false)}
                                    className="border px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 text-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingVoucher}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5"
                                >
                                    {submittingVoucher && <Loader2 size={14} className="animate-spin" />} Submit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: ACTION COMMENTS */}
            {isActionModalOpen && selectedVoucher && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4">
                        <h2 className="text-xl font-bold text-slate-800">
                            {actionType === 'AUDIT' ? '⚙️ Voucher Audit Comments' : '❌ Reject Payment Voucher'}
                        </h2>
                        <p className="text-xs text-slate-500 font-semibold">
                            Voucher: <strong className="text-slate-700">{selectedVoucher.title}</strong> (₦{selectedVoucher.amount.toLocaleString()})
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Audit Comments / Reasons {actionType === 'REJECT' && <span className="text-red-500">*</span>}
                                </label>
                                <textarea
                                    rows={3}
                                    required={actionType === 'REJECT'}
                                    placeholder={actionType === 'AUDIT' ? 'Optional review comments...' : 'Please describe the reasons for rejection...'}
                                    className="w-full border rounded-xl p-3 text-xs text-slate-700 outline-none focus:border-emerald-500 font-semibold"
                                    value={actionComment}
                                    onChange={(e) => setActionComment(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => {
                                        setIsActionModalOpen(false);
                                        setSelectedVoucher(null);
                                        setActionComment('');
                                        setActionType('');
                                    }}
                                    className="border px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 text-slate-700 text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (actionType === 'AUDIT') {
                                            handleWorkflowAction(selectedVoucher.id, 'AUDITED_BY_BURSARY', actionComment);
                                        } else {
                                            if (!actionComment.trim()) return;
                                            handleWorkflowAction(selectedVoucher.id, 'REJECTED', actionComment);
                                        }
                                    }}
                                    disabled={actionType === 'REJECT' && !actionComment.trim()}
                                    className={`font-bold px-4 py-2.5 rounded-xl shadow-sm text-xs ${
                                        actionType === 'AUDIT' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50'
                                    }`}
                                >
                                    {actionType === 'AUDIT' ? 'Audit Passed' : 'Reject Voucher'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
