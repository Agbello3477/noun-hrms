'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api, { getImageUrl } from '../../../lib/api';
import { useSwrData } from '../../../hooks/useSwrData';
import Link from 'next/link';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Plus, FileText } from 'lucide-react';
import ApplyLeaveModal from '../../../components/dashboard/ApplyLeaveModal';
import ApplySabbaticalModal from '../../../components/dashboard/ApplySabbaticalModal';
import { useAuth } from '../../../hooks/useAuth';

function LeavesContent() {
    const searchParams = useSearchParams();
    const openParam = searchParams.get('open');
    const { user, refreshUser } = useAuth();

    const { data: leaves = [], isLoading: loading, refresh: fetchMyLeaves } = useSwrData<any[]>('/api/leaves/me', { ttl: 60000 });
    const [resuming, setResuming] = useState(false);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [isSabbaticalModalOpen, setIsSabbaticalModalOpen] = useState(false);

    useEffect(() => {
        if (openParam === 'apply') {
            setIsApplyModalOpen(true);
        } else if (openParam === 'sabbatical') {
            setIsSabbaticalModalOpen(true);
        }
    }, [openParam]);

    const handleResumeFromLeave = async () => {
        setResuming(true);
        try {
            await api.post('/api/leaves/resume');
            alert('Successfully resumed from leave and restored status to Active!');
            await refreshUser();
            await fetchMyLeaves();
        } catch (error: any) {
            console.error('Failed to resume from leave:', error);
            alert(error.response?.data?.message || 'Failed to record leave resumption.');
        } finally {
            setResuming(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return (
                    <span className="px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                        <CheckCircle size={12} className="stroke-[2.5]" />
                        Approved
                    </span>
                );
            case 'REJECTED':
                return (
                    <span className="px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-bold rounded-full bg-rose-500/10 text-rose-700 border border-rose-500/20">
                        <XCircle size={12} className="stroke-[2.5]" />
                        Rejected
                    </span>
                );
            case 'RECOMMENDED':
                return (
                    <span className="px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-bold rounded-full bg-blue-500/10 text-blue-700 border border-blue-500/20">
                        <AlertCircle size={12} className="stroke-[2.5]" />
                        Recommended
                    </span>
                );
            default:
                return (
                    <span className="px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-bold rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20">
                        <Clock size={12} className="stroke-[2.5]" />
                        Pending
                    </span>
                );
        }
    };

    // Scored Stats counts
    const totalRequests = leaves.length;
    const pendingCount = leaves.filter(l => l.status === 'PENDING').length;
    const approvedCount = leaves.filter(l => l.status === 'APPROVED').length;
    const rejectedCount = leaves.filter(l => l.status === 'REJECTED').length;

    if (loading && leaves.length === 0) {
        return (
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-2">
                        <div className="h-7 w-56 bg-slate-200 rounded animate-pulse"></div>
                        <div className="h-4 w-80 bg-slate-200 rounded animate-pulse"></div>
                    </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="enterprise-card p-5 space-y-3 animate-pulse">
                            <div className="h-3 w-20 bg-slate-200 rounded"></div>
                            <div className="h-8 w-16 bg-slate-200 rounded"></div>
                        </div>
                    ))}
                </div>
                <div className="enterprise-card p-8 space-y-4 animate-pulse">
                    <div className="h-4 w-full bg-slate-200 rounded"></div>
                    <div className="h-4 w-full bg-slate-200 rounded"></div>
                    <div className="h-4 w-full bg-slate-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900">My Leave Applications</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">Track and manage your leave requests and sabbatical applications</p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <button
                        type="button"
                        onClick={() => setIsSabbaticalModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm active:scale-95"
                    >
                        <FileText size={14} />
                        <span>Sabbatical Apply</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsApplyModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006533] hover:bg-[#004d26] text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                    >
                        <Plus size={14} className="stroke-[2.5]" />
                        <span>Apply for Leave</span>
                    </button>
                </div>
            </div>

            {user?.staffProfile?.status === 'ON_LEAVE' && (
                <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm animate-in fade-in">
                    <div className="flex gap-3.5 items-center">
                        <div className="h-11 w-11 bg-emerald-600 text-white rounded-xl flex items-center justify-center flex-none shadow-sm">
                            <Clock size={22} />
                        </div>
                        <div>
                            <h3 className="font-bold text-emerald-950 text-sm">You are currently marked On Leave</h3>
                            <p className="text-xs text-emerald-800 font-medium mt-0.5">If you have returned early or officially resumed duty, record your resumption to restore your portal status to Active.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleResumeFromLeave}
                        disabled={resuming}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white text-xs font-bold rounded-xl shadow transition-all flex-none active:scale-95"
                    >
                        {resuming ? 'Recording Resumption...' : 'Record Resumption'}
                    </button>
                </div>
            )}

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="enterprise-card p-5 space-y-1 hover:border-[#006533]/30 transition-all">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Total Applied</span>
                    <span className="text-3xl font-black text-slate-900 block tracking-tight">{totalRequests}</span>
                    <span className="text-[11px] font-semibold text-slate-400">All lifetime submissions</span>
                </div>
                <div className="enterprise-card p-5 space-y-1 hover:border-amber-300 transition-all">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Pending</span>
                    <span className="text-3xl font-black text-amber-600 block tracking-tight">{pendingCount}</span>
                    <span className="text-[11px] font-semibold text-amber-600/80">Awaiting approval review</span>
                </div>
                <div className="enterprise-card p-5 space-y-1 hover:border-emerald-300 transition-all">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Approved</span>
                    <span className="text-3xl font-black text-emerald-600 block tracking-tight">{approvedCount}</span>
                    <span className="text-[11px] font-semibold text-emerald-600/80">Active & confirmed leaves</span>
                </div>
                <div className="enterprise-card p-5 space-y-1 hover:border-rose-300 transition-all">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Rejected</span>
                    <span className="text-3xl font-black text-rose-600 block tracking-tight">{rejectedCount}</span>
                    <span className="text-[11px] font-semibold text-rose-600/80">Returned requests</span>
                </div>
            </div>

            {/* Main Leaves List */}
            {leaves.length === 0 ? (
                <div className="enterprise-card p-12 text-center max-w-xl mx-auto space-y-4">
                    <div className="w-16 h-16 bg-[#006533]/10 text-[#006533] rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-[#006533]/20">
                        <Calendar size={28} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-bold text-slate-900 text-base sm:text-lg">No leave applications yet</h3>
                        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">When you submit a leave request, it will appear here with its approval status and stamped certificates.</p>
                    </div>
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => setIsApplyModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#006533] hover:bg-[#004d26] text-white text-xs font-bold transition-all shadow-md active:scale-95"
                        >
                            <Plus size={14} className="stroke-[2.5]" />
                            <span>Apply Now</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="enterprise-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="sticky top-0 bg-slate-50/95 backdrop-blur-sm text-[11px] font-bold uppercase text-slate-500 tracking-wider border-b border-slate-200/80">
                                    <th className="px-6 py-3.5">Leave Type</th>
                                    <th className="px-6 py-3.5">Duration</th>
                                    <th className="px-6 py-3.5">Dates</th>
                                    <th className="px-6 py-3.5">Reason for Apply</th>
                                    <th className="px-6 py-3.5">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {leaves.map((leave) => {
                                    const duration = leave.durationDays || Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)) || 1;
                                    return (
                                        <tr key={leave.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-bold text-slate-900 text-xs sm:text-sm">{leave.type}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-slate-700 font-semibold text-xs sm:text-sm">{duration} Days</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                                                <div className="font-bold text-slate-800">
                                                    {new Date(leave.startDate).toLocaleDateString()}
                                                </div>
                                                <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                                                    to {new Date(leave.endDate).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs text-xs text-slate-600 truncate font-medium" title={(leave.reason || '').replace(/<[^>]*>/g, '')}>
                                                {(leave.reason || '').replace(/<[^>]*>/g, '') || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-1.5 items-start">
                                                    {getStatusBadge(leave.status)}

                                                    {/* Signature block — shown for both APPROVED and REJECTED */}
                                                    {(leave.status === 'APPROVED' || leave.status === 'REJECTED') && leave.approvedBy?.staffProfile?.signatureUrl && (
                                                        <div className="mt-1 flex flex-col gap-1 border border-slate-200/80 bg-slate-50/90 p-2.5 rounded-xl shadow-sm min-w-[130px]">
                                                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                                                {leave.status === 'APPROVED' ? 'Approved by' : 'Rejected by'}:
                                                            </div>
                                                            <div className="text-[10px] text-slate-800 font-black truncate max-w-[120px]">
                                                                {leave.approvedBy.name}
                                                            </div>
                                                            <img
                                                                src={getImageUrl(leave.approvedBy.staffProfile.signatureUrl)}
                                                                alt="Signature"
                                                                className="max-h-[26px] object-contain border border-slate-200 bg-white rounded p-0.5 shadow-2xs"
                                                            />
                                                            <div className="text-[9px] text-slate-400 font-medium">
                                                                {leave.updatedAt ? new Date(leave.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {leave.status === 'REJECTED' && leave.rejectionReason && (
                                                        <span className="text-[11px] text-rose-600 max-w-[200px] whitespace-normal leading-tight italic font-medium">
                                                            &quot;{leave.rejectionReason}&quot;
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <ApplyLeaveModal
                isOpen={isApplyModalOpen}
                onClose={() => setIsApplyModalOpen(false)}
                onSuccess={fetchMyLeaves}
            />

            <ApplySabbaticalModal
                isOpen={isSabbaticalModalOpen}
                onClose={() => setIsSabbaticalModalOpen(false)}
                onSuccess={fetchMyLeaves}
            />
        </div>
    );
}

export default function LeavesPage() {
    return (
        <Suspense fallback={
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="h-10 w-48 bg-slate-200 rounded animate-pulse"></div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="enterprise-card p-5 space-y-3 animate-pulse">
                            <div className="h-3 w-20 bg-slate-200 rounded"></div>
                            <div className="h-8 w-16 bg-slate-200 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        }>
            <LeavesContent />
        </Suspense>
    );
}
