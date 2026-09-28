'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { useSocket } from '@/context/SocketContext';
import { useRouter } from 'next/navigation';
import api, { getImageUrl } from '../../../../lib/api';
import VideoConferenceModal from '@/components/ui/VideoConferenceModal';
import Button from '@/components/ui/Button';
import {
    TrendingUp, Search, RefreshCw, Shield, ShieldAlert, CheckCircle2,
    XCircle, ChevronLeft, ChevronRight, AlertTriangle,
    Download, Calendar, User, Briefcase, Star, Filter,
    Clock, PlayCircle, ToggleLeft, ToggleRight, ClipboardList, Video,
    Edit3, History, CheckSquare, Square, Layers, Award,
    AlertCircle, Sparkles, FileText, Info, BookOpen, ExternalLink,
    FileCheck, GraduationCap, Check, X
} from 'lucide-react';

interface StaffProfileData {
    id: string;
    staffId: string | null;
    surname: string | null;
    otherNames: string | null;
    title: string | null;
    rank: string | null;
    level: string | null;
    step: string | null;
    cadre: string | null;
    cadreType?: string | null;
    currentGradeLevel?: string | null;
    lastPromotionDate?: string | null;
    dateOfLastPromotion?: string | null;
    nextDueYear?: number | null;
    nextDueDate?: string | null;
    eligibilityStatus?: string | null;
    registryOverride?: boolean;
    overrideReason?: string | null;
    evaluatedForYear?: number | null;
    isDueForPromotion?: boolean;
    promotionFlaggedAt?: string | null;
    department: string | null;
    unit: { id: string; name: string } | null;
    studyCenter: { id: string; name: string } | null;
    user: { id: string; email: string; name?: string | null } | null;
    promotionAuditLogs?: Array<{
        id: string;
        action: string;
        previousDueYear?: number | null;
        newDueYear?: number | null;
        reason: string;
        createdAt: string;
        actor: { name?: string | null; email: string };
    }>;
}

interface AuditLogItem {
    id: string;
    action: string;
    previousDueYear?: number | null;
    newDueYear?: number | null;
    previousStatus?: string | null;
    newStatus?: string | null;
    reason: string;
    metadata?: any;
    createdAt: string;
    actor: { id: string; name?: string | null; email: string; role: string };
}

const ALLOWED_ROLES = ['HR_ADMIN', 'REGISTRAR', 'VICE_CHANCELLOR', 'SUPER_USER', 'ADMIN'];
const MANAGE_ROLES = ['HR_ADMIN', 'REGISTRAR', 'VICE_CHANCELLOR', 'SUPER_USER', 'ADMIN'];

export default function DueForPromotionPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();

    // Tabs: 'docket' | 'schedule' | 'audit' | 'overrides'
    const [activeTab, setActiveTab] = useState<'docket' | 'schedule' | 'audit' | 'overrides'>('docket');

    // Pending Registrar Overrides Queue State
    const [pendingOverrides, setPendingOverrides] = useState<any[]>([]);
    const [pendingOverridesLoading, setPendingOverridesLoading] = useState(false);
    const [overrideActionLoading, setOverrideActionLoading] = useState<Record<string, boolean>>({});
    const [registrarRemarks, setRegistrarRemarks] = useState<Record<string, string>>({});

    // Data State
    const [candidates, setCandidates] = useState<StaffProfileData[]>([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(15);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
    const [cadreFilter, setCadreFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [filterTab, setFilterTab] = useState<'DUE_THIS_CYCLE' | 'MATURED_OVERDUE' | 'UPCOMING' | 'ALL'>('ALL');
    const [tabCounts, setTabCounts] = useState<{
        dueThisCycle: number;
        maturedOverdue: number;
        upcoming: number;
        all: number;
    }>({
        dueThisCycle: 0,
        maturedOverdue: 0,
        upcoming: 0,
        all: 0
    });
    const [syncingDocket, setSyncingDocket] = useState(false);
    const [summaryCounts, setSummaryCounts] = useState<Record<string, number>>({
        PENDING_MATURITY: 0,
        DUE_FOR_REVIEW: 0,
        UNDER_EVALUATION: 0,
        APPROVED: 0,
        DEFERRED: 0,
        TOTAL: 0
    });

    // Selection for Batch Actions
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [batchActionLoading, setBatchActionLoading] = useState(false);
    const [deferModalOpen, setDeferModalOpen] = useState(false);
    const [batchDeferReason, setBatchDeferReason] = useState('');

    // Schedule / Override Modal State
    const [overrideModalOpen, setOverrideModalOpen] = useState(false);
    const [activeCandidate, setActiveCandidate] = useState<StaffProfileData | null>(null);
    const [formLastPromoDate, setFormLastPromoDate] = useState('');
    const [formCadre, setFormCadre] = useState('ACADEMIC');
    const [formGradeLevel, setFormGradeLevel] = useState('');
    const [formNextDueYear, setFormNextDueYear] = useState<number | ''>('');
    const [formNextDueDate, setFormNextDueDate] = useState('');
    const [formStatus, setFormStatus] = useState('PENDING_MATURITY');
    const [formIsOverride, setFormIsOverride] = useState(false);
    const [formOverrideReason, setFormOverrideReason] = useState('');
    const [formSaving, setFormSaving] = useState(false);

    // Audit Log History Modal
    const [auditModalOpen, setAuditModalOpen] = useState(false);
    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
    const [auditCandidateName, setAuditCandidateName] = useState('');
    const [auditLoading, setAuditLoading] = useState(false);

    // Annual Maturity Engine Modal
    const [engineModalOpen, setEngineModalOpen] = useState(false);
    const [engineCycleYear, setEngineCycleYear] = useState(new Date().getFullYear());
    const [runningEngine, setRunningEngine] = useState(false);
    const [engineResult, setEngineResult] = useState<any | null>(null);

    // WebRTC Virtual Interview Panel State
    const [isMeetingOpen, setIsMeetingOpen] = useState(false);
    const [meetingRoomName, setMeetingRoomName] = useState('');
    const [meetingCandidateName, setMeetingCandidateName] = useState('');
    const { startVideoCall } = useSocket();

    // Academic Appraisal Dossier Drawer State
    const [dossierDrawerOpen, setDossierDrawerOpen] = useState(false);
    const [selectedDossierStaff, setSelectedDossierStaff] = useState<StaffProfileData | null>(null);
    const [dossierData, setDossierData] = useState<any | null>(null);
    const [dossierLoading, setDossierLoading] = useState(false);
    const [vettingLoading, setVettingLoading] = useState<Record<string, boolean>>({});
    const [vettingForm, setVettingForm] = useState<Record<string, { pointsAwarded: number; vettingRemarks: string }>>({});

    // Toast alerts
    const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const showToast = (text: string, type: 'success' | 'error') => {
        setToast({ text, type });
        setTimeout(() => setToast(null), 5000);
    };

    // RBAC Guard
    useEffect(() => {
        if (!authLoading && user && !ALLOWED_ROLES.includes(user.role)) {
            router.replace('/dashboard');
        }
    }, [user, authLoading, router]);

    // Fetch Candidates List
    const fetchDueList = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/v1/registry/promotions/due-list', {
                params: {
                    year: yearFilter,
                    cadre: cadreFilter !== 'ALL' ? cadreFilter : undefined,
                    status: statusFilter !== 'ALL' ? statusFilter : undefined,
                    tab: filterTab,
                    search: search.trim() || undefined,
                    page,
                    limit
                }
            });
            setCandidates(res.data.data);
            setTotal(res.data.total);
            setPages(res.data.pages);
            if (res.data.counts) {
                setSummaryCounts(res.data.counts);
            }
            if (res.data.tabCounts) {
                setTabCounts(res.data.tabCounts);
            }
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to load promotion candidates list.', 'error');
        } finally {
            setLoading(false);
        }
    }, [yearFilter, cadreFilter, statusFilter, filterTab, search, page, limit]);

    // Initial Promotion Docket Sync Handler
    const handleSyncCandidates = async () => {
        setSyncingDocket(true);
        try {
            const res = await api.post('/api/v1/registry/promotions/sync-candidates', {
                cycleYear: yearFilter
            });
            showToast(res.data.message || `Successfully synced ${res.data.count || 0} candidates into appraisal docket.`, 'success');
            fetchDueList();
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to sync promotion candidates.', 'error');
        } finally {
            setSyncingDocket(false);
        }
    };

    // Fetch Pending Registrar Overrides Queue
    const fetchPendingOverrides = useCallback(async () => {
        setPendingOverridesLoading(true);
        try {
            const res = await api.get('/api/v1/registry/promotions/pending-overrides');
            setPendingOverrides(res.data || []);
        } catch (err) {
            console.error('Failed to load pending overrides:', err);
        } finally {
            setPendingOverridesLoading(false);
        }
    }, []);

    const handleAuthorizeOverride = async (candidateId: string) => {
        const remarks = registrarRemarks[candidateId] || 'Authorized by Registrar';
        setOverrideActionLoading(prev => ({ ...prev, [candidateId]: true }));
        try {
            await api.post(`/api/v1/registry/promotions/${candidateId}/authorize-override`, { remarks });
            showToast('Promotion due date override authorized and committed to docket.', 'success');
            fetchPendingOverrides();
            fetchDueList();
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to authorize promotion override', 'error');
        } finally {
            setOverrideActionLoading(prev => ({ ...prev, [candidateId]: false }));
        }
    };

    const handleRejectOverride = async (candidateId: string) => {
        const reason = registrarRemarks[candidateId];
        if (!reason || !reason.trim()) {
            showToast('Please enter rejection remarks / justification before rejecting.', 'error');
            return;
        }
        setOverrideActionLoading(prev => ({ ...prev, [candidateId]: true }));
        try {
            await api.post(`/api/v1/registry/promotions/${candidateId}/reject-override`, { reason });
            showToast('Promotion override request rejected.', 'success');
            fetchPendingOverrides();
            fetchDueList();
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to reject promotion override', 'error');
        } finally {
            setOverrideActionLoading(prev => ({ ...prev, [candidateId]: false }));
        }
    };

    useEffect(() => {
        if (user && ALLOWED_ROLES.includes(user.role)) {
            fetchDueList();
            fetchPendingOverrides();
        }
    }, [fetchDueList, fetchPendingOverrides, user]);

    // Open Configure / Override Modal
    const handleOpenScheduleModal = (staff: StaffProfileData) => {
        setActiveCandidate(staff);
        const lastPromo = staff.lastPromotionDate || staff.dateOfLastPromotion
            ? new Date(staff.lastPromotionDate || staff.dateOfLastPromotion!).toISOString().split('T')[0]
            : '';
        setFormLastPromoDate(lastPromo);
        setFormCadre(staff.cadreType || staff.cadre || 'ACADEMIC');
        setFormGradeLevel(staff.currentGradeLevel || staff.level || '');
        setFormNextDueYear(staff.nextDueYear || '');
        setFormNextDueDate(staff.nextDueDate ? new Date(staff.nextDueDate).toISOString().split('T')[0] : '');
        setFormStatus(staff.eligibilityStatus || 'PENDING_MATURITY');
        setFormIsOverride(staff.registryOverride || false);
        setFormOverrideReason(staff.overrideReason || '');
        setOverrideModalOpen(true);
    };

    // Live Cadre Rule Preview Calculation
    const liveComputedRule = useMemo(() => {
        const baseYear = formLastPromoDate ? new Date(formLastPromoDate).getFullYear() : new Date().getFullYear();
        let interval = 3;
        let rule = 'Standard 3-Year Waiting Interval';
        let month = '01-01';

        const cadre = formCadre.toUpperCase();
        if (cadre === 'ACADEMIC') {
            interval = 3;
            month = '10-01';
            rule = 'Academic Cadre: 3-Year Statutory Waiting Period (October 1st Review Cycle)';
        } else if (cadre === 'SENIOR_ADMIN' || cadre === 'ADMINISTRATIVE') {
            const num = parseInt(formGradeLevel.match(/\d+/)?.[0] || '0', 10);
            if (num >= 12) {
                interval = 4;
                rule = `Senior Administrative (CONTISS ${num}): 4-Year Waiting Period for Directorate/Principal Grades`;
            } else {
                interval = 3;
                rule = `Senior Administrative (CONTISS ${num || '06-11'}): 3-Year Standard Waiting Period`;
            }
        } else if (cadre === 'JUNIOR_STAFF' || cadre === 'JUNIOR') {
            interval = 3;
            rule = 'Junior Staff Cadre: 3-Year Waiting Period (January 1st)';
        } else {
            interval = 3;
            rule = `${cadre} Cadre: 3-Year Standard Waiting Period`;
        }

        const autoYear = (isNaN(baseYear) ? new Date().getFullYear() : baseYear) + interval;
        const autoDate = `${autoYear}-${month}`;

        return { interval, autoYear, autoDate, rule };
    }, [formLastPromoDate, formCadre, formGradeLevel]);

    // Save Schedule & Override
    const handleSaveSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCandidate) return;

        if (formIsOverride || (formNextDueYear !== '' && Number(formNextDueYear) !== liveComputedRule.autoYear)) {
            if (!formOverrideReason || formOverrideReason.trim().length < 5) {
                showToast('A valid administrative override justification (min. 5 characters) is required.', 'error');
                return;
            }
        }

        setFormSaving(true);
        try {
            const payload = {
                lastPromotionDate: formLastPromoDate || null,
                cadreType: formCadre,
                currentGradeLevel: formGradeLevel.trim() || null,
                nextDueYear: formNextDueYear !== '' ? Number(formNextDueYear) : liveComputedRule.autoYear,
                nextDueDate: formNextDueDate || liveComputedRule.autoDate,
                eligibilityStatus: formStatus,
                registryOverride: formIsOverride,
                overrideReason: formOverrideReason.trim() || undefined
            };

            await api.patch(`/api/v1/registry/promotions/${activeCandidate.id}/due-date`, payload);
            showToast('Promotion schedule and audit record updated successfully.', 'success');
            setOverrideModalOpen(false);
            fetchDueList();
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to update schedule.', 'error');
        } finally {
            setFormSaving(false);
        }
    };

    // Open Audit Logs Modal
    const handleOpenAuditModal = async (staff: StaffProfileData) => {
        setActiveCandidate(staff);
        const name = `${staff.title ? staff.title + ' ' : ''}${staff.surname || ''} ${staff.otherNames || ''}`.trim() || staff.user?.name || 'Staff Member';
        setAuditCandidateName(name);
        setAuditModalOpen(true);
        setAuditLoading(true);
        try {
            const res = await api.get(`/api/v1/registry/promotions/audit-logs/${staff.id}`);
            setAuditLogs(res.data);
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to load audit history.', 'error');
        } finally {
            setAuditLoading(false);
        }
    };

    // Batch Action Handler
    const handleBatchAction = async (action: 'APPROVE_FOR_DOCKET' | 'DEFER', reason: string = 'Batch action executed from Registry console') => {
        if (selectedIds.length === 0) return;
        setBatchActionLoading(true);
        try {
            await api.post('/api/v1/registry/promotions/batch-action', {
                staffProfileIds: selectedIds,
                action,
                reason
            });
            showToast(`Batch action applied successfully to ${selectedIds.length} candidate(s).`, 'success');
            setSelectedIds([]);
            setDeferModalOpen(false);
            setBatchDeferReason('');
            fetchDueList();
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Batch action failed.', 'error');
        } finally {
            setBatchActionLoading(false);
        }
    };

    // Trigger Maturity Engine
    const handleExecuteEngine = async () => {
        setRunningEngine(true);
        setEngineResult(null);
        try {
            const res = await api.post('/api/v1/registry/promotions/evaluate-cycle', {
                cycleYear: engineCycleYear
            });
            setEngineResult(res.data.result);
            showToast(`Maturity Engine executed: ${res.data.result.maturedCount} staged, ${res.data.result.integrityHoldsCount} holds.`, 'success');
            fetchDueList();
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to execute maturity evaluation.', 'error');
        } finally {
            setRunningEngine(false);
        }
    };

    // Export CSV Dossier
    const handleExportCsv = () => {
        const url = `${api.defaults.baseURL || ''}/api/v1/registry/promotions/due-list?year=${yearFilter}&cadre=${cadreFilter !== 'ALL' ? cadreFilter : ''}&status=${statusFilter !== 'ALL' ? statusFilter : ''}&search=${encodeURIComponent(search)}&export=csv`;
        window.open(url, '_blank');
    };

    // Launch WebRTC Interview Panel
    const handleLaunchInterview = async (logId: string, name: string) => {
        setMeetingCandidateName(name);
        const room = `promotion-${logId}`;
        setMeetingRoomName(room);
        setIsMeetingOpen(true);
        startVideoCall({
            roomName: room,
            title: `Promotion Panel Interview: ${name || 'Candidate'}`,
            module: 'promotion',
            targetId: logId
        });
    };

    // Open Academic Appraisal Scoring Dossier Drawer
    const handleOpenDossierDrawer = async (staff: StaffProfileData) => {
        setSelectedDossierStaff(staff);
        setDossierDrawerOpen(true);
        setDossierLoading(true);
        try {
            const res = await api.get(`/api/v1/academic/dossier/${staff.id}`);
            setDossierData(res.data);
            const initialForm: Record<string, { pointsAwarded: number; vettingRemarks: string }> = {};
            if (res.data?.publications) {
                res.data.publications.forEach((pub: any) => {
                    initialForm[pub.id] = {
                        pointsAwarded: pub.pointsAwarded !== null && pub.pointsAwarded !== undefined && Number(pub.pointsAwarded) > 0
                            ? Number(pub.pointsAwarded)
                            : (Number(pub.pointsClaimed) || 0),
                        vettingRemarks: pub.vettingRemarks || ''
                    };
                });
            }
            setVettingForm(initialForm);
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to load candidate academic dossier.', 'error');
        } finally {
            setDossierLoading(false);
        }
    };

    // Vetting publication points & approval
    const handleVetPublication = async (pubId: string, status: 'VERIFIED' | 'REJECTED') => {
        if (!selectedDossierStaff) return;
        setVettingLoading(prev => ({ ...prev, [pubId]: true }));
        try {
            const form = vettingForm[pubId] || { pointsAwarded: 0, vettingRemarks: '' };
            await api.post(`/api/v1/academic/publications/${pubId}/vet`, {
                pointsAwarded: status === 'VERIFIED' ? Number(form.pointsAwarded) : 0,
                verificationStatus: status,
                vettingRemarks: form.vettingRemarks
            });
            showToast(status === 'VERIFIED' ? 'Publication verified and points recorded.' : 'Publication marked as rejected.', 'success');
            
            // Refresh dossier and candidate list
            const res = await api.get(`/api/v1/academic/dossier/${selectedDossierStaff.id}`);
            setDossierData(res.data);
            fetchDueList();
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to vet publication.', 'error');
        } finally {
            setVettingLoading(prev => ({ ...prev, [pubId]: false }));
        }
    };

    const statusBadge = (status?: string | null) => {
        switch (status) {
            case 'DUE_FOR_REVIEW':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300"><Star size={10} /> Due for Review</span>;
            case 'UNDER_EVALUATION':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300"><Layers size={10} /> In Docket / Evaluating</span>;
            case 'APPROVED':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300"><CheckCircle2 size={10} /> Approved</span>;
            case 'DEFERRED':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300"><XCircle size={10} /> Deferred</span>;
            case 'DISQUALIFIED_DISCIPLINARY':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300"><ShieldAlert size={10} /> Disciplinary Hold</span>;
            case 'PENDING_REGISTRAR_OVERRIDE':
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300"><Clock size={10} /> Pending Registrar Override</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300"><Clock size={10} /> Pending Maturity</span>;
        }
    };

    const fmtDate = (d?: string | null) =>
        d ? new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
            </div>
        );
    }

    if (!user || !ALLOWED_ROLES.includes(user.role)) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6 bg-slate-50">
                <Shield className="h-16 w-16 text-red-500" />
                <h1 className="text-2xl font-bold text-slate-900">403 — Access Restricted</h1>
                <p className="text-slate-600 max-w-md">This console is strictly restricted to the Central Registry Directorate and the Vice-Chancellor&apos;s Office.</p>
                <Button onClick={() => router.replace('/dashboard')} variant="primary">Return to Dashboard</Button>
            </div>
        );
    }

    const canManage = MANAGE_ROLES.includes(user.role);

    return (
        <div className="min-h-screen bg-slate-50 pb-16">
            {/* Toast Banner */}
            {toast && (
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 rounded-xl shadow-xl px-5 py-3.5 text-sm font-semibold transition-all
                    ${toast.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-600 text-white'}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    {toast.text}
                </div>
            )}

            {/* Top Navigation Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3.5">
                        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Promotion Maturity &amp; Scheduling Console</h1>
                                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">Registry Module</span>
                            </div>
                            <p className="text-xs text-slate-500">Statutory Cadre Interval Engine, Annual Promotion Docket &amp; Maturity Tracking</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        {canManage && (
                            <>
                                <Button
                                    onClick={handleSyncCandidates}
                                    isLoading={syncingDocket}
                                    variant="emerald"
                                    size="sm"
                                    icon={<Sparkles size={14} />}
                                >
                                    Run Initial Promotion Docket Sync
                                </Button>
                                <Button
                                    onClick={() => { setEngineModalOpen(true); setEngineResult(null); }}
                                    variant="amber"
                                    size="sm"
                                    icon={<PlayCircle size={15} />}
                                >
                                    Evaluate Maturity Cycle
                                </Button>
                            </>
                        )}
                        <Button
                            onClick={handleExportCsv}
                            variant="outline"
                            size="sm"
                            icon={<Download size={14} />}
                        >
                            Export Dossier (CSV)
                        </Button>
                    </div>
                </div>

                {/* Subsystem Tabs */}
                <div className="max-w-7xl mx-auto px-6 flex gap-2 border-t border-slate-100 overflow-x-auto">
                    {[
                        { id: 'docket', label: 'Annual Promotion Due List & Docket', icon: ClipboardList, count: total },
                        { id: 'schedule', label: 'Cadre Rules & Maturity Engine Info', icon: Award },
                        { id: 'audit', label: 'Governance & Audit Log', icon: History },
                        { id: 'overrides', label: 'Registrar Overrides Queue', icon: ShieldAlert, count: pendingOverrides.length }
                    ].map(({ id, label, icon: Icon, count }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id as any)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors
                                ${activeTab === id
                                    ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                        >
                            <Icon size={16} />
                            <span>{label}</span>
                            {count !== undefined && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === id ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">

                {/* KPI Overview Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                    {[
                        { label: 'Target Cycle Year', value: yearFilter, sub: 'Appraisal Cycle', icon: Calendar, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                        { label: 'Due for Review', value: summaryCounts.DUE_FOR_REVIEW || 0, sub: 'Matured Candidates', icon: Star, color: 'text-amber-700 bg-amber-50 border-amber-200' },
                        { label: 'Under Evaluation', value: summaryCounts.UNDER_EVALUATION || 0, sub: 'Staged in Docket', icon: Layers, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                        { label: 'Approved', value: summaryCounts.APPROVED || 0, sub: 'Council Confirmed', icon: CheckCircle2, color: 'text-teal-700 bg-teal-50 border-teal-200' },
                        { label: 'Deferred / Holds', value: summaryCounts.DEFERRED || 0, sub: 'Integrity / Pending', icon: AlertTriangle, color: 'text-rose-700 bg-rose-50 border-rose-200' }
                    ].map(({ label, value, sub, icon: Icon, color }) => (
                        <div key={label} className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-slate-500">{label}</p>
                                <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
                            </div>
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${color}`}>
                                <Icon size={18} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* DOCKET / RECORDS TAB */}
                {activeTab === 'docket' && (
                    <div className="space-y-4">
                        {/* Staging Scope Filter Tabs */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {[
                                { id: 'ALL', label: 'All Configured Staff', icon: Layers, count: tabCounts.all },
                                { id: 'DUE_THIS_CYCLE', label: `Due This Cycle (${yearFilter})`, icon: Star, count: tabCounts.dueThisCycle },
                                { id: 'MATURED_OVERDUE', label: 'Matured (Backlogged/Overdue)', icon: AlertTriangle, count: tabCounts.maturedOverdue },
                                { id: 'UPCOMING', label: `Upcoming (${yearFilter + 1}+)`, icon: Clock, count: tabCounts.upcoming }
                            ].map(({ id, label, icon: Icon, count }) => (
                                <button
                                    key={id}
                                    onClick={() => { setFilterTab(id as any); setPage(1); }}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap shadow-sm
                                        ${filterTab === id
                                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-emerald-200/50'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                        }`}
                                >
                                    <Icon size={14} className={filterTab === id ? 'text-white' : 'text-emerald-700'} />
                                    <span>{label}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${filterTab === id ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                        {count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Filter Bar */}
                        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                {/* Search */}
                                <div className="relative flex-1 min-w-[240px]">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search by candidate name, staff ID, rank, or unit..."
                                        value={search}
                                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                                        className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                                    />
                                </div>

                                {/* Cycle Year Selector */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-slate-500">Year:</span>
                                    <select
                                        value={yearFilter}
                                        onChange={e => { setYearFilter(parseInt(e.target.value, 10)); setPage(1); }}
                                        className="text-sm font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    >
                                        {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                                            <option key={y} value={y}>{y} Exercise</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Cadre Dropdown */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-slate-500">Cadre:</span>
                                    <select
                                        value={cadreFilter}
                                        onChange={e => { setCadreFilter(e.target.value); setPage(1); }}
                                        className="text-sm font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="ALL">All Cadres</option>
                                        <option value="ACADEMIC">Academic (3 Yrs - Oct 1)</option>
                                        <option value="SENIOR_ADMIN">Senior Admin (3/4 Yrs)</option>
                                        <option value="JUNIOR_STAFF">Junior Staff (3 Yrs)</option>
                                        <option value="TECHNICAL">Technical Staff</option>
                                        <option value="MEDICAL">Medical & Health</option>
                                        <option value="SECURITY">Security Services</option>
                                    </select>
                                </div>

                                <button
                                    onClick={fetchDueList}
                                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
                                    title="Refresh List"
                                >
                                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                                </button>
                            </div>

                            {/* Status Filter Pills */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Status:</span>
                                {[
                                    { id: 'ALL', label: 'All Statuses' },
                                    { id: 'DUE_FOR_REVIEW', label: 'Due for Review' },
                                    { id: 'UNDER_EVALUATION', label: 'Under Evaluation' },
                                    { id: 'APPROVED', label: 'Approved' },
                                    { id: 'DEFERRED', label: 'Deferred' },
                                    { id: 'PENDING_MATURITY', label: 'Pending Maturity' }
                                ].map(({ id, label }) => (
                                    <button
                                        key={id}
                                        onClick={() => { setStatusFilter(id); setPage(1); }}
                                        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors border
                                            ${statusFilter === id
                                                ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Batch Action Toolbar */}
                        {selectedIds.length > 0 && canManage && (
                            <div className="bg-emerald-900 text-white rounded-xl px-5 py-3 flex items-center justify-between gap-4 flex-wrap shadow-lg animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-3">
                                    <span className="h-7 px-2.5 rounded-md bg-emerald-800 text-emerald-200 text-xs font-bold flex items-center">
                                        {selectedIds.length} Selected
                                    </span>
                                    <span className="text-sm font-medium">Batch appraisal actions on selected candidates:</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => handleBatchAction('APPROVE_FOR_DOCKET')}
                                        isLoading={batchActionLoading}
                                        variant="emerald"
                                        size="sm"
                                        icon={<Layers size={14} />}
                                    >
                                        Stage for Appraisal Docket
                                    </Button>
                                    <Button
                                        onClick={() => setDeferModalOpen(true)}
                                        disabled={batchActionLoading}
                                        variant="danger"
                                        size="sm"
                                        icon={<XCircle size={14} />}
                                    >
                                        Defer Candidate(s)
                                    </Button>
                                    <button
                                        onClick={() => setSelectedIds([])}
                                        className="text-xs text-emerald-300 hover:text-white underline ml-2"
                                    >
                                        Deselect All
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Candidate Records Table */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-700" />
                                        <p className="text-xs font-medium text-slate-500">Querying promotion maturity index...</p>
                                    </div>
                                </div>
                            ) : candidates.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 px-4 text-slate-400 gap-3">
                                    <Award size={46} className="opacity-30 text-emerald-600" />
                                    <p className="text-base font-bold text-slate-700">No candidates found under &quot;{filterTab.replace(/_/g, ' ')}&quot; for cycle {yearFilter}</p>
                                    <p className="text-xs text-slate-500 max-w-md text-center">
                                        {tabCounts.all > 0 
                                            ? `There are ${tabCounts.all} staff members configured with institutional promotion milestones. You can view all records or upcoming cycles directly.`
                                            : 'No staff profiles have been configured with promotion milestones yet. You can initialize them or run docket sync.'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
                                        {filterTab !== 'ALL' && (
                                            <Button
                                                onClick={() => { setFilterTab('ALL'); setPage(1); }}
                                                variant="outline"
                                                size="sm"
                                                icon={<Layers size={14} />}
                                            >
                                                View All Configured Staff ({tabCounts.all})
                                            </Button>
                                        )}
                                        {filterTab !== 'UPCOMING' && tabCounts.upcoming > 0 && (
                                            <Button
                                                onClick={() => { setFilterTab('UPCOMING'); setPage(1); }}
                                                variant="outline"
                                                size="sm"
                                                icon={<Clock size={14} />}
                                            >
                                                View Upcoming Cycles ({tabCounts.upcoming})
                                            </Button>
                                        )}
                                        {canManage && (
                                            <Button
                                                onClick={handleSyncCandidates}
                                                isLoading={syncingDocket}
                                                variant="emerald"
                                                size="sm"
                                                icon={<Sparkles size={14} />}
                                            >
                                                Run Initial Promotion Docket Sync
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50/80 border-b border-slate-200 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                                {canManage && (
                                                    <th className="px-4 py-3.5 w-10 text-center">
                                                        <button
                                                            onClick={() => {
                                                                if (selectedIds.length === candidates.length) {
                                                                    setSelectedIds([]);
                                                                } else {
                                                                    setSelectedIds(candidates.map(c => c.id));
                                                                }
                                                            }}
                                                            className="text-slate-500 hover:text-slate-800"
                                                        >
                                                            {selectedIds.length === candidates.length && candidates.length > 0
                                                                ? <CheckSquare size={16} className="text-emerald-700" />
                                                                : <Square size={16} />
                                                            }
                                                        </button>
                                                    </th>
                                                )}
                                                <th className="px-4 py-3.5">Staff Candidate</th>
                                                <th className="px-4 py-3.5">Cadre & Grade Level</th>
                                                <th className="px-4 py-3.5">Unit / Department</th>
                                                <th className="px-4 py-3.5">Last Promotion</th>
                                                <th className="px-4 py-3.5">Next Due Maturity</th>
                                                <th className="px-4 py-3.5">Eligibility Status</th>
                                                <th className="px-4 py-3.5 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {candidates.map(cand => {
                                                const name = `${cand.title ? cand.title + ' ' : ''}${cand.surname || ''} ${cand.otherNames || ''}`.trim() || cand.user?.name || 'Staff Member';
                                                const unit = cand.unit?.name || cand.studyCenter?.name || cand.department || '—';
                                                const isSelected = selectedIds.includes(cand.id);

                                                return (
                                                    <tr key={cand.id} className={`transition-colors ${isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'}`}>
                                                        {canManage && (
                                                            <td className="px-4 py-3.5 text-center">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedIds(prev =>
                                                                            prev.includes(cand.id)
                                                                                ? prev.filter(id => id !== cand.id)
                                                                                : [...prev, cand.id]
                                                                        );
                                                                    }}
                                                                    className="text-slate-400 hover:text-slate-700"
                                                                >
                                                                    {isSelected ? <CheckSquare size={16} className="text-emerald-700" /> : <Square size={16} />}
                                                                </button>
                                                            </td>
                                                        )}
                                                        <td className="px-4 py-3.5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
                                                                    {(cand.surname || 'U')[0].toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-slate-900">{name}</p>
                                                                    <p className="text-xs text-slate-500">{cand.staffId || '—'} &bull; {cand.user?.email || '—'}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <p className="font-semibold text-slate-800">{cand.rank || '—'}</p>
                                                            <p className="text-xs text-slate-500">
                                                                {cand.currentGradeLevel || cand.level || '—'} &bull; <span className="font-medium text-emerald-700">{cand.cadreType || cand.cadre || 'ACADEMIC'}</span>
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <div className="flex items-center gap-1.5 text-slate-700">
                                                                <Briefcase size={14} className="text-slate-400" />
                                                                <span className="text-xs font-medium">{unit}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3.5 text-xs text-slate-600">
                                                            {fmtDate(cand.lastPromotionDate || cand.dateOfLastPromotion)}
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                                    {cand.nextDueYear || '—'}
                                                                </span>
                                                                {cand.registryOverride && (
                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300" title={`Override Reason: ${cand.overrideReason || 'N/A'}`}>
                                                                        OVERRIDDEN
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(cand.nextDueDate)}</p>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            {statusBadge(cand.eligibilityStatus)}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <button
                                                                    onClick={() => handleOpenDossierDrawer(cand)}
                                                                    className="p-1.5 rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition shadow-xs"
                                                                    title="Open Academic Appraisal Scoring & Publications Dossier"
                                                                >
                                                                    <BookOpen size={14} />
                                                                </button>
                                                                {canManage && (
                                                                    <button
                                                                        onClick={() => handleOpenScheduleModal(cand)}
                                                                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition"
                                                                        title="Configure / Override Promotion Schedule"
                                                                    >
                                                                        <Edit3 size={14} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleOpenAuditModal(cand)}
                                                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                                                                    title="View Audit Governance Log"
                                                                >
                                                                    <History size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleLaunchInterview(cand.id, name)}
                                                                    className="p-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition shadow-sm"
                                                                    title="Launch Remote WebRTC Interview Room"
                                                                >
                                                                    <Video size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination Controls */}
                            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
                                <p className="text-xs text-slate-500 font-medium">
                                    {total === 0 ? 'No records' : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total} candidates`}
                                </p>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="p-1.5 rounded-lg text-slate-600 hover:bg-white disabled:opacity-40 border border-transparent hover:border-slate-200 transition"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                                        const pg = i + 1;
                                        return (
                                            <button
                                                key={pg}
                                                onClick={() => setPage(pg)}
                                                className={`h-8 w-8 rounded-lg text-xs font-bold transition border ${
                                                    pg === page
                                                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'
                                                }`}
                                            >
                                                {pg}
                                            </button>
                                        );
                                    })}
                                    <button
                                        onClick={() => setPage(p => Math.min(pages, p + 1))}
                                        disabled={page === pages}
                                        className="p-1.5 rounded-lg text-slate-600 hover:bg-white disabled:opacity-40 border border-transparent hover:border-slate-200 transition"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* CADRE RULES & INFO TAB */}
                {activeTab === 'schedule' && (
                    <div className="space-y-5">
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                            <h2 className="text-lg font-bold text-slate-900">National Open University of Nigeria — Cadre Maturity Guidelines</h2>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                The automated maturity engine computes statutory intervals from the last official appointment or promotion milestone:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Award className="text-emerald-700" size={18} />
                                        <h3 className="font-bold text-emerald-900 text-sm">Academic Cadre (CONUASS)</h3>
                                    </div>
                                    <p className="text-xs text-slate-700 leading-relaxed">
                                        &bull; <strong>3-Year Statutory Interval</strong> across all academic teaching ranks.<br />
                                        &bull; <strong>Annual Maturity Milestone:</strong> October 1st of the evaluation year (aligned with institutional academic appraisal cycles).
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Briefcase className="text-blue-700" size={18} />
                                        <h3 className="font-bold text-blue-900 text-sm">Senior Administrative Cadre (CONTISS)</h3>
                                    </div>
                                    <p className="text-xs text-slate-700 leading-relaxed">
                                        &bull; <strong>CONTISS 06–11:</strong> 3-Year waiting interval.<br />
                                        &bull; <strong>CONTISS 12–15:</strong> 4-Year statutory interval for Principal & Directorate cadres.<br />
                                        &bull; <strong>Maturity Milestone:</strong> January 1st of evaluation year.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <User className="text-amber-700" size={18} />
                                        <h3 className="font-bold text-amber-900 text-sm">Junior Staff Cadre (CONTISS 01–05)</h3>
                                    </div>
                                    <p className="text-xs text-slate-700 leading-relaxed">
                                        &bull; <strong>3-Year Statutory Interval</strong> from last promotion/appointment date.<br />
                                        &bull; <strong>Maturity Milestone:</strong> January 1st.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Layers className="text-purple-700" size={18} />
                                        <h3 className="font-bold text-purple-900 text-sm">Technical, Medical & Security Cadres</h3>
                                    </div>
                                    <p className="text-xs text-slate-700 leading-relaxed">
                                        &bull; <strong>3-Year Standard Waiting Period</strong> subject to departmental certification and mandatory integrity clearances.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* AUDIT & GOVERNANCE LOG TAB */}
                {activeTab === 'audit' && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Registry Promotion Governance & Schedule Audit Trail</h2>
                                <p className="text-xs text-slate-500">Immutable ledger of administrative overrides, maturity engine evaluations, and status transitions.</p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-600">
                                <span>Recent Institutional Schedule Overrides</span>
                                <span>Showing latest audit events</span>
                            </div>
                            <div className="p-6 text-center text-slate-500 text-sm">
                                Click the <History size={14} className="inline mx-1 text-slate-600" /> icon next to any staff member in the Docket view to view their dedicated audit timeline.
                            </div>
                        </div>
                    </div>
                )}

                {/* REGISTRAR PROMOTION OVERRIDES QUEUE TAB */}
                {activeTab === 'overrides' && (
                    <div className="space-y-5">
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-bold text-slate-950">Registrar Promotion Due Date Authorization Queue</h2>
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                            Maker-Checker Gate
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Dual-control administrative clearance: Promotion maturity overrides staged by HR administrators remain uncommitted until formally reviewed and authorized by the Registrar or Vice Chancellor.
                                    </p>
                                </div>
                                <Button
                                    onClick={fetchPendingOverrides}
                                    variant="outline"
                                    size="sm"
                                    isLoading={pendingOverridesLoading}
                                    icon={<RefreshCw size={14} />}
                                >
                                    Refresh Queue
                                </Button>
                            </div>

                            {pendingOverridesLoading ? (
                                <div className="py-16 text-center">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-2"></div>
                                    <p className="text-xs text-slate-500">Loading pending authorization requests...</p>
                                </div>
                            ) : pendingOverrides.length === 0 ? (
                                <div className="py-16 text-center max-w-md mx-auto">
                                    <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-200">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-sm">No Pending Overrides</h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        All promotion due date schedules are currently synchronized with statutory cadre guidelines. No overrides are awaiting clearance.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 mt-4 space-y-4">
                                    {pendingOverrides.map((candidate: any) => {
                                        const calculatedYear = candidate.nextDueYear || candidate.nextPromotionDueYear || 'N/A';
                                        const requestedYear = candidate.requestedPromotionDueYear;
                                        const diffYears = typeof requestedYear === 'number' && typeof calculatedYear === 'number'
                                            ? requestedYear - calculatedYear
                                            : null;

                                        return (
                                            <div key={candidate.id} className="pt-4 first:pt-0 space-y-4">
                                                <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
                                                    {/* Candidate Title & Metadata */}
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-slate-900 text-base">
                                                                    {candidate.title ? `${candidate.title} ` : ''}{candidate.surname} {candidate.otherNames}
                                                                </h4>
                                                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold">
                                                                    {candidate.staffId || 'NO_ID'}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-0.5">
                                                                {candidate.rank || 'Staff'} &bull; {candidate.unit?.name || candidate.department || 'Headquarters'} &bull; Cadre: <strong>{candidate.cadreType || candidate.cadre || 'N/A'}</strong> (Level {candidate.currentGradeLevel || candidate.level || 'N/A'})
                                                            </p>
                                                        </div>

                                                        {candidate.promotionOverrideRequestedAt && (
                                                            <span className="text-[11px] text-slate-400">
                                                                Staged: {new Date(candidate.promotionOverrideRequestedAt).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Side-by-Side Diff View */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        {/* Statutory Cadre Calculation */}
                                                        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                                                Calculated Statutory Maturity (Cadre Rule)
                                                            </span>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-2xl font-black text-slate-800">
                                                                    {calculatedYear}
                                                                </span>
                                                                <span className="text-xs text-slate-500">
                                                                    (Standard Cycle)
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 mt-1">
                                                                Computed from official last milestone date ({candidate.lastPromotionDate ? new Date(candidate.lastPromotionDate).toISOString().split('T')[0] : 'Not Set'})
                                                            </p>
                                                        </div>

                                                        {/* Requested Administrative Override */}
                                                        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 shadow-2xs">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block">
                                                                    Requested Override Due Year (Admin Staged)
                                                                </span>
                                                                {diffYears !== null && (
                                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                                        diffYears < 0 
                                                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                                            : diffYears > 0 
                                                                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                                                                : 'bg-slate-100 text-slate-800'
                                                                    }`}>
                                                                        {diffYears < 0 ? `Accelerated (${Math.abs(diffYears)} yr)` : diffYears > 0 ? `Deferred (+${diffYears} yr)` : 'No Variance'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-2xl font-black text-amber-950">
                                                                    {requestedYear || 'Unset'}
                                                                </span>
                                                                <span className="text-xs text-amber-800 font-semibold">
                                                                    (Staged by HR)
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-amber-800 mt-1">
                                                                Pending executive confirmation by Registrar before staging in docket
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Justification Box */}
                                                    <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                                                        <span className="text-[11px] font-bold text-slate-700 block mb-1">
                                                            Administrative Justification Note:
                                                        </span>
                                                        <p className="text-xs text-slate-800 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                            &ldquo;{candidate.promotionOverrideJustification || 'No justification note recorded by submitting officer.'}&rdquo;
                                                        </p>
                                                    </div>

                                                    {/* Registrar Decision Deck */}
                                                    <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                                        <input
                                                            type="text"
                                                            placeholder="Registrar decision remarks / authorization note..."
                                                            value={registrarRemarks[candidate.id] || ''}
                                                            onChange={e => setRegistrarRemarks({ ...registrarRemarks, [candidate.id]: e.target.value })}
                                                            className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                        />

                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            <Button
                                                                onClick={() => handleRejectOverride(candidate.id)}
                                                                isLoading={overrideActionLoading[candidate.id]}
                                                                variant="danger"
                                                                size="sm"
                                                                icon={<XCircle size={14} />}
                                                            >
                                                                Reject Override
                                                            </Button>
                                                            <Button
                                                                onClick={() => handleAuthorizeOverride(candidate.id)}
                                                                isLoading={overrideActionLoading[candidate.id]}
                                                                variant="emerald"
                                                                size="sm"
                                                                icon={<CheckCircle2 size={14} />}
                                                            >
                                                                Approve Override
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* CONFIGURE / OVERRIDE PROMOTION SCHEDULE MODAL */}
            {overrideModalOpen && activeCandidate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Edit3 size={18} />
                                <h3 className="font-extrabold text-base">Configure Promotion Schedule & Override</h3>
                            </div>
                            <button onClick={() => setOverrideModalOpen(false)} className="text-white/80 hover:text-white">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveSchedule} className="p-6 space-y-4">
                            {/* Candidate Header Snapshot */}
                            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 flex items-center justify-between text-xs">
                                <div>
                                    <p className="font-bold text-slate-900">{activeCandidate.surname} {activeCandidate.otherNames} ({activeCandidate.staffId})</p>
                                    <p className="text-slate-500">{activeCandidate.rank || 'Staff'} &bull; {activeCandidate.unit?.name || 'Unit'}</p>
                                </div>
                                <div className="text-right">
                                    <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                                        Current Due: {activeCandidate.nextDueYear || 'Unset'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                {/* Last Promotion Date */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Last Promotion / Appt Date</label>
                                    <input
                                        type="date"
                                        value={formLastPromoDate}
                                        onChange={e => setFormLastPromoDate(e.target.value)}
                                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                    />
                                </div>

                                {/* Cadre Selection */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Cadre Classification</label>
                                    <select
                                        value={formCadre}
                                        onChange={e => setFormCadre(e.target.value)}
                                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                                    >
                                        <option value="ACADEMIC">Academic (3 Yrs - Oct 1)</option>
                                        <option value="SENIOR_ADMIN">Senior Admin (3/4 Yrs)</option>
                                        <option value="JUNIOR_STAFF">Junior Staff (3 Yrs)</option>
                                        <option value="TECHNICAL">Technical Staff</option>
                                        <option value="MEDICAL">Medical & Health</option>
                                        <option value="SECURITY">Security Services</option>
                                    </select>
                                </div>
                            </div>

                            {/* Grade Level */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Current Grade Level & Step</label>
                                <input
                                    type="text"
                                    placeholder="e.g. CONUASS 05, CONTISS 13/2"
                                    value={formGradeLevel}
                                    onChange={e => setFormGradeLevel(e.target.value)}
                                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                />
                            </div>

                            {/* Live Rule Banner */}
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 flex items-start gap-2.5 text-xs text-emerald-900">
                                <Sparkles size={16} className="text-emerald-700 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-bold">Cadre Statutory Rule: {liveComputedRule.rule}</p>
                                    <p className="text-[11px] text-emerald-800 mt-0.5">
                                        Auto-Computed Maturity Milestone: <strong>{liveComputedRule.autoYear}</strong> (Maturity Date: {liveComputedRule.autoDate})
                                    </p>
                                </div>
                            </div>

                            {/* Manual Override Checkbox */}
                            <div className="pt-2 border-t border-slate-100">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={formIsOverride}
                                        onChange={e => setFormIsOverride(e.target.checked)}
                                        className="h-4 w-4 rounded text-emerald-700 focus:ring-emerald-500 border-slate-300"
                                    />
                                    <span className="text-xs font-bold text-slate-800">Apply Administrative Override (Council / Special Executive Directive)</span>
                                </label>
                            </div>

                            {/* Overridden Next Due Year */}
                            {formIsOverride && (
                                <div className="space-y-3 p-3.5 bg-amber-50/60 rounded-xl border border-amber-200">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-amber-900 mb-1">Overridden Next Due Year</label>
                                            <input
                                                type="number"
                                                value={formNextDueYear}
                                                onChange={e => setFormNextDueYear(e.target.value ? parseInt(e.target.value, 10) : '')}
                                                className="w-full text-sm border border-amber-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white font-bold text-amber-950"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-amber-900 mb-1">Overridden Due Date</label>
                                            <input
                                                type="date"
                                                value={formNextDueDate}
                                                onChange={e => setFormNextDueDate(e.target.value)}
                                                className="w-full text-sm border border-amber-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-xs font-bold text-amber-900">
                                                Mandatory Override Justification Note <span className="text-red-500">*</span>
                                            </label>
                                            <span className="text-[10px] text-amber-700 font-semibold">{formOverrideReason.length}/500</span>
                                        </div>
                                        <textarea
                                            rows={3}
                                            placeholder="Provide official institutional justification (e.g. Accelerated promotion approved by Council at the 98th Statutory Meeting)..."
                                            value={formOverrideReason}
                                            onChange={e => setFormOverrideReason(e.target.value)}
                                            className="w-full text-xs border border-amber-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Eligibility Status Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Candidate Eligibility Status</label>
                                <select
                                    value={formStatus}
                                    onChange={e => setFormStatus(e.target.value)}
                                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                                >
                                    <option value="PENDING_MATURITY">Pending Maturity</option>
                                    <option value="DUE_FOR_REVIEW">Due for Review (Matured)</option>
                                    <option value="UNDER_EVALUATION">Under Evaluation (In Docket)</option>
                                    <option value="APPROVED">Approved / Promoted</option>
                                    <option value="DEFERRED">Deferred</option>
                                </select>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                                <Button type="button" onClick={() => setOverrideModalOpen(false)} variant="outline" size="sm">
                                    Cancel
                                </Button>
                                <Button type="submit" isLoading={formSaving} variant="primary" size="sm">
                                    Save Schedule & Record Audit Log
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* AUDIT LOG HISTORY MODAL */}
            {auditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <History size={18} className="text-emerald-400" />
                                <div>
                                    <h3 className="font-extrabold text-base">Promotion Schedule Audit Trail</h3>
                                    <p className="text-xs text-slate-400">{auditCandidateName}</p>
                                </div>
                            </div>
                            <button onClick={() => setAuditModalOpen(false)} className="text-white/80 hover:text-white">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
                            {auditLoading ? (
                                <div className="flex items-center justify-center h-48">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                                </div>
                            ) : auditLogs.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 text-sm">
                                    <FileText size={36} className="mx-auto opacity-30 mb-2" />
                                    No manual overrides or audit records logged yet for this candidate.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {auditLogs.map((log, idx) => (
                                        <div key={log.id || idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                                            <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                                                <span className="px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-800">
                                                    {log.action}
                                                </span>
                                                <span className="text-slate-400 font-medium">
                                                    {new Date(log.createdAt).toLocaleString('en-NG')}
                                                </span>
                                            </div>

                                            <p className="text-xs text-slate-800 font-semibold">{log.reason}</p>

                                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/80">
                                                <span>Recorded by: <strong>{log.actor?.name || log.actor?.email || 'System'}</strong> ({log.actor?.role || 'REGISTRY'})</span>
                                                {log.newDueYear && (
                                                    <span>Due Year: <strong>{log.previousDueYear || 'Unset'} &rarr; {log.newDueYear}</strong></span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <Button onClick={() => setAuditModalOpen(false)} variant="outline" size="sm">
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* BATCH DEFER REASON MODAL */}
            {deferModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="bg-rose-800 text-white px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={18} />
                                <h3 className="font-extrabold text-base">Defer {selectedIds.length} Candidate(s)</h3>
                            </div>
                            <button onClick={() => setDeferModalOpen(false)} className="text-white/80 hover:text-white">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Please provide the official administrative deferral reason. This note will be recorded in the immutable audit log and attached to each selected candidate&apos;s dossier.
                            </p>

                            <textarea
                                rows={3}
                                placeholder="e.g., Deferred by Appraisal Committee due to incomplete APER appraisal forms for 2024/2025..."
                                value={batchDeferReason}
                                onChange={e => setBatchDeferReason(e.target.value)}
                                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                            />

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <Button onClick={() => setDeferModalOpen(false)} variant="outline" size="sm">
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => handleBatchAction('DEFER', batchDeferReason)}
                                    isLoading={batchActionLoading}
                                    variant="danger"
                                    size="sm"
                                >
                                    Confirm Deferral
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ANNUAL MATURITY EVALUATION ENGINE MODAL */}
            {engineModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <PlayCircle size={20} />
                                <h3 className="font-extrabold text-base">Execute Annual Maturity Engine</h3>
                            </div>
                            <button onClick={() => setEngineModalOpen(false)} className="text-white/80 hover:text-white">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                                <Info size={16} className="text-amber-700 mt-0.5 flex-shrink-0" />
                                <p>
                                    This engine evaluates all active university staff against statutory cadre intervals, verifies integrity against open disciplinary queries, transitions mature profiles to <strong>DUE_FOR_REVIEW</strong>, and stages the official Annual Promotion Docket.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Target Appraisal Cycle Year</label>
                                <select
                                    value={engineCycleYear}
                                    onChange={e => setEngineCycleYear(parseInt(e.target.value, 10))}
                                    className="w-full text-sm font-bold border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                                >
                                    {[2024, 2025, 2026, 2027, 2028, 2029].map(y => (
                                        <option key={y} value={y}>{y} Annual Promotion Cycle</option>
                                    ))}
                                </select>
                            </div>

                            {engineResult && (
                                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-950 space-y-1">
                                    <p className="font-bold flex items-center gap-1 text-emerald-900">
                                        <CheckCircle2 size={14} /> Evaluation Cycle Completed
                                    </p>
                                    <p>Total Evaluated: <strong>{engineResult.totalCandidates}</strong></p>
                                    <p>Matured & Staged: <strong>{engineResult.maturedCount}</strong></p>
                                    <p>Integrity Holds: <strong>{engineResult.integrityHoldsCount}</strong></p>
                                    <p>Skipped: <strong>{engineResult.skippedCount}</strong></p>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <Button onClick={() => setEngineModalOpen(false)} variant="outline" size="sm">
                                    {engineResult ? 'Close' : 'Cancel'}
                                </Button>
                                <Button
                                    onClick={handleExecuteEngine}
                                    isLoading={runningEngine}
                                    variant="amber"
                                    size="sm"
                                    icon={<PlayCircle size={15} />}
                                >
                                    {runningEngine ? 'Evaluating Candidates...' : 'Run Maturity Engine Now'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ACADEMIC APPRAISAL SCORING & DOSSIER DRAWER */}
            {dossierDrawerOpen && selectedDossierStaff && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white max-w-4xl w-full h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-300">
                        {/* Drawer Header */}
                        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
                                    <BookOpen size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-extrabold text-base tracking-tight">Academic Staff Appraisal & Publications Scoring Dossier</h3>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-900 text-emerald-300 border border-emerald-700">
                                            Institutional Gate Engine
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        {selectedDossierStaff.surname} {selectedDossierStaff.otherNames} ({selectedDossierStaff.staffId || 'No ID'}) &bull; {selectedDossierStaff.rank || 'Staff'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDossierDrawerOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <XCircle size={22} />
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                            {dossierLoading ? (
                                <div className="flex flex-col items-center justify-center h-80 gap-3">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
                                    <p className="text-xs font-semibold text-slate-500">Evaluating statutory promotion criteria & publications matrix...</p>
                                </div>
                            ) : !dossierData ? (
                                <div className="text-center py-16 text-slate-400">
                                    <AlertCircle size={36} className="mx-auto mb-2 text-slate-300" />
                                    <p className="text-sm font-semibold text-slate-600">Failed to load academic appraisal dossier.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Evaluation Verdict Hero Card */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                                        <div className="flex items-center justify-between flex-wrap gap-3">
                                            <div>
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Substantive Cadre Transition</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="font-extrabold text-slate-900 text-base">
                                                        {dossierData.evaluation?.currentRankLabel || selectedDossierStaff.rank}
                                                    </span>
                                                    <span className="text-emerald-600 font-bold">&rarr;</span>
                                                    <span className="font-extrabold text-emerald-800 text-base bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                                        {dossierData.evaluation?.targetRankLabel || 'Target Rank'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {dossierData.evaluation?.overallEligible ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                        <CheckCircle2 size={14} /> QUALIFIED FOR PROMOTION
                                                    </span>
                                                ) : dossierData.evaluation?.disciplinaryGate?.passed === false ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                                        <ShieldAlert size={14} /> DISCIPLINARY HOLD
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                        <AlertTriangle size={14} /> CRITERIA DEFICIENT
                                                    </span>
                                                )}
                                                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                                                    {dossierData.evaluation?.passedGatesCount || 0} / {dossierData.evaluation?.totalGatesCount || 4} Gates Passed
                                                </span>
                                            </div>
                                        </div>

                                        {/* Publications Scoring Metric Meter */}
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2.5">
                                            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                                <span>Verified Publication Points: {dossierData.evaluation?.publicationBreakdown?.totalValidPoints || 0} / {dossierData.evaluation?.rule?.minPublicationPoints || 0} Points Required</span>
                                                <span className="text-emerald-700 font-extrabold">
                                                    {Math.min(100, Math.round(((dossierData.evaluation?.publicationBreakdown?.totalValidPoints || 0) / (dossierData.evaluation?.rule?.minPublicationPoints || 1)) * 100))}% Met
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className={`h-2.5 rounded-full transition-all duration-500 ${
                                                        (dossierData.evaluation?.publicationBreakdown?.totalValidPoints || 0) >= (dossierData.evaluation?.rule?.minPublicationPoints || 1)
                                                            ? 'bg-emerald-600'
                                                            : 'bg-amber-500'
                                                    }`}
                                                    style={{
                                                        width: `${Math.min(100, ((dossierData.evaluation?.publicationBreakdown?.totalValidPoints || 0) / (dossierData.evaluation?.rule?.minPublicationPoints || 1)) * 100)}%`
                                                    }}
                                                />
                                            </div>

                                            {/* Category Score Badges */}
                                            <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px]">
                                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold border border-blue-200">
                                                    Journals: {dossierData.evaluation?.publicationBreakdown?.categoryPoints?.JOURNAL_ARTICLE || 0} pts
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold border border-purple-200">
                                                    Books: {dossierData.evaluation?.publicationBreakdown?.categoryPoints?.ACADEMIC_BOOK || 0} pts
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200">
                                                    Chapters: {dossierData.evaluation?.publicationBreakdown?.categoryPoints?.BOOK_CHAPTER || 0} pts
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-semibold border border-teal-200">
                                                    Conferences: {dossierData.evaluation?.publicationBreakdown?.categoryPoints?.CONFERENCE_PROCEEDING || 0} pts
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold border border-amber-200">
                                                    Course Materials: {dossierData.evaluation?.publicationBreakdown?.courseMaterialsUtilizedPoints || 0} pts
                                                    {dossierData.evaluation?.publicationBreakdown?.courseMaterialsCapped && ' (Capped at 2 max)'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4 Statutory Gate Evaluation Cards */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                                            Statutory Criteria Verification Gates
                                        </h4>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {/* Gate 1: Educational Qualification */}
                                            <div className={`p-4 rounded-xl border transition-all ${
                                                dossierData.evaluation?.qualificationGate?.passed
                                                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                                                    : 'bg-rose-50/50 border-rose-200 text-rose-950'
                                            }`}>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-xs font-bold flex items-center gap-1.5">
                                                        <GraduationCap size={15} /> Educational Qualification
                                                    </span>
                                                    {dossierData.evaluation?.qualificationGate?.passed ? (
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                                                            PASSED
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-200 text-rose-800">
                                                            DEFICIENT
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-medium leading-relaxed">
                                                    {dossierData.evaluation?.qualificationGate?.details}
                                                </p>
                                                <p className="text-[11px] text-slate-500 mt-1">
                                                    Highest: <strong>{dossierData.evaluation?.highestQualification || 'Not specified'}</strong>
                                                    {dossierData.evaluation?.phdRegistrationProofUrl && (
                                                        <a
                                                            href={getImageUrl(dossierData.evaluation.phdRegistrationProofUrl)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-emerald-700 font-bold underline ml-2"
                                                        >
                                                            <ExternalLink size={10} /> Ph.D. Registration Proof
                                                        </a>
                                                    )}
                                                </p>
                                            </div>

                                            {/* Gate 2: Publication Scoring */}
                                            <div className={`p-4 rounded-xl border transition-all ${
                                                dossierData.evaluation?.publicationScoringGate?.passed
                                                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                                                    : 'bg-rose-50/50 border-rose-200 text-rose-950'
                                            }`}>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-xs font-bold flex items-center gap-1.5">
                                                        <Award size={15} /> Publication Output Scoring
                                                    </span>
                                                    {dossierData.evaluation?.publicationScoringGate?.passed ? (
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                                                            PASSED
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-200 text-rose-800">
                                                            DEFICIENT
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-medium leading-relaxed">
                                                    {dossierData.evaluation?.publicationScoringGate?.details}
                                                </p>
                                                <p className="text-[11px] text-slate-500 mt-1">
                                                    Verified Score: <strong>{dossierData.evaluation?.publicationBreakdown?.totalValidPoints || 0} pts</strong> &bull; Required: <strong>{dossierData.evaluation?.rule?.minPublicationPoints || 0} pts</strong>
                                                </p>
                                            </div>

                                            {/* Gate 3: Statutory Tenure */}
                                            <div className={`p-4 rounded-xl border transition-all ${
                                                dossierData.evaluation?.tenureGate?.passed
                                                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                                                    : 'bg-amber-50/50 border-amber-200 text-amber-950'
                                            }`}>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-xs font-bold flex items-center gap-1.5">
                                                        <Clock size={15} /> Statutory 3-Year Tenure
                                                    </span>
                                                    {dossierData.evaluation?.tenureGate?.passed ? (
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                                                            MATURED
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                                                            PENDING
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-medium leading-relaxed">
                                                    {dossierData.evaluation?.tenureGate?.details}
                                                </p>
                                            </div>

                                            {/* Gate 4: Disciplinary Clearance */}
                                            <div className={`p-4 rounded-xl border transition-all ${
                                                dossierData.evaluation?.disciplinaryGate?.passed
                                                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                                                    : 'bg-rose-50/50 border-rose-200 text-rose-950'
                                            }`}>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-xs font-bold flex items-center gap-1.5">
                                                        <Shield size={15} /> Disciplinary Clearance
                                                    </span>
                                                    {dossierData.evaluation?.disciplinaryGate?.passed ? (
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                                                            CLEARED
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-200 text-rose-800">
                                                            HOLD
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-medium leading-relaxed">
                                                    {dossierData.evaluation?.disciplinaryGate?.details}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Itemized Candidate Publications Vetting Section */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-extrabold text-slate-900">
                                                    Candidate Research Output &amp; Publications ({dossierData.publications?.length || 0})
                                                </h4>
                                                <p className="text-xs text-slate-500">
                                                    Appraisal Committee scoring, peer-review verification, and evidence offprint vetting
                                                </p>
                                            </div>
                                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                                                {dossierData.verifiedPublicationsCount || 0} Verified
                                            </span>
                                        </div>

                                        {dossierData.publications?.length === 0 ? (
                                            <div className="text-center py-10 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                                                No publications submitted by candidate yet.
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {dossierData.publications.map((pub: any) => {
                                                    const isVerified = pub.verificationStatus === 'VERIFIED';
                                                    const isRejected = pub.verificationStatus === 'REJECTED';

                                                    return (
                                                        <div
                                                            key={pub.id}
                                                            className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 transition-colors hover:border-slate-300"
                                                        >
                                                            {/* Publication Header */}
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800 uppercase">
                                                                            {pub.type?.replace(/_/g, ' ')}
                                                                        </span>
                                                                        {pub.indexingStatus && (
                                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                                                                {pub.indexingStatus}
                                                                            </span>
                                                                        )}
                                                                        {pub.peerReviewed && (
                                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                                Peer-Reviewed
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <h5 className="font-bold text-slate-900 text-sm">{pub.title}</h5>
                                                                    <p className="text-xs text-slate-600 mt-0.5">
                                                                        {pub.citation || 'No citation'} &bull; {pub.year || new Date(pub.publicationDate).getFullYear()}
                                                                        {pub.doiOrIsbn && ` • DOI/ISBN: ${pub.doiOrIsbn}`}
                                                                    </p>
                                                                </div>

                                                                {/* Status Pill */}
                                                                <div>
                                                                    {isVerified ? (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                            <CheckCircle2 size={12} /> Verified ({pub.pointsAwarded || 0} pts)
                                                                        </span>
                                                                    ) : isRejected ? (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                                                            <XCircle size={12} /> Rejected
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                                            <Clock size={12} /> Pending Vetting
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Evidence Document Link */}
                                                            {pub.evidenceDocumentUrl && (
                                                                <div className="pt-1">
                                                                    <a
                                                                        href={getImageUrl(pub.evidenceDocumentUrl)}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200"
                                                                    >
                                                                        <ExternalLink size={12} /> View Uploaded Evidence / Offprint PDF
                                                                    </a>
                                                                </div>
                                                            )}

                                                            {/* Vetting Remarks / Previous Audit */}
                                                            {pub.vettedBy && (
                                                                <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200">
                                                                    Vetted by: <strong>{pub.vettedBy?.name || pub.vettedBy?.email}</strong> on {fmtDate(pub.vettedAt)}
                                                                    {pub.vettingRemarks && <p className="mt-0.5 text-slate-700"><em>Remarks: &quot;{pub.vettingRemarks}&quot;</em></p>}
                                                                </div>
                                                            )}

                                                            {/* Committee Vetting Controls */}
                                                            {canManage && (
                                                                <div className="bg-white p-3 rounded-xl border border-slate-200/90 space-y-2.5">
                                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
                                                                        <div>
                                                                            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Points to Award</label>
                                                                            <input
                                                                                type="number"
                                                                                step="0.5"
                                                                                min="0"
                                                                                max="20"
                                                                                value={vettingForm[pub.id]?.pointsAwarded ?? (pub.pointsAwarded || pub.pointsClaimed || 0)}
                                                                                onChange={e => setVettingForm(prev => ({
                                                                                    ...prev,
                                                                                    [pub.id]: {
                                                                                        ...prev[pub.id],
                                                                                        pointsAwarded: parseFloat(e.target.value) || 0
                                                                                    }
                                                                                }))}
                                                                                className="w-full text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                                                            />
                                                                        </div>
                                                                        <div className="sm:col-span-2">
                                                                            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Appraisal Committee Remarks</label>
                                                                            <input
                                                                                type="text"
                                                                                placeholder="e.g. Scopus verified, 1st author points approved..."
                                                                                value={vettingForm[pub.id]?.vettingRemarks ?? (pub.vettingRemarks || '')}
                                                                                onChange={e => setVettingForm(prev => ({
                                                                                    ...prev,
                                                                                    [pub.id]: {
                                                                                        ...prev[pub.id],
                                                                                        vettingRemarks: e.target.value
                                                                                    }
                                                                                }))}
                                                                                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="emerald"
                                                                            isLoading={vettingLoading[pub.id]}
                                                                            onClick={() => handleVetPublication(pub.id, 'VERIFIED')}
                                                                            icon={<Check size={13} />}
                                                                        >
                                                                            Verify &amp; Award Points
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="danger"
                                                                            isLoading={vettingLoading[pub.id]}
                                                                            onClick={() => handleVetPublication(pub.id, 'REJECTED')}
                                                                            icon={<X size={13} />}
                                                                        >
                                                                            Reject
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                                Registry Academic Appraisal Verification Console &bull; NOUN HRMS
                            </span>
                            <Button onClick={() => setDossierDrawerOpen(false)} variant="outline" size="sm">
                                Close Dossier
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* REMOTE WEBRTC INTERVIEW ROOM MODAL */}
            <VideoConferenceModal
                isOpen={isMeetingOpen}
                onClose={() => setIsMeetingOpen(false)}
                roomName={meetingRoomName || 'promotion-interview'}
                userName={user?.email ? user.email.split('@')[0] : 'Panelist'}
                userEmail={user?.email || ''}
                title={`Remote Promotion Interview Room: ${meetingCandidateName || 'Candidate'}`}
                subtitle="Encrypted WebRTC Session for VC & Registry Promotion Evaluation Panel"
            />
        </div>
    );
}
