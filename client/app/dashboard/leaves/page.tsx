'use client';

import { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api, { getImageUrl } from '../../../lib/api';
import { useSwrData } from '../../../hooks/useSwrData';
import {
    Calendar, Clock, CheckCircle, XCircle, AlertCircle, Plus,
    FileText, ShieldCheck, Send, Eye, Printer, RefreshCw,
    Building, User, CheckCircle2, ChevronRight, Layers, ArrowUpRight,
    FolderOpen, PackageCheck, ExternalLink
} from 'lucide-react';
import ApplyLeaveModal from '../../../components/dashboard/ApplyLeaveModal';
import ApplySabbaticalModal from '../../../components/dashboard/ApplySabbaticalModal';
import WriteOfficialApplicationModal from '../../../components/applications/WriteOfficialApplicationModal';
import StampedAcknowledgmentModal from '../../../components/applications/StampedAcknowledgmentModal';
import ApplicationStatusBadge from '../../../components/applications/ApplicationStatusBadge';
import ApplicationProgressStepper from '../../../components/applications/ApplicationProgressStepper';
import ApplicationDetailsModal from '../../../components/applications/ApplicationDetailsModal';
import { LodgeRequisitionModal } from '../../../components/fileRequisition/LodgeRequisitionModal';
import { CustodyReleaseReceiptModal } from '../../../components/fileRequisition/CustodyReleaseReceiptModal';
import { DigitalTranscriptViewerModal } from '../../../components/fileRequisition/DigitalTranscriptViewerModal';
import { RequisitionStatusStepper, FileRequisitionStatus } from '../../../components/fileRequisition/RequisitionStatusStepper';
import { useAuth } from '../../../hooks/useAuth';

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

function LeavesContent() {
    const searchParams = useSearchParams();
    const openParam = searchParams.get('open');
    const tabParam = searchParams.get('tab');
    const appIdParam = searchParams.get('appId');
    const router = useRouter();
    const { user, refreshUser } = useAuth();

    // Primary Active Tab: 'institutional' | 'official' | 'leaves' | 'file-requisitions'
    const [mainTab, setMainTab] = useState<'institutional' | 'official' | 'leaves' | 'file-requisitions'>('institutional');

    // 1. Through Director Institutional Applications State
    const [institutionalApps, setInstitutionalApps] = useState<any[]>([]);
    const [loadingInstApps, setLoadingInstApps] = useState(false);
    const [selectedInstApp, setSelectedInstApp] = useState<any | null>(null);
    const [isInstDetailsOpen, setIsInstDetailsOpen] = useState(false);

    // File Requisitions State
    const [fileRequisitions, setFileRequisitions] = useState<any[]>([]);
    const [loadingFileReqs, setLoadingFileReqs] = useState(false);
    const [isLodgeRequisitionOpen, setIsLodgeRequisitionOpen] = useState(false);
    const [selectedRequisition, setSelectedRequisition] = useState<any | null>(null);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [isDigitalViewerOpen, setIsDigitalViewerOpen] = useState(false);

    const fetchMyFileRequisitions = useCallback(async () => {
        setLoadingFileReqs(true);
        try {
            const res = await api.get('/api/v1/registry/file-requests/my');
            if (res.data?.success) {
                setFileRequisitions(res.data.data || []);
            }
        } catch (err) {
            console.warn('Failed to load file requisitions:', err);
        } finally {
            setLoadingFileReqs(false);
        }
    }, []);

    // Resubmit Drawer State for Institutional Applications
    const [resubmittingApp, setResubmittingApp] = useState<any | null>(null);
    const [resubmitContent, setResubmitContent] = useState('');
    const [resubmitComments, setResubmitComments] = useState('');
    const [isResubmitting, setIsResubmitting] = useState(false);
    const [resubmitError, setResubmitError] = useState<string | null>(null);

    const fetchInstitutionalApps = useCallback(async () => {
        setLoadingInstApps(true);
        try {
            const res = await api.get('/api/v1/applications/my-applications');
            if (res.data?.success) {
                setInstitutionalApps(res.data.applications || []);
            }
        } catch (err) {
            console.warn('Failed to load institutional applications:', err);
        } finally {
            setLoadingInstApps(false);
        }
    }, []);

    // 2. Direct Central Registry Stamped Applications Data & Modals
    const [officialApps, setOfficialApps] = useState<OfficialApplication[]>([]);
    const [loadingApps, setLoadingApps] = useState(false);
    const [selectedApp, setSelectedApp] = useState<OfficialApplication | null>(null);
    const [isStampedViewerOpen, setIsStampedViewerOpen] = useState(false);

    const fetchOfficialApps = useCallback(async () => {
        setLoadingApps(true);
        try {
            const res = await api.get('/api/official-applications/my');
            setOfficialApps(res.data || []);
        } catch (error) {
            console.error('Failed to fetch official applications:', error);
        } finally {
            setLoadingApps(false);
        }
    }, []);

    // 3. Leaves Data & Balances
    const { data: balanceData, refresh: fetchBalances } = useSwrData<any>('/api/v1/leave/balances', { ttl: 60000 });
    const { data: v1Leaves = [], isLoading: loadingV1Leaves, refresh: fetchV1Leaves } = useSwrData<any[]>('/api/v1/leave/applications/my', { ttl: 60000 });
    const { data: legacyLeaves = [], isLoading: loadingLegacyLeaves, refresh: fetchLegacyLeaves } = useSwrData<any[]>('/api/leaves/me', { ttl: 60000 });

    const leaves = useMemo(() => {
        if (v1Leaves && v1Leaves.length > 0) return v1Leaves;
        return legacyLeaves || [];
    }, [v1Leaves, legacyLeaves]);

    const loadingLeaves = loadingV1Leaves && loadingLegacyLeaves;

    const fetchMyLeaves = useCallback(() => {
        fetchV1Leaves();
        fetchLegacyLeaves();
        fetchBalances();
    }, [fetchV1Leaves, fetchLegacyLeaves, fetchBalances]);

    // Unified Write Application Modal
    const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
    const [writeModalMode, setWriteModalMode] = useState<'THROUGH_DIRECTOR' | 'DIRECT_REGISTRY'>('THROUGH_DIRECTOR');

    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [isSabbaticalModalOpen, setIsSabbaticalModalOpen] = useState(false);
    const [resuming, setResuming] = useState(false);

    useEffect(() => {
        fetchInstitutionalApps();
        fetchOfficialApps();
        fetchMyFileRequisitions();
    }, [fetchInstitutionalApps, fetchOfficialApps, fetchMyFileRequisitions]);

    // Handle Query parameters
    useEffect(() => {
        if (openParam === 'apply') {
            setMainTab('leaves');
            setIsApplyModalOpen(true);
        } else if (openParam === 'sabbatical') {
            setMainTab('leaves');
            setIsSabbaticalModalOpen(true);
        } else if (openParam === 'write' || openParam === 'official') {
            setWriteModalMode('DIRECT_REGISTRY');
            setIsWriteModalOpen(true);
        } else if (openParam === 'institutional') {
            setWriteModalMode('THROUGH_DIRECTOR');
            setIsWriteModalOpen(true);
        } else if (openParam === 'file-requisition') {
            setMainTab('file-requisitions');
            setIsLodgeRequisitionOpen(true);
        }

        if (tabParam === 'leaves') {
            setMainTab('leaves');
        } else if (tabParam === 'official') {
            setMainTab('official');
        } else if (tabParam === 'institutional') {
            setMainTab('institutional');
        } else if (tabParam === 'file-requisitions') {
            setMainTab('file-requisitions');
        }
    }, [openParam, tabParam]);

    // Deep link to direct official app
    useEffect(() => {
        if (appIdParam && officialApps.length > 0) {
            const match = officialApps.find(a => a.id === appIdParam);
            if (match) {
                setSelectedApp(match);
                setIsStampedViewerOpen(true);
            }
        }
    }, [appIdParam, officialApps]);

    const handleExecuteResubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resubmittingApp) return;

        try {
            setIsResubmitting(true);
            setResubmitError(null);
            const res = await api.post(`/api/v1/applications/${resubmittingApp.id}/resubmit`, {
                content: resubmitContent,
                comments: resubmitComments
            });

            if (res.data?.success) {
                setResubmittingApp(null);
                await fetchInstitutionalApps();
            } else {
                setResubmitError(res.data?.error || 'Failed to resubmit application.');
            }
        } catch (err: any) {
            setResubmitError(err?.response?.data?.error || err.message || 'Resubmission failed');
        } finally {
            setIsResubmitting(false);
        }
    };

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

    // Metric counts
    const instTotal = institutionalApps.length;
    const instPending = institutionalApps.filter(a => ['SUBMITTED_TO_DIRECTOR', 'RECOMMENDED_TO_REGISTRY', 'DOCKETED_PENDING_REGISTRAR'].includes(a.status)).length;
    const instRewrite = institutionalApps.filter(a => a.status === 'RETURNED_FOR_REWRITE').length;
    const instApproved = institutionalApps.filter(a => a.status === 'APPROVED_BY_REGISTRAR').length;

    const officialTotal = officialApps.length;
    const officialPending = officialApps.filter(a => a.status === 'PENDING_ACKNOWLEDGMENT').length;
    const officialAcknowledged = officialApps.filter(a => a.status === 'ACKNOWLEDGED' || !!a.registryStampNumber).length;

    const leaveTotal = leaves.length;
    const leavePending = leaves.filter(l => l.status === 'PENDING').length;
    const leaveApproved = leaves.filter(l => l.status === 'APPROVED').length;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-[#006533] border border-emerald-300">
                            Staff Self-Service
                        </span>
                        <span className="text-xs text-slate-400 font-medium">Unified Applications Hub</span>
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900">My Applications</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
                        Draft statutory applications, route memos &ldquo;Through Director&rdquo; to Registrar, lodge direct registry letters, or manage statutory leaves.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                    <button
                        type="button"
                        onClick={() => {
                            setWriteModalMode('THROUGH_DIRECTOR');
                            setIsWriteModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#006533] hover:bg-[#004d26] text-white text-xs font-bold transition-all shadow-md active:scale-95"
                    >
                        <Send size={14} />
                        <span>Write Application</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsLodgeRequisitionOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-emerald-300 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#006533] text-xs font-bold transition-all shadow-xs active:scale-95"
                    >
                        <FolderOpen size={14} className="stroke-[2.5]" />
                        <span>Lodge File Requisition</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsApplyModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs active:scale-95"
                    >
                        <Plus size={14} className="stroke-[2.5]" />
                        <span>Apply for Leave</span>
                    </button>
                </div>
            </div>

            {/* Primary Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-2">
                <button
                    onClick={() => setMainTab('institutional')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                        mainTab === 'institutional'
                            ? 'bg-[#006533] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <FileText size={16} />
                    <span>Through Director &rarr; Registrar</span>
                    {instTotal > 0 && (
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                            mainTab === 'institutional' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                            {instTotal}
                        </span>
                    )}
                    {instRewrite > 0 && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    )}
                </button>

                <button
                    onClick={() => setMainTab('official')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                        mainTab === 'official'
                            ? 'bg-[#006533] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <ShieldCheck size={16} />
                    <span>Direct Central Registry Letters</span>
                    {officialTotal > 0 && (
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                            mainTab === 'official' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                            {officialTotal}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setMainTab('file-requisitions')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                        mainTab === 'file-requisitions'
                            ? 'bg-[#006533] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <FolderOpen size={16} />
                    <span>File Requisitions &amp; Custody</span>
                    {fileRequisitions.length > 0 && (
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                            mainTab === 'file-requisitions' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                            {fileRequisitions.length}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setMainTab('leaves')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                        mainTab === 'leaves'
                            ? 'bg-[#006533] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <Calendar size={16} />
                    <span>Leaves &amp; Sabbaticals</span>
                    {leaveTotal > 0 && (
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                            mainTab === 'leaves' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                            {leaveTotal}
                        </span>
                    )}
                </button>
            </div>

            {/* TAB 1: THROUGH DIRECTOR TO REGISTRAR */}
            {mainTab === 'institutional' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="enterprise-card p-4 space-y-1 border-l-4 border-l-blue-600">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Routed</span>
                            <span className="text-2xl font-black text-slate-900 block">{instTotal}</span>
                            <span className="text-[11px] font-semibold text-slate-400">Formal multi-tier applications</span>
                        </div>

                        <div className="enterprise-card p-4 space-y-1 border-l-4 border-l-amber-500">
                            <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block">In Transit</span>
                            <span className="text-2xl font-black text-amber-600 block">{instPending}</span>
                            <span className="text-[11px] font-semibold text-amber-600/80">Vetting / Docketing stage</span>
                        </div>

                        <div className="enterprise-card p-4 space-y-1 border-l-4 border-l-orange-500">
                            <span className="text-[10px] text-orange-600 font-bold uppercase tracking-wider block">Requires Rewrite</span>
                            <span className="text-2xl font-black text-orange-600 block">{instRewrite}</span>
                            <span className="text-[11px] font-semibold text-orange-600/80">Director returned for review</span>
                        </div>

                        <div className="enterprise-card p-4 space-y-1 border-l-4 border-l-emerald-600">
                            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Approved Orders</span>
                            <span className="text-2xl font-black text-emerald-600 block">{instApproved}</span>
                            <span className="text-[11px] font-semibold text-emerald-600/80">Sealed by University Registrar</span>
                        </div>
                    </div>

                    {/* Applications List */}
                    {loadingInstApps ? (
                        <div className="enterprise-card p-12 text-center text-slate-400 space-y-2">
                            <RefreshCw size={24} className="mx-auto animate-spin text-[#006533]" />
                            <p className="text-xs font-bold">Loading your applications...</p>
                        </div>
                    ) : institutionalApps.length === 0 ? (
                        <div className="enterprise-card p-12 text-center max-w-xl mx-auto space-y-4">
                            <div className="w-16 h-16 bg-[#006533]/10 text-[#006533] rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-[#006533]/20">
                                <FileText size={28} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-slate-900 text-base sm:text-lg">No statutory applications yet</h3>
                                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                                    You have not submitted any formal applications routed &ldquo;Through Director&rdquo; to the University Registrar.
                                </p>
                            </div>
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setWriteModalMode('THROUGH_DIRECTOR');
                                        setIsWriteModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#006533] hover:bg-[#004d26] text-white text-xs font-bold transition shadow-md active:scale-95"
                                >
                                    <Send size={14} />
                                    <span>Write Your First Application</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {institutionalApps.map((app) => (
                                <div
                                    key={app.id}
                                    className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs hover:border-slate-300 transition-all space-y-4"
                                >
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                {app.referenceNumber}
                                            </span>
                                            {app.registryDocketNumber && (
                                                <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                                    Folio: {app.registryDocketNumber}
                                                </span>
                                            )}
                                            <ApplicationStatusBadge status={app.status} />
                                            <span className="text-xs text-slate-400">
                                                Submitted: {new Date(app.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedInstApp(app);
                                                    setIsInstDetailsOpen(true);
                                                }}
                                                className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
                                            >
                                                View Dossier
                                            </button>
                                            {app.status === 'RETURNED_FOR_REWRITE' && (
                                                <button
                                                    onClick={() => {
                                                        setResubmittingApp(app);
                                                        setResubmitContent(app.content || '');
                                                        setResubmitComments('');
                                                        setResubmitError(null);
                                                    }}
                                                    className="text-xs font-bold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg transition"
                                                >
                                                    Edit &amp; Resubmit
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-base font-bold text-slate-900">{app.subject}</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Category: <span className="font-semibold text-slate-700">{app.category.replace(/_/g, ' ')}</span> &middot; 
                                            Target Directorate: <span className="font-semibold text-slate-700">{app.director?.staffProfile ? `${app.director.staffProfile.firstName} ${app.director.staffProfile.lastName}` : app.director?.email}</span>
                                        </p>
                                    </div>

                                    {/* Progress Stepper */}
                                    <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                                        <ApplicationProgressStepper status={app.status} />
                                    </div>

                                    {/* Alert banner if returned for rewrite */}
                                    {app.status === 'RETURNED_FOR_REWRITE' && app.directorRemarks && (
                                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                                            <span className="font-bold">Director Revision Directive:</span> &ldquo;{app.directorRemarks}&rdquo;
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: DIRECT CENTRAL REGISTRY LETTERS */}
            {mainTab === 'official' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="enterprise-card p-5 space-y-1 border-l-4 border-l-blue-600">
                            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Total Lodged</span>
                            <span className="text-3xl font-black text-slate-900 block tracking-tight">{officialTotal}</span>
                            <span className="text-[11px] font-semibold text-slate-400">Formal letters to Central Registry</span>
                        </div>

                        <div className="enterprise-card p-5 space-y-1 border-l-4 border-l-amber-500">
                            <span className="text-[11px] text-amber-600 font-bold uppercase tracking-wider block">Pending Stamping</span>
                            <span className="text-3xl font-black text-amber-600 block tracking-tight">{officialPending}</span>
                            <span className="text-[11px] font-semibold text-amber-600/80">Queued in Central Registry docket</span>
                        </div>

                        <div className="enterprise-card p-5 space-y-1 border-l-4 border-l-emerald-600">
                            <span className="text-[11px] text-emerald-600 font-bold uppercase tracking-wider block">Stamped &amp; Acknowledged</span>
                            <span className="text-3xl font-black text-emerald-600 block tracking-tight">{officialAcknowledged}</span>
                            <span className="text-[11px] font-semibold text-emerald-600/80">Official Stamped Copy available</span>
                        </div>
                    </div>

                    {/* Applications Table */}
                    {loadingApps ? (
                        <div className="enterprise-card p-12 text-center text-slate-400 space-y-2">
                            <RefreshCw size={24} className="mx-auto animate-spin text-[#006533]" />
                            <p className="text-xs font-bold">Loading your official applications...</p>
                        </div>
                    ) : officialApps.length === 0 ? (
                        <div className="enterprise-card p-12 text-center max-w-xl mx-auto space-y-4">
                            <div className="w-16 h-16 bg-[#006533]/10 text-[#006533] rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-[#006533]/20">
                                <ShieldCheck size={28} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-slate-900 text-base sm:text-lg">No direct letters submitted yet</h3>
                                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                                    Lodge formal letters directly with Central Registry and receive an electronic stamped acknowledgment receipt.
                                </p>
                            </div>
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setWriteModalMode('DIRECT_REGISTRY');
                                        setIsWriteModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#006533] hover:bg-[#004d26] text-white text-xs font-bold transition shadow-md active:scale-95"
                                >
                                    <Send size={14} />
                                    <span>Write Direct Application</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="enterprise-card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="sticky top-0 bg-slate-50/95 backdrop-blur-sm text-[11px] font-bold uppercase text-slate-500 tracking-wider border-b border-slate-200/80">
                                            <th className="px-6 py-3.5">Reference &amp; Date</th>
                                            <th className="px-6 py-3.5">Subject &amp; Category</th>
                                            <th className="px-6 py-3.5">Directorate / Unit</th>
                                            <th className="px-6 py-3.5">Priority</th>
                                            <th className="px-6 py-3.5">Status</th>
                                            <th className="px-6 py-3.5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs">
                                        {officialApps.map((app) => {
                                            const isAcknowledged = app.status === 'ACKNOWLEDGED' || !!app.registryStampNumber;
                                            return (
                                                <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-6 py-4 font-mono">
                                                        <span className="font-bold text-[#006533]">{app.referenceNumber}</span>
                                                        <span className="block text-[11px] text-slate-400 font-sans mt-0.5">
                                                            {new Date(app.submittedAt).toLocaleDateString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 max-w-xs">
                                                        <span className="font-bold text-slate-900 block truncate">{app.subject}</span>
                                                        <span className="text-[11px] text-slate-500 font-medium">{app.category?.replace(/_/g, ' ')}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="font-semibold text-slate-800">{app.targetDirectorate || 'Registry / HR'}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                            app.urgency === 'HIGH_PRIORITY' ? 'bg-rose-100 text-rose-800' :
                                                            app.urgency === 'URGENT' ? 'bg-amber-100 text-amber-800' :
                                                            'bg-slate-100 text-slate-700'
                                                        }`}>
                                                            {app.urgency}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                                            isAcknowledged
                                                                ? 'bg-emerald-100 text-[#006533] border border-emerald-300'
                                                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                                                        }`}>
                                                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                                            {isAcknowledged ? 'Stamped' : 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedApp(app);
                                                                setIsStampedViewerOpen(true);
                                                            }}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#006533] hover:text-white bg-emerald-50 hover:bg-[#006533] rounded-lg transition"
                                                        >
                                                            <Eye size={13} />
                                                            <span>{isAcknowledged ? 'View Stamped Copy' : 'View Letter'}</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: FILE REQUISITIONS & CUSTODY */}
            {mainTab === 'file-requisitions' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                    {/* Header Card / Quick CTA */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">Personnel File Requisitions &amp; Vault Gatepass</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Request physical confidential jackets or digital single-session transcripts authorized by the Registrar.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => router.push('/dashboard/services/file-requests')}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
                            >
                                <ExternalLink size={14} /> Full Vault Portal
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsLodgeRequisitionOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl text-white bg-emerald-700 hover:bg-emerald-800 shadow-xs"
                            >
                                <Plus size={14} /> New Requisition
                            </button>
                        </div>
                    </div>

                    {/* Requisitions List */}
                    {loadingFileReqs ? (
                        <div className="enterprise-card p-12 text-center text-slate-400 space-y-2">
                            <RefreshCw size={24} className="mx-auto animate-spin text-[#006533]" />
                            <p className="text-xs font-bold">Loading your file requisitions from Registry Vault...</p>
                        </div>
                    ) : fileRequisitions.length === 0 ? (
                        <div className="enterprise-card p-12 text-center max-w-xl mx-auto space-y-4">
                            <div className="w-16 h-16 bg-[#006533]/10 text-[#006533] rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-[#006533]/20">
                                <FolderOpen size={28} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-slate-900 text-base sm:text-lg">No file requisitions lodged yet</h3>
                                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                                    You have not submitted any personnel file custody requisitions to the Registry Vault.
                                </p>
                            </div>
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsLodgeRequisitionOpen(true)}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#006533] text-white font-bold text-xs shadow-sm hover:bg-[#004d26] transition active:scale-95"
                                >
                                    <Plus size={16} /> Lodge Personnel File Request
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {fileRequisitions.map((req) => (
                                <div
                                    key={req.id}
                                    className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-xs space-y-4 hover:border-slate-300 transition-all"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <span className="font-mono text-xs font-bold text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                {req.requisitionNumber}
                                            </span>
                                            {req.registryFolioReference && (
                                                <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                                    Folio: {req.registryFolioReference}
                                                </span>
                                            )}
                                            <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                                {req.urgencyLevel}
                                            </span>
                                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                                                Format: {req.requestedFileFormat}
                                            </span>
                                        </div>
                                        <span className="text-[11px] text-slate-400 font-medium">
                                            Submitted {new Date(req.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <span className="text-slate-400">Subject Personnel File:</span>
                                            <div className="font-bold text-slate-900 mt-0.5">
                                                {req.staffProfile?.user?.name || `${req.staffProfile?.surname || ''} ${req.staffProfile?.otherNames || ''}`}
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                Staff ID: {req.staffProfile?.staffId || 'N/A'} &bull; {req.staffProfile?.unit?.name || 'Unit'}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-slate-400">Purpose of Request:</span>
                                            <div className="text-slate-700 font-mono text-[11px] mt-0.5 bg-slate-50 p-2 rounded border border-slate-100 line-clamp-2">
                                                {req.purposeOfRequest}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stepper */}
                                    <div className="py-2">
                                        <RequisitionStatusStepper status={req.status as FileRequisitionStatus} />
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                        <div className="text-xs text-slate-500">
                                            Status: <strong className="text-slate-800">{req.status}</strong>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {req.dispatchReceiptNumber && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedRequisition(req);
                                                        setIsReceiptModalOpen(true);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
                                                >
                                                    <Printer size={13} /> View Gatepass Receipt
                                                </button>
                                            )}
                                            {(req.requestedFileFormat === 'DIGITAL_TRANSCRIPT' || req.requestedFileFormat === 'BOTH') &&
                                                (req.status === 'AUTHORIZED_BY_REGISTRAR' || req.status === 'DISPATCHED_RELEASED') && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedRequisition(req);
                                                        setIsDigitalViewerOpen(true);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white shadow-xs transition"
                                                >
                                                    <Eye size={13} /> View Digital Dossier
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: LEAVES & SABBATICALS */}
            {mainTab === 'leaves' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                    {/* Leave Balances Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="enterprise-card p-4 space-y-1 border-l-4 border-l-emerald-600">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Annual Leave Balance</span>
                            <span className="text-2xl font-black text-slate-900 block">
                                {balanceData?.annualLeaveRemaining ?? 30} Days
                            </span>
                            <span className="text-[10px] text-slate-400">Statutory Entitlement</span>
                        </div>

                        <div className="enterprise-card p-4 space-y-1 border-l-4 border-l-blue-600">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Leave Days Taken</span>
                            <span className="text-2xl font-black text-slate-900 block">
                                {balanceData?.annualLeaveUsed ?? 0} Days
                            </span>
                            <span className="text-[10px] text-slate-400">Current Academic Year</span>
                        </div>

                        <div className="enterprise-card p-4 space-y-1 border-l-4 border-l-amber-500">
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Pending Approval</span>
                            <span className="text-2xl font-black text-amber-600 block">{leavePending}</span>
                            <span className="text-[10px] text-amber-600/80">Under Unit Head / Registry review</span>
                        </div>

                        <div className="enterprise-card p-4 space-y-1 border-l-4 border-l-purple-600">
                            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Approved Applications</span>
                            <span className="text-2xl font-black text-purple-600 block">{leaveApproved}</span>
                            <span className="text-[10px] text-purple-600/80">Statutory clearances granted</span>
                        </div>
                    </div>

                    {/* Active Leaves List */}
                    {loadingLeaves ? (
                        <div className="enterprise-card p-12 text-center text-slate-400 space-y-2">
                            <RefreshCw size={24} className="mx-auto animate-spin text-[#006533]" />
                            <p className="text-xs font-bold">Loading your leave records...</p>
                        </div>
                    ) : leaves.length === 0 ? (
                        <div className="enterprise-card p-12 text-center max-w-xl mx-auto space-y-4">
                            <div className="w-16 h-16 bg-[#006533]/10 text-[#006533] rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-[#006533]/20">
                                <Calendar size={28} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-slate-900 text-base sm:text-lg">No leave applications on file</h3>
                                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                                    You have not applied for statutory annual leave, study leave, casual leave, or sabbatical.
                                </p>
                            </div>
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsApplyModalOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#006533] hover:bg-[#004d26] text-white text-xs font-bold transition shadow-md active:scale-95"
                                >
                                    <Plus size={14} />
                                    <span>Apply for Leave Now</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="enterprise-card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="sticky top-0 bg-slate-50/95 backdrop-blur-sm text-[11px] font-bold uppercase text-slate-500 tracking-wider border-b border-slate-200/80">
                                            <th className="px-6 py-3.5">Category</th>
                                            <th className="px-6 py-3.5">Start Date</th>
                                            <th className="px-6 py-3.5">End Date</th>
                                            <th className="px-6 py-3.5">Duration</th>
                                            <th className="px-6 py-3.5">Workflow Status</th>
                                            <th className="px-6 py-3.5 text-right">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs">
                                        {leaves.map((leave: any) => (
                                            <tr key={leave.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-900">
                                                    {(leave.type || leave.leaveType || 'ANNUAL').replace(/_/g, ' ')}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {new Date(leave.startDate).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {new Date(leave.endDate).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-slate-800">
                                                    {leave.days || leave.durationDays || leave.workingDaysCount || 'N/A'} Days
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                                        leave.status === 'APPROVED' ? 'bg-emerald-100 text-[#006533]' :
                                                        leave.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {leave.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-slate-500 italic max-w-xs truncate">
                                                    {leave.comment || leave.rejectionReason || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Unified Write Application Modal */}
            <WriteOfficialApplicationModal
                isOpen={isWriteModalOpen}
                onClose={() => setIsWriteModalOpen(false)}
                onSuccess={() => {
                    fetchInstitutionalApps();
                    fetchOfficialApps();
                }}
                initialMode={writeModalMode}
            />

            {/* Institutional Application Details Dossier Modal */}
            <ApplicationDetailsModal
                application={selectedInstApp}
                isOpen={isInstDetailsOpen}
                onClose={() => setIsInstDetailsOpen(false)}
            />

            {/* Resubmit Modal for Institutional Applications */}
            {resubmittingApp && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
                        <div className="flex justify-between items-center border-b pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Revise &amp; Resubmit Application</h3>
                                <p className="text-xs text-gray-500 font-mono">{resubmittingApp.referenceNumber}</p>
                            </div>
                            <button
                                onClick={() => setResubmittingApp(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        {resubmitError && (
                            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-semibold">
                                {resubmitError}
                            </div>
                        )}

                        <form onSubmit={handleExecuteResubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                    Updated Application Content *
                                </label>
                                <textarea
                                    required
                                    rows={8}
                                    value={resubmitContent}
                                    onChange={(e) => setResubmitContent(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-sans"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                    Notes / Response to Director
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Attached requested admission letter and adjusted resumption dates."
                                    value={resubmitComments}
                                    onChange={(e) => setResubmitComments(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setResubmittingApp(null)}
                                    disabled={isResubmitting}
                                    className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isResubmitting}
                                    className="px-5 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition shadow-xs flex items-center gap-2"
                                >
                                    {isResubmitting ? 'Resubmitting...' : 'Resubmit to Director'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Direct Official Stamped Application Viewer */}
            <StampedAcknowledgmentModal
                isOpen={isStampedViewerOpen}
                onClose={() => setIsStampedViewerOpen(false)}
                application={selectedApp}
            />

            {/* Apply Leave Modal */}
            <ApplyLeaveModal
                isOpen={isApplyModalOpen}
                onClose={() => setIsApplyModalOpen(false)}
                onSuccess={fetchMyLeaves}
            />

            {/* Sabbatical Modal */}
            <ApplySabbaticalModal
                isOpen={isSabbaticalModalOpen}
                onClose={() => setIsSabbaticalModalOpen(false)}
                onSuccess={fetchMyLeaves}
            />

            {/* Lodge File Requisition Modal */}
            {isLodgeRequisitionOpen && (
                <LodgeRequisitionModal
                    isOpen={isLodgeRequisitionOpen}
                    onClose={() => setIsLodgeRequisitionOpen(false)}
                    onSuccess={() => {
                        setIsLodgeRequisitionOpen(false);
                        fetchMyFileRequisitions();
                    }}
                />
            )}

            {/* Custody Release Receipt Modal */}
            {isReceiptModalOpen && selectedRequisition && (
                <CustodyReleaseReceiptModal
                    isOpen={isReceiptModalOpen}
                    onClose={() => setIsReceiptModalOpen(false)}
                    requisition={selectedRequisition}
                />
            )}

            {/* Digital Transcript Viewer Modal */}
            {isDigitalViewerOpen && selectedRequisition && (
                <DigitalTranscriptViewerModal
                    isOpen={isDigitalViewerOpen}
                    onClose={() => setIsDigitalViewerOpen(false)}
                    requisitionId={selectedRequisition.id}
                />
            )}
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
