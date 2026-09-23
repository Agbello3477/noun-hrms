'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '../../../../lib/api';
import {
    FileText, Check, X, Clock, Eye, AlertCircle, ShieldCheck,
    Search, Filter, RefreshCw, Send, CheckCircle2, ChevronRight,
    Building, User, Tag, Printer, Sparkles, Stamp
} from 'lucide-react';
import StampedAcknowledgmentModal from '../../../../components/applications/StampedAcknowledgmentModal';

interface OfficialApplication {
    id: string;
    referenceNumber: string;
    applicantId: string;
    applicantName: string;
    applicantStaffId?: string | null;
    applicantRank?: string | null;
    applicantUnit?: string | null;
    applicantRole?: string | null;
    targetDirectorate: string;
    category: string;
    subject: string;
    content: string;
    urgency: string;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    status: string;
    submittedAt: string;
    acknowledgedAt?: string | null;
    registryStampNumber?: string | null;
    registryRemarks?: string | null;
    registryOfficerName?: string | null;
    registryOfficerDesignation?: string | null;
    metadata?: any;
    createdAt: string;
}

const ALLOWED_REGISTRY_ROLES = ['HR_ADMIN', 'SUPER_USER', 'ADMIN', 'VICE_CHANCELLOR'];

export default function RegistryApplicationsPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const [applications, setApplications] = useState<OfficialApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_ACKNOWLEDGMENT' | 'ACKNOWLEDGED'>('ALL');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [urgencyFilter, setUrgencyFilter] = useState('ALL');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [counts, setCounts] = useState({ pending: 0, acknowledged: 0, total: 0 });

    // Modals
    const [selectedApplication, setSelectedApplication] = useState<OfficialApplication | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);

    // Stamping Modal State
    const [stampingApplication, setStampingApplication] = useState<OfficialApplication | null>(null);
    const [stampRemarks, setStampRemarks] = useState('');
    const [stampDesignation, setStampDesignation] = useState('');
    const [stampingLoading, setStampingLoading] = useState(false);
    const [stampError, setStampError] = useState('');
    const [stampSuccess, setStampSuccess] = useState('');

    // RBAC Guard
    useEffect(() => {
        if (!authLoading && user && !ALLOWED_REGISTRY_ROLES.includes(user.role)) {
            router.replace('/dashboard');
        }
    }, [user, authLoading, router]);

    const fetchApplications = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/official-applications/incoming', {
                params: {
                    status: statusFilter,
                    category: categoryFilter,
                    urgency: urgencyFilter,
                    search: search.trim() || undefined,
                    page,
                    limit: 15
                }
            });

            setApplications(res.data.data || []);
            setTotalPages(res.data.pages || 1);
            if (res.data.counts) {
                setCounts(res.data.counts);
            }
        } catch (error) {
            console.error('Failed to fetch incoming applications', error);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, categoryFilter, urgencyFilter, search, page]);

    useEffect(() => {
        if (user && ALLOWED_REGISTRY_ROLES.includes(user.role)) {
            fetchApplications();
        }
    }, [user, fetchApplications]);

    const handleOpenStampModal = (app: OfficialApplication) => {
        setStampingApplication(app);
        setStampRemarks('Application received, logged into NOUN Central Registry records, and routed for official action.');
        setStampDesignation('Central Registry Receiving Officer');
        setStampError('');
        setStampSuccess('');
    };

    const handleExecuteStamp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stampingApplication) return;

        setStampingLoading(true);
        setStampError('');
        try {
            const res = await api.put(`/api/official-applications/${stampingApplication.id}/acknowledge`, {
                registryRemarks: stampRemarks.trim(),
                registryOfficerDesignation: stampDesignation.trim()
            });

            setStampSuccess('Application successfully stamped and acknowledged!');
            // Update in local state
            setApplications(prev => prev.map(a => a.id === stampingApplication.id ? res.data.application : a));
            setCounts(prev => ({
                ...prev,
                pending: Math.max(0, prev.pending - 1),
                acknowledged: prev.acknowledged + 1
            }));

            setTimeout(() => {
                setStampingApplication(null);
                setStampSuccess('');
                // Open the stamped viewer to show the result
                setSelectedApplication(res.data.application);
                setIsViewerOpen(true);
            }, 1000);
        } catch (err: any) {
            console.error('Failed to stamp application:', err);
            setStampError(err.response?.data?.message || 'Failed to apply Registry stamp.');
        } finally {
            setStampingLoading(false);
        }
    };

    const handleViewApplication = (app: OfficialApplication) => {
        setSelectedApplication(app);
        setIsViewerOpen(true);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="bg-[#006533]/10 text-[#006533] text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                            Central Registry Desk
                        </span>
                        <span className="text-xs text-slate-400">Incoming Official Directorate Correspondence</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mt-1">Registry Applications Docket</h1>
                    <p className="text-xs text-slate-500">
                        Review, stamp, and officially acknowledge formal applications from Directorates, Faculties, Departments, and Units.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchApplications()}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="enterprise-card p-5 border-l-4 border-l-blue-600 space-y-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Received</span>
                    <div className="text-2xl font-black text-slate-900">{counts.total}</div>
                    <span className="text-[11px] text-slate-500 font-medium">All recorded directorate applications</span>
                </div>

                <div className="enterprise-card p-5 border-l-4 border-l-amber-500 space-y-1">
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Pending Stamping</span>
                    <div className="text-2xl font-black text-amber-900">{counts.pending}</div>
                    <span className="text-[11px] text-amber-700 font-medium">Awaiting Central Registry acknowledgment</span>
                </div>

                <div className="enterprise-card p-5 border-l-4 border-l-emerald-600 space-y-1">
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Acknowledged &amp; Stamped</span>
                    <div className="text-2xl font-black text-emerald-900">{counts.acknowledged}</div>
                    <span className="text-[11px] text-emerald-700 font-medium">Stamped copies dispatched to originators</span>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="enterprise-card p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                        <button
                            onClick={() => { setStatusFilter('ALL'); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            All ({counts.total})
                        </button>
                        <button
                            onClick={() => { setStatusFilter('PENDING_ACKNOWLEDGMENT'); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                statusFilter === 'PENDING_ACKNOWLEDGMENT' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Pending Stamping ({counts.pending})
                        </button>
                        <button
                            onClick={() => { setStatusFilter('ACKNOWLEDGED'); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                statusFilter === 'ACKNOWLEDGED' ? 'bg-[#006533] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Acknowledged ({counts.acknowledged})
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full sm:w-80">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search Subject, Ref, Sender, Directorate..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006533]"
                        />
                    </div>
                </div>
            </div>

            {/* Applications Table */}
            <div className="enterprise-card overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-400 space-y-2">
                        <RefreshCw size={24} className="mx-auto animate-spin text-emerald-700" />
                        <p className="text-xs font-bold">Loading Registry Applications...</p>
                    </div>
                ) : applications.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 space-y-2">
                        <FileText size={36} className="mx-auto text-slate-300" />
                        <p className="text-sm font-bold text-slate-700">No applications found</p>
                        <p className="text-xs text-slate-400">No directorate applications matched the selected filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                                    <th className="px-6 py-3.5">Reference &amp; Date</th>
                                    <th className="px-6 py-3.5">Originator (Directorate / Sender)</th>
                                    <th className="px-6 py-3.5">Subject &amp; Category</th>
                                    <th className="px-6 py-3.5">Priority</th>
                                    <th className="px-6 py-3.5">Status</th>
                                    <th className="px-6 py-3.5 text-right">Registry Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {applications.map((app) => {
                                    const isAck = app.status === 'ACKNOWLEDGED' || !!app.registryStampNumber;
                                    return (
                                        <tr key={app.id} className="hover:bg-slate-50/80 transition">
                                            {/* Reference & Date */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-mono font-bold text-slate-900">{app.referenceNumber}</div>
                                                <div className="text-[11px] text-slate-400 font-medium">
                                                    {new Date(app.submittedAt || app.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </div>
                                            </td>

                                            {/* Originator */}
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900">{app.applicantName}</div>
                                                <div className="text-emerald-800 font-semibold text-[11px]">{app.applicantUnit || 'Unit / Directorate'}</div>
                                                {app.applicantStaffId && (
                                                    <div className="text-slate-400 text-[10px] font-mono">ID: {app.applicantStaffId}</div>
                                                )}
                                            </td>

                                            {/* Subject & Category */}
                                            <td className="px-6 py-4 max-w-xs">
                                                <div className="font-bold text-slate-900 line-clamp-1" title={app.subject}>
                                                    {app.subject}
                                                </div>
                                                <span className="inline-block mt-0.5 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                                                    {app.category.replace(/_/g, ' ')}
                                                </span>
                                            </td>

                                            {/* Urgency */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    app.urgency === 'HIGH_PRIORITY' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                                                    app.urgency === 'URGENT' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                                    'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {app.urgency}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {isAck ? (
                                                    <div className="space-y-0.5">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            <CheckCircle2 size={11} className="text-emerald-700" /> Acknowledged
                                                        </span>
                                                        <div className="text-[10px] font-mono text-emerald-900 font-semibold">
                                                            {app.registryStampNumber}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                        <Clock size={11} className="text-amber-700" /> Pending Stamping
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                                                {!isAck ? (
                                                    <button
                                                        onClick={() => handleOpenStampModal(app)}
                                                        className="bg-[#006533] hover:bg-[#005028] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 shadow-sm"
                                                    >
                                                        <ShieldCheck size={13} /> Acknowledge &amp; Stamp
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleViewApplication(app)}
                                                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5"
                                                    >
                                                        <Eye size={13} /> View Stamped Copy
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Stamping Confirmation Modal */}
            {stampingApplication && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-gradient-to-r from-[#006533] to-emerald-800 text-white px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={20} className="text-emerald-300" />
                                <h3 className="font-bold text-base">Apply Central Registry Electronic Stamp</h3>
                            </div>
                            <button
                                onClick={() => setStampingApplication(null)}
                                disabled={stampingLoading}
                                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleExecuteStamp} className="p-6 space-y-4 text-xs">
                            {stampError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-semibold flex items-center gap-2">
                                    <AlertCircle size={15} className="text-rose-600 flex-shrink-0" />
                                    <span>{stampError}</span>
                                </div>
                            )}

                            {stampSuccess && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-semibold flex items-center gap-2">
                                    <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />
                                    <span>{stampSuccess}</span>
                                </div>
                            )}

                            {/* Application Summary Card */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="font-bold text-slate-500">REF:</span>
                                    <span className="font-mono font-bold text-slate-900">{stampingApplication.referenceNumber}</span>
                                </div>
                                <div className="font-bold text-slate-900 text-sm">{stampingApplication.subject}</div>
                                <div className="text-slate-600">
                                    From: <span className="font-bold text-slate-800">{stampingApplication.applicantName}</span> ({stampingApplication.applicantUnit || 'Unit'})
                                </div>
                            </div>

                            {/* Stamp Preview Graphic Box */}
                            <div className="border-2 border-dashed border-emerald-600/40 bg-emerald-50/50 rounded-xl p-4 text-center space-y-1">
                                <div className="text-[10px] font-black text-[#006533] uppercase">
                                    Official Central Registry Seal Preview
                                </div>
                                <div className="text-xs font-black text-emerald-900 uppercase">
                                    ★ RECEIVED &amp; ACKNOWLEDGED ★
                                </div>
                                <div className="text-[11px] font-mono text-slate-600">
                                    Timestamp: {new Date().toLocaleDateString('en-GB')} @ {new Date().toLocaleTimeString('en-US')}
                                </div>
                            </div>

                            {/* Receiving Officer Designation */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Receiving Officer Designation *
                                </label>
                                <input
                                    type="text"
                                    value={stampDesignation}
                                    onChange={(e) => setStampDesignation(e.target.value)}
                                    placeholder="e.g. Central Registry Receiving Desk"
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006533]"
                                    required
                                />
                            </div>

                            {/* Official Registry Remarks */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Registry Remarks / Routing Notes
                                </label>
                                <textarea
                                    value={stampRemarks}
                                    onChange={(e) => setStampRemarks(e.target.value)}
                                    rows={3}
                                    placeholder="Add any formal remarks, file volume number, or routing notes..."
                                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006533]"
                                />
                            </div>

                            <p className="text-[11px] text-slate-500">
                                Applying the stamp will generate an authenticated acknowledgment copy with a unique serial number and immediately notify the sender.
                            </p>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setStampingApplication(null)}
                                    disabled={stampingLoading}
                                    className="px-4 py-2 text-slate-600 hover:text-slate-800 font-bold rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={stampingLoading}
                                    className="px-5 py-2 text-white bg-[#006533] hover:bg-[#005028] font-bold rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    <ShieldCheck size={15} />
                                    {stampingLoading ? 'Applying Stamp & Dispatching...' : 'Acknowledge & Apply Stamp'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stamped Copy Viewer Modal */}
            <StampedAcknowledgmentModal
                isOpen={isViewerOpen}
                onClose={() => setIsViewerOpen(false)}
                application={selectedApplication}
            />
        </div>
    );
}
