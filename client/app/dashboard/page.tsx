'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api, { getImageUrl } from '../../lib/api';
import { 
    FileText, MapPin, DollarSign, ClipboardCheck, ArrowRight, Bell, 
    Loader2, CheckCircle, AlertTriangle, AlertOctagon, Info, Clock, History, Calendar,
    Filter, Users, TrendingUp, BarChart2
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardHome() {
    const { user, isLoading } = useAuth();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loadingNotifications, setLoadingNotifications] = useState(true);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [loadingLeaves, setLoadingLeaves] = useState(true);

    // Registry Dashboard States
    const [activities, setActivities] = useState<any[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [pendingActionsCount, setPendingActionsCount] = useState(0);
    const [analytics, setAnalytics] = useState<any>({
        totalWorkforce: 0,
        activeLeaves: { annual: 0, study: 0, sick: 0, sabbatical: 0, maternity: 0, paternity: 0, withoutPay: 0 }
    });

    // Recruitment Filter States (HR Dashboard)
    const [recruitYear, setRecruitYear] = useState(new Date().getFullYear().toString());
    const [recruitMonth, setRecruitMonth] = useState('');
    const [recruitGender, setRecruitGender] = useState('');
    const [recruitZone, setRecruitZone] = useState('');
    const [recruitData, setRecruitData] = useState<any>(null);
    const [loadingRecruit, setLoadingRecruit] = useState(false);

    // Manager Dashboard States
    const [managerStats, setManagerStats] = useState<any>({
        totalStaff: 0,
        activeLeaves: 0,
        pendingLeaves: 0,
        pendingAper: 0,
        activeQueries: 0
    });
    const [loadingManagerStats, setLoadingManagerStats] = useState(true);

    // VC Memo Broadcaster & Signature States
    const [allStaff, setAllStaff] = useState<any[]>([]);
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [memoTitle, setMemoTitle] = useState('');
    const [memoContent, setMemoContent] = useState('');
    const [memoRecipientType, setMemoRecipientType] = useState<'ALL' | 'INDIVIDUAL'>('ALL');
    const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
    const [memoAttachment, setMemoAttachment] = useState<File | null>(null);
    const [sendingMemo, setSendingMemo] = useState(false);
    const [memoSuccess, setMemoSuccess] = useState('');
    const [memoError, setMemoError] = useState('');

    // Signature states
    const [uploadingSig, setUploadingSig] = useState(false);
    const [sigSuccess, setSigSuccess] = useState('');
    const [sigError, setSigError] = useState('');
    const [currentSigUrl, setCurrentSigUrl] = useState('');

    const isRegistry = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_USER' || user?.role === 'ADMIN' || user?.role === 'VICE_CHANCELLOR';
    const isVC = user?.role === 'VICE_CHANCELLOR';


    useEffect(() => {
        if (user?.staffProfile?.signatureUrl) {
            setCurrentSigUrl(user.staffProfile.signatureUrl);
        }
    }, [user]);

    useEffect(() => {
        const fetchAllStaff = async () => {
            if (user?.role !== 'VICE_CHANCELLOR') return;
            try {
                setLoadingStaff(true);
                const { data } = await api.get('/api/staff');
                setAllStaff(data || []);
            } catch (error) {
                console.error('Failed to fetch all staff for VC', error);
            } finally {
                setLoadingStaff(false);
            }
        };
        fetchAllStaff();
    }, [user]);

    const handleVCUploadSignature = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingSig(true);
        setSigSuccess('');
        setSigError('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data } = await api.post('/api/staff/signature', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setCurrentSigUrl(data.signatureUrl);
            setSigSuccess('Signature uploaded successfully!');
        } catch (error: any) {
            console.error('Failed to upload signature', error);
            setSigError(error.response?.data?.message || 'Failed to upload signature. Please try again.');
        } finally {
            setUploadingSig(false);
        }
    };

    const handleVCSendMemo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!memoTitle || !memoContent) {
            setMemoError('Title and content are required.');
            return;
        }

        setSendingMemo(true);
        setMemoSuccess('');
        setMemoError('');

        const formData = new FormData();
        formData.append('title', memoTitle);
        formData.append('content', memoContent);
        formData.append('allowResponses', 'true');

        if (memoRecipientType === 'INDIVIDUAL' && selectedRecipients.length > 0) {
            selectedRecipients.forEach(id => {
                formData.append('recipientIds', id);
            });
        }

        if (memoAttachment) {
            formData.append('file', memoAttachment);
        }

        try {
            await api.post('/api/memos', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setMemoSuccess('Memo sent and signed successfully!');
            setMemoTitle('');
            setMemoContent('');
            setSelectedRecipients([]);
            setMemoAttachment(null);
            // Refresh memos timeline
            const [memosRes, transfersRes, queriesRes, analyticsRes] = await Promise.all([
                api.get('/api/memos').catch(() => ({ data: [] })),
                api.get('/api/registry/transfers').catch(() => ({ data: [] })),
                api.get('/api/queries').catch(() => ({ data: [] })),
                api.get('/api/analytics/dashboard').catch(() => ({ data: null }))
            ]);
            const fetchedMemos = (memosRes.data || []).map((m: any) => {
                const isDirect = !!m.recipient;
                return {
                    id: `memo-${m.id}`,
                    type: 'MEMO',
                    title: isDirect ? `Direct Memo Sent to ${m.recipient.name}` : 'Memo Broadcast Sent',
                    description: isDirect 
                        ? `Direct memo: "${m.title}" sent to ${m.recipient.name} (${m.recipient.staffProfile?.staffId || 'N/A'}) by ${m.sender?.name || 'Registry'}`
                        : `General memo: "${m.title}" broadcasted by ${m.sender?.name || 'Registry'}`,
                    createdAt: m.createdAt,
                    color: isDirect 
                        ? 'border-indigo-500 bg-indigo-50/40 text-indigo-700' 
                        : 'border-nounGreen bg-green-50/40 text-green-700'
                };
            });
            const fetchedTransfers = (transfersRes.data || []).map((t: any) => ({
                id: `transfer-${t.id}`,
                type: 'TRANSFER',
                title: 'Staff Transfer Approved',
                description: `${t.staff?.name || 'Staff member'} transferred to ${t.newCenterId || 'Headquarters'}`,
                createdAt: t.createdAt,
                color: 'border-orange-500 bg-orange-50/40 text-orange-700'
            }));
            const fetchedQueries = (queriesRes.data || []).map((q: any) => ({
                id: `query-${q.id}`,
                type: 'QUERY',
                title: 'Disciplinary Query Issued',
                description: `Query "${q.title}" issued to ${q.staff?.user?.name || 'Staff member'}`,
                createdAt: q.createdAt,
                color: 'border-blue-500 bg-blue-50/40 text-blue-700'
            }));
            const combined = [...fetchedMemos, ...fetchedTransfers, ...fetchedQueries]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setActivities(combined);
        } catch (error: any) {
            console.error('Failed to send memo', error);
            setMemoError(error.response?.data?.message || 'Failed to send memo. Please check inputs.');
        } finally {
            setSendingMemo(false);
        }
    };

    const isUnitManager = user?.role === 'STUDY_CENTER_MANAGER' || user?.role === 'UNIT_HEAD' || user?.role === 'UNIT_ADMIN';

    useEffect(() => {
        const fetchNotifications = async (silent = false) => {
            if (isRegistry || !user) return;
            try {
                if (!silent) setLoadingNotifications(true);
                const { data } = await api.get('/api/notifications');
                setNotifications(data.notifications || []);
            } catch (error) {
                console.error('Failed to load notifications', error);
            } finally {
                if (!silent) setLoadingNotifications(false);
            }
        };

        fetchNotifications(false);
        const interval = setInterval(() => {
            fetchNotifications(true);
        }, 30000);

        return () => clearInterval(interval);
    }, [user, isRegistry]);

    useEffect(() => {
        const fetchLeaves = async () => {
            if (!user) return;
            try {
                const { data } = await api.get('/api/leaves/me');
                setLeaves(data || []);
            } catch (error) {
                console.error('Failed to load leaves history', error);
            } finally {
                setLoadingLeaves(false);
            }
        };
        fetchLeaves();
    }, [user]);

    useEffect(() => {
        const fetchRegistryDashboardData = async () => {
            if (!isRegistry || !user) return;
            try {
                // Fetch recent memos, transfers, queries, and analytics
                const [memosRes, transfersRes, queriesRes, analyticsRes] = await Promise.all([
                    api.get('/api/memos').catch(() => ({ data: [] })),
                    api.get('/api/registry/transfers').catch(() => ({ data: [] })),
                    api.get('/api/queries').catch(() => ({ data: [] })),
                    api.get('/api/analytics/dashboard').catch(() => ({ data: null }))
                ]);

                const fetchedMemos = (memosRes.data || []).map((m: any) => {
                    const isDirect = !!m.recipient;
                    return {
                        id: `memo-${m.id}`,
                        type: 'MEMO',
                        title: isDirect ? `Direct Memo Sent to ${m.recipient.name}` : 'Memo Broadcast Sent',
                        description: isDirect 
                            ? `Direct memo: "${m.title}" sent to ${m.recipient.name} (${m.recipient.staffProfile?.staffId || 'N/A'}) by ${m.sender?.name || 'Registry'}`
                            : `General memo: "${m.title}" broadcasted by ${m.sender?.name || 'Registry'}`,
                        createdAt: m.createdAt,
                        color: isDirect 
                            ? 'border-indigo-500 bg-indigo-50/40 text-indigo-700' 
                            : 'border-nounGreen bg-green-50/40 text-green-700'
                    };
                });

                const fetchedTransfers = (transfersRes.data || []).map((t: any) => ({
                    id: `transfer-${t.id}`,
                    type: 'TRANSFER',
                    title: 'Staff Transfer Approved',
                    description: `${t.staff?.name || 'Staff member'} transferred to ${t.newCenterId || 'Headquarters'}`,
                    createdAt: t.createdAt,
                    color: 'border-orange-500 bg-orange-50/40 text-orange-700'
                }));

                const fetchedQueries = (queriesRes.data || []).map((q: any) => ({
                    id: `query-${q.id}`,
                    type: 'QUERY',
                    title: 'Disciplinary Query Issued',
                    description: `Query "${q.title}" issued to ${q.staff?.user?.name || 'Staff member'}`,
                    createdAt: q.createdAt,
                    color: 'border-blue-500 bg-blue-50/40 text-blue-700'
                }));

                // Combine and sort by date desc, showing all activities in a thread
                const combined = [...fetchedMemos, ...fetchedTransfers, ...fetchedQueries]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                setActivities(combined);

                const pendingActions = (transfersRes.data || []).length + (queriesRes.data || []).filter((q: any) => q.status === 'PENDING').length;
                setPendingActionsCount(pendingActions);

                if (analyticsRes && analyticsRes.data) {
                    setAnalytics(analyticsRes.data);
                }
            } catch (error) {
                console.error('Failed to fetch registry activity data', error);
            } finally {
                setLoadingActivities(false);
            }
        };

        fetchRegistryDashboardData();
        const interval = setInterval(() => {
            fetchRegistryDashboardData();
        }, 15000); // Poll every 15s to capture updates immediately

        return () => clearInterval(interval);
    }, [user, isRegistry]);

    // Recruitment analytics fetch
    useEffect(() => {
        const fetchRecruitmentData = async () => {
            if (!isRegistry || !user) return;
            try {
                setLoadingRecruit(true);
                const params = new URLSearchParams();
                if (recruitYear) params.set('year', recruitYear);
                if (recruitMonth) params.set('month', recruitMonth);
                if (recruitGender) params.set('gender', recruitGender);
                if (recruitZone) params.set('zone', recruitZone);
                const { data } = await api.get(`/api/analytics/recruitment?${params.toString()}`);
                setRecruitData(data);
            } catch (err) {
                console.error('Failed to fetch recruitment analytics', err);
            } finally {
                setLoadingRecruit(false);
            }
        };
        fetchRecruitmentData();
    }, [user, isRegistry, recruitYear, recruitMonth, recruitGender, recruitZone]);

    useEffect(() => {
        const fetchManagerStats = async () => {
            if (!isUnitManager || !user) return;
            try {
                setLoadingManagerStats(true);
                const { data } = await api.get('/api/analytics/manager');
                setManagerStats(data);
            } catch (error) {
                console.error('Failed to fetch manager dashboard stats', error);
            } finally {
                setLoadingManagerStats(false);
            }
        };

        fetchManagerStats();
        const interval = setInterval(() => {
            fetchManagerStats();
        }, 30000); // Poll manager stats every 30s
        return () => clearInterval(interval);
    }, [user, isUnitManager]);

    // Guard: show loading spinner while auth state is resolving or user is not yet set
    // (must be after all hooks to respect React Rules of Hooks)
    if (isLoading || !user) {
        return (
            <div className="flex h-full min-h-[60vh] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-nounGreen" />
            </div>
        );
    }

    // Calculate leave status and details for current user
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseUTCDateToLocal = (dateInput: any) => {
        if (!dateInput) return new Date(0);
        const isoString = typeof dateInput === 'string' ? dateInput : new Date(dateInput).toISOString();
        const parts = isoString.split('T')[0].split('-');
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    };

    const activeLeave = leaves.find(l => {
        if (l.status !== 'APPROVED') return false;
        const start = parseUTCDateToLocal(l.startDate);
        const end = parseUTCDateToLocal(l.endDate);
        return today >= start && today <= end;
    });

    const isOnLeave = user?.staffProfile?.status === 'ON_LEAVE';
    const dutyStatus = isOnLeave ? 'ON LEAVE' : 'ACTIVE';
    
    // Days applied for (duration of the active leave, or most recent request if not active)
    const latestLeave = leaves[0];
    const appliedDays = activeLeave ? (activeLeave.durationDays || 0) : (latestLeave ? (latestLeave.durationDays || 0) : 0);

    // Resumption Date
    let resumptionDateStr = 'N/A';
    const targetLeave = activeLeave || leaves.find(l => l.status === 'APPROVED');
    if (targetLeave) {
        const resDate = new Date(targetLeave.endDate);
        resDate.setDate(resDate.getDate() + 1);
        resumptionDateStr = resDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Remaining Annual Leave Days (30 - used annual leave days this year)
    const currentYear = today.getFullYear();
    const approvedAnnualThisYear = leaves.filter(l => {
        return l.status === 'APPROVED' && 
               l.type === 'ANNUAL' && 
               new Date(l.startDate).getFullYear() === currentYear;
    });
    const usedDays = approvedAnnualThisYear.reduce((sum, l) => sum + (l.durationDays || 0), 0);
    const remainingDays = Math.max(0, 30 - usedDays);

    // VC Executive Portal Dashboard View
    if (isVC) {
        const activeLeavesCount = Object.values(analytics.activeLeaves || {}).reduce((acc: number, val: any) => acc + (typeof val === 'number' ? val : 0), 0);
        const activeDutyCount = Math.max(0, analytics.totalWorkforce - activeLeavesCount);

        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* Executive Welcome Banner */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-8 text-white shadow-2xl">
                    <div className="relative z-10 max-w-3xl">
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider mb-4 inline-block">
                            Vice Chancellor Executive Office
                        </span>
                        <h1 className="text-3xl font-black tracking-tight mb-2">
                            Institutional Oversight & Administration
                        </h1>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            Complete visibility of workforce distribution, active leave pipelines, disciplinary audits, and digital signature authorization across HQ registry and all study centers.
                        </p>
                    </div>
                    {/* Visual Highlights */}
                    <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl"></div>
                </div>

                {/* Overall University Statistics */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-150">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Workforce</h3>
                                <p className="mt-2 text-3xl font-black text-gray-900">
                                    {loadingActivities ? <Loader2 className="animate-spin h-6 w-6 text-gray-400 inline" /> : analytics.totalWorkforce}
                                </p>
                            </div>
                            <span className="p-3 bg-blue-50 text-blue-600 rounded-xl"><FileText size={20} /></span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-4 font-medium">Active registered profiles</p>
                    </div>

                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-150">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">On Active Leave</h3>
                                <p className="mt-2 text-3xl font-black text-gray-900">
                                    {loadingActivities ? <Loader2 className="animate-spin h-6 w-6 text-gray-400 inline" /> : activeLeavesCount}
                                </p>
                            </div>
                            <span className="p-3 bg-green-50 text-green-600 rounded-xl"><Calendar size={20} /></span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-4 font-medium">Away from duty with approval</p>
                    </div>

                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-150">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Duty</h3>
                                <p className="mt-2 text-3xl font-black text-gray-900">
                                    {loadingActivities ? <Loader2 className="animate-spin h-6 w-6 text-gray-400 inline" /> : activeDutyCount}
                                </p>
                            </div>
                            <span className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><MapPin size={20} /></span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-4 font-medium">Currently available at placement</p>
                    </div>

                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-150">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending Action</h3>
                                <p className="mt-2 text-3xl font-black text-red-600">
                                    {loadingActivities ? <Loader2 className="animate-spin h-6 w-6 text-gray-400 inline" /> : pendingActionsCount}
                                </p>
                            </div>
                            <span className="p-3 bg-red-50 text-red-600 rounded-xl"><AlertTriangle size={20} /></span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-4 font-medium">Transfers & disciplinary audits</p>
                    </div>
                </div>

                {/* Digital Signature & Executive Memo Broadcast */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Digital Signature Widget */}
                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-150 space-y-6">
                        <div>
                            <h2 className="text-lg font-black text-gray-900">Digital Signature Authorization</h2>
                            <p className="text-xs text-gray-500 mt-1">Upload and configure your official signature to automatically authorize approvals and memos.</p>
                        </div>

                        {/* Signature Preview Panel */}
                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center min-h-[160px] bg-slate-50/50">
                            {currentSigUrl ? (
                                <div className="text-center space-y-3">
                                    <img src={getImageUrl(currentSigUrl)} alt="VC Signature" className="max-h-[90px] object-contain border bg-white rounded p-1 mx-auto shadow-sm" />
                                    <span className="text-[10px] text-green-600 font-bold bg-green-50 border border-green-200/50 px-2 py-0.5 rounded-full uppercase tracking-wider inline-block">Active Signature</span>
                                </div>
                            ) : (
                                <div className="text-center space-y-2 text-gray-400">
                                    <FileText size={40} className="mx-auto text-gray-300" />
                                    <p className="text-xs font-medium">No signature uploaded yet</p>
                                </div>
                            )}
                        </div>

                        {/* File Upload Field */}
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Upload New Signature</label>
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleVCUploadSignature}
                                className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                                disabled={uploadingSig}
                            />
                            {uploadingSig && <p className="text-xs text-blue-600 mt-2 font-medium">Uploading your signature...</p>}
                            {sigSuccess && <p className="text-xs text-green-600 mt-2 font-semibold">✔ {sigSuccess}</p>}
                            {sigError && <p className="text-xs text-red-600 mt-2 font-semibold">❌ {sigError}</p>}
                        </div>
                    </div>

                    {/* Middle & Right: Memo Broadcaster */}
                    <div className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-gray-150">
                        <div className="mb-6">
                            <h2 className="text-lg font-black text-gray-900">Executive Memo Broadcaster</h2>
                            <p className="text-xs text-gray-500 mt-1">Issue official directives with digital signature verification to staff members or broadcast to the entire university.</p>
                        </div>

                        <form onSubmit={handleVCSendMemo} className="space-y-4">
                            {memoSuccess && (
                                <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold rounded-xl">
                                    ✔ {memoSuccess}
                                </div>
                            )}
                            {memoError && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
                                    ❌ {memoError}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Recipient Category</label>
                                    <select
                                        value={memoRecipientType}
                                        onChange={(e) => setMemoRecipientType(e.target.value as any)}
                                        className="w-full rounded-xl border border-gray-200 p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="ALL">Broadcast to All Staff</option>
                                        <option value="INDIVIDUAL">Select Individual Staff Member(s)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Attachment (Optional)</label>
                                    <input
                                        type="file"
                                        onChange={(e) => setMemoAttachment(e.target.files?.[0] || null)}
                                        className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                                    />
                                </div>
                            </div>

                            {memoRecipientType === 'INDIVIDUAL' && (
                                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Select Recipients</label>
                                    {loadingStaff ? (
                                        <div className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 className="animate-spin h-3 w-3" /> Loading staff directory...</div>
                                    ) : (
                                        <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                                            {allStaff.map(staff => {
                                                const isChecked = selectedRecipients.includes(staff.id);
                                                return (
                                                    <label key={staff.id} className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer hover:text-gray-900">
                                                        <input 
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedRecipients([...selectedRecipients, staff.id]);
                                                                } else {
                                                                    setSelectedRecipients(selectedRecipients.filter(id => id !== staff.id));
                                                                }
                                                            }}
                                                            className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                                                        />
                                                        <span className="font-medium">{staff.name}</span>
                                                        <span className="text-[10px] text-gray-400">({staff.email} | {staff.staffProfile?.rank || 'Staff'})</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Memo Subject / Title</label>
                                <input
                                    type="text"
                                    value={memoTitle}
                                    onChange={(e) => setMemoTitle(e.target.value)}
                                    placeholder="Enter memo subject..."
                                    className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Directive / Content</label>
                                <textarea
                                    value={memoContent}
                                    onChange={(e) => setMemoContent(e.target.value)}
                                    placeholder="Draft your directive here..."
                                    rows={4}
                                    className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={sendingMemo}
                                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 text-white font-bold text-sm shadow-md hover:from-blue-800 hover:to-indigo-800 transition-all disabled:opacity-50"
                            >
                                {sendingMemo ? (
                                    <>
                                        <Loader2 className="animate-spin h-4 w-4" />
                                        <span>Signing and Broadcasting Directive...</span>
                                    </>
                                ) : (
                                    <>
                                        <FileText size={16} />
                                        <span>Sign and Broadcast Memo Directive</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* University Activity Thread */}
                <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-150">
                    <h2 className="mb-6 text-lg font-black text-gray-900 flex items-center gap-2">
                        <History className="text-blue-600" size={20} />
                        Global University Activity Feed
                    </h2>
                    
                    <div className="max-h-[550px] overflow-y-auto pr-2 scrollbar-thin relative">
                        {loadingActivities ? (
                            <div className="flex justify-center items-center py-12">
                                <Loader2 className="animate-spin text-nounGreen" size={28} />
                            </div>
                        ) : activities.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 text-sm bg-gray-50 rounded-2xl border border-dashed">
                                No recent activity recorded.
                            </div>
                        ) : (
                            <div className="relative pl-6 border-l-2 border-gray-150 space-y-6 ml-3 py-1">
                                {activities.map((act) => {
                                    let IconComponent = FileText;
                                    let iconBg = 'bg-blue-50 text-blue-700 border-blue-150';
                                    if (act.type === 'TRANSFER') {
                                        IconComponent = MapPin;
                                        iconBg = 'bg-amber-50 text-amber-700 border-amber-150';
                                    } else if (act.type === 'QUERY') {
                                        IconComponent = AlertTriangle;
                                        iconBg = 'bg-red-50 text-red-700 border-red-155';
                                    }

                                    return (
                                        <div key={act.id} className="relative group">
                                            <div className={`absolute -left-[37px] top-1.5 h-7 w-7 rounded-full border flex items-center justify-center shadow-sm ${iconBg} transition-transform group-hover:scale-110 bg-white`}>
                                                <IconComponent size={13} />
                                            </div>

                                            <div className="bg-white rounded-xl border border-gray-150 p-4 shadow-sm hover:shadow-md transition-shadow group-hover:border-gray-250">
                                                <div className="flex justify-between items-start gap-4 flex-wrap">
                                                    <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-900 transition-colors">
                                                        {act.title}
                                                    </h4>
                                                    <span className="text-[10px] font-semibold text-gray-400 bg-gray-50 border px-2 py-0.5 rounded-md">
                                                        {new Date(act.createdAt).toLocaleString(undefined, {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                                                    {act.description}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Premium Manager Dashboard View
    if (!isRegistry && isUnitManager) {
        return (
            <div className="space-y-6">
                {/* Welcome Header */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900 p-8 text-white shadow-xl animate-in fade-in slide-in-from-top duration-500">
                    <div className="relative z-10">
                        <span className="bg-white/20 text-white border border-white/20 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
                            Manager Portal
                        </span>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">
                            Welcome back, {user?.name?.split(' ')[0]}!
                        </h1>
                        <p className="text-blue-100 max-w-lg text-sm opacity-90 leading-relaxed">
                            Overview for <span className="font-bold underline">{user?.staffProfile?.unit?.name || user?.staffProfile?.studyCenter?.name || 'Your Managed Unit'}</span>. Track active staff, recommendation pipelines, and appraise performance.
                        </p>
                    </div>
                    {/* Decorative Background Elements */}
                    <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
                    <div className="absolute -bottom-20 right-20 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
                </div>

                {/* Manager Stats Grid */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-150 relative overflow-hidden group">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Staff</h3>
                                <p className="mt-2 text-2xl font-black text-gray-905">
                                    {loadingManagerStats ? <Loader2 className="animate-spin h-5 w-5 text-gray-400" /> : managerStats.totalStaff}
                                </p>
                            </div>
                            <span className="p-2 bg-blue-50 text-blue-605 rounded-lg"><FileText size={18} /></span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-3 font-medium">Active unit personnel</p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-150 relative overflow-hidden group">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">On Active Leave</h3>
                                <p className="mt-2 text-2xl font-black text-gray-905">
                                    {loadingManagerStats ? <Loader2 className="animate-spin h-5 w-5 text-gray-400" /> : managerStats.activeLeaves}
                                </p>
                            </div>
                            <span className="p-2 bg-green-50 text-green-605 rounded-lg"><MapPin size={18} /></span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-3 font-medium">Currently away from duty</p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-150 relative overflow-hidden group">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending Leaves</h3>
                                <p className={`mt-2 text-2xl font-black ${managerStats.pendingLeaves > 0 ? 'text-orange-600' : 'text-gray-905'}`}>
                                    {loadingManagerStats ? <Loader2 className="animate-spin h-5 w-5 text-gray-400" /> : managerStats.pendingLeaves}
                                </p>
                            </div>
                            <span className={`p-2 rounded-lg ${managerStats.pendingLeaves > 0 ? 'bg-orange-50 text-orange-605' : 'bg-gray-50 text-gray-400'}`}><Clock size={18} /></span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-3 font-medium">Awaiting review</p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-150 relative overflow-hidden group">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Appraisals</h3>
                                <p className={`mt-2 text-2xl font-black ${managerStats.pendingAper > 0 ? 'text-indigo-600' : 'text-gray-905'}`}>
                                    {loadingManagerStats ? <Loader2 className="animate-spin h-5 w-5 text-gray-400" /> : managerStats.pendingAper}
                                </p>
                            </div>
                            <span className={`p-2 rounded-lg ${managerStats.pendingAper > 0 ? 'bg-indigo-50 text-indigo-605' : 'bg-gray-50 text-gray-400'}`}><ClipboardCheck size={18} /></span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-3 font-medium">Pending APER review</p>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-150 relative overflow-hidden group">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Open Queries</h3>
                                <p className={`mt-2 text-2xl font-black ${managerStats.activeQueries > 0 ? 'text-red-650' : 'text-gray-905'}`}>
                                    {loadingManagerStats ? <Loader2 className="animate-spin h-5 w-5 text-gray-400" /> : managerStats.activeQueries}
                                </p>
                            </div>
                            <span className={`p-2 rounded-lg ${managerStats.activeQueries > 0 ? 'bg-red-50 text-red-605' : 'bg-gray-50 text-gray-400'}`}><AlertTriangle size={18} /></span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-3 font-medium">Disciplinary actions open</p>
                    </div>
                </div>

                {/* Manager Quick Actions Grid */}
                <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-sm">
                    <h2 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-4">Management Command Center</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Link href="/dashboard/unit/staff" className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all group">
                            <span className="p-2.5 bg-blue-50 text-blue-700 rounded-lg group-hover:scale-110 transition-transform"><FileText size={20} /></span>
                            <div>
                                <h4 className="text-sm font-bold text-gray-850">Unit Staff</h4>
                                <p className="text-[11px] text-gray-500">Manage bio-data & files</p>
                            </div>
                        </Link>
                        <Link href="/dashboard/unit/leaves" className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/20 transition-all group">
                            <span className="p-2.5 bg-orange-50 text-orange-700 rounded-lg group-hover:scale-110 transition-transform"><Clock size={20} /></span>
                            <div>
                                <h4 className="text-sm font-bold text-gray-855">Leave Approvals</h4>
                                <p className="text-[11px] text-gray-500">Recommend & approve</p>
                            </div>
                        </Link>
                        <Link href="/dashboard/unit/aper" className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all group">
                            <span className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg group-hover:scale-110 transition-transform"><ClipboardCheck size={20} /></span>
                            <div>
                                <h4 className="text-sm font-bold text-gray-855">Appraisal Review</h4>
                                <p className="text-[11px] text-gray-500">Conduct APER reviews</p>
                            </div>
                        </Link>
                        <Link href="/dashboard/registry/queries" className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-red-200 hover:bg-red-50/20 transition-all group">
                            <span className="p-2.5 bg-red-50 text-red-700 rounded-lg group-hover:scale-110 transition-transform"><AlertTriangle size={20} /></span>
                            <div>
                                <h4 className="text-sm font-bold text-gray-855">Staff Queries</h4>
                                <p className="text-[11px] text-gray-500">Disciplinary oversight</p>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Notifications & Self Status */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Bell size={18} className="text-blue-600" /> Action Notifications
                            </h2>
                        </div>
                        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                            {loadingNotifications ? (
                                <div className="flex justify-center items-center py-8">
                                    <Loader2 className="animate-spin text-blue-600" size={24} />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                    No notifications found.
                                </div>
                            ) : (
                                notifications.slice(0, 5).map((note) => (
                                    <div
                                        key={note.id}
                                        className={`relative rounded-lg border border-gray-100 p-4 hover:bg-gray-50 transition-all ${
                                            !note.isRead ? 'bg-blue-50/20 border-l-4 border-l-blue-500' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <div className="mt-0.5">
                                                {note.type === 'SUCCESS' && <CheckCircle size={15} className="text-green-500" />}
                                                {note.type === 'WARNING' && <AlertTriangle size={15} className="text-yellow-500" />}
                                                {note.type === 'ERROR' && <AlertOctagon size={15} className="text-red-500" />}
                                                {note.type !== 'SUCCESS' && note.type !== 'WARNING' && note.type !== 'ERROR' && (
                                                    <Info size={15} className="text-blue-500" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-sm ${!note.isRead ? 'font-semibold text-gray-900' : 'text-gray-750'}`}>
                                                    {note.title}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                    {note.message}
                                                </p>
                                                <div className="flex items-center justify-between mt-2.5">
                                                    <span className="text-[10px] text-gray-400">
                                                        {new Date(note.createdAt).toLocaleString()}
                                                    </span>
                                                    {note.link && (
                                                        <Link
                                                            href={note.link}
                                                            className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5"
                                                        >
                                                            View Details <ArrowRight size={10} />
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800 mb-4">My Center/Unit Status</h2>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-600 font-medium">Placement Role</span>
                                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full uppercase">
                                        {user?.role?.replace(/_/g, ' ')}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-600 font-medium">Assigned Scope</span>
                                    <span className="text-sm font-bold text-gray-950 truncate max-w-[200px]">
                                        {user?.staffProfile?.unit?.name || user?.staffProfile?.studyCenter?.name || 'Registry / Headquarters'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-600 font-medium">Duty Status</span>
                                    <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase ${
                                        isOnLeave ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-750'
                                    }`}>
                                        {dutyStatus}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <Link href="/dashboard/profile" className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50/40 transition-all">
                            View My Staff Profile <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Premium Staff Dashboard View
    if (!isRegistry) {
        return (
            <div className="space-y-6">
                {/* Welcome Header */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-nounGreen to-green-800 p-8 text-white shadow-xl">
                    <div className="relative z-10">
                        <h1 className="text-3xl font-bold tracking-tight mb-2">
                            Welcome back, {user?.name?.split(' ')[0]}!
                        </h1>
                        <p className="text-green-100 max-w-lg">
                            Access your digital dossier, download payslips, apply for leave, and manage your academic profile all in one secure location.
                        </p>
                    </div>
                    {/* Decorative Background Elements */}
                    <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
                    <div className="absolute -bottom-20 right-20 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
                </div>

                {/* Quick Actions Grid */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <Link href="/dashboard/documents" className="group flex flex-col items-center justify-center rounded-xl bg-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 border border-gray-100 hover:border-nounGreen/30">
                        <div className="mb-4 rounded-full bg-blue-50 p-4 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <FileText size={28} />
                        </div>
                        <h3 className="font-semibold text-gray-800">My Dossier</h3>
                        <p className="text-xs text-gray-500 mt-1">View personal file</p>
                    </Link>

                    <Link href="/dashboard/payslips" className="group flex flex-col items-center justify-center rounded-xl bg-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 border border-gray-100 hover:border-nounGreen/30">
                        <div className="mb-4 rounded-full bg-green-50 p-4 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                            <DollarSign size={28} />
                        </div>
                        <h3 className="font-semibold text-gray-800">Payslips</h3>
                        <p className="text-xs text-gray-500 mt-1">Download monthly</p>
                    </Link>

                    <Link href="/dashboard/leaves?open=apply" className="group flex flex-col items-center justify-center rounded-xl bg-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 border border-gray-100 hover:border-nounGreen/30">
                        <div className="mb-4 rounded-full bg-purple-50 p-4 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                            <MapPin size={28} />
                        </div>
                        <h3 className="font-semibold text-gray-800">Leave Request</h3>
                        <p className="text-xs text-gray-500 mt-1">Apply for time off</p>
                    </Link>

                    <Link href="/dashboard/staff/aper" className="group flex flex-col items-center justify-center rounded-xl bg-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 border border-gray-100 hover:border-nounGreen/30">
                        <div className="mb-4 rounded-full bg-orange-50 p-4 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                            <ClipboardCheck size={28} />
                        </div>
                        <h3 className="font-semibold text-gray-800">Appraisal</h3>
                        <p className="text-xs text-gray-500 mt-1">Submit APER form</p>
                    </Link>
                </div>

                {/* Notifications & Status */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Bell size={18} className="text-nounGreen" /> Recent Notifications
                            </h2>
                        </div>
                        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                            {loadingNotifications ? (
                                <div className="flex justify-center items-center py-8">
                                    <Loader2 className="animate-spin text-nounGreen" size={24} />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                    No notifications found.
                                </div>
                            ) : (
                                notifications.slice(0, 5).map((note) => (
                                    <div
                                        key={note.id}
                                        className={`relative rounded-lg border border-gray-100 p-4 hover:bg-gray-50 transition-all ${
                                            !note.isRead ? 'bg-blue-50/20 border-l-4 border-l-blue-500' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <div className="mt-0.5">
                                                {note.type === 'SUCCESS' && <CheckCircle size={15} className="text-green-500" />}
                                                {note.type === 'WARNING' && <AlertTriangle size={15} className="text-yellow-500" />}
                                                {note.type === 'ERROR' && <AlertOctagon size={15} className="text-red-500" />}
                                                {note.type !== 'SUCCESS' && note.type !== 'WARNING' && note.type !== 'ERROR' && (
                                                    <Info size={15} className="text-blue-500" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-sm ${!note.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                                                    {note.title}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                    {note.message}
                                                </p>
                                                <div className="flex items-center justify-between mt-2.5">
                                                    <span className="text-[10px] text-gray-400">
                                                        {new Date(note.createdAt).toLocaleString()}
                                                    </span>
                                                    {note.link && (
                                                        <Link
                                                            href={note.link}
                                                            className="text-xs font-bold text-nounGreen hover:underline inline-flex items-center gap-0.5"
                                                        >
                                                            View Details <ArrowRight size={10} />
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">Current Status</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-600 font-medium">Duty Status</span>
                                <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase ${
                                    isOnLeave ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                }`}>
                                    {dutyStatus}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-600 font-medium">Days Applied For</span>
                                <span className="text-sm font-bold text-gray-900">{appliedDays} Days</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-600 font-medium">Remaining Leave Days</span>
                                <span className="text-sm font-bold text-gray-900">{remainingDays} Days</span>
                            </div>
                            {isOnLeave && (
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-600 font-medium">Resuming Duty</span>
                                    <span className="text-sm font-bold text-blue-600">{resumptionDateStr}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-600 font-medium">Next Appraisal</span>
                                <span className="text-sm font-bold text-gray-900">December 2025</span>
                            </div>
                        </div>
                        <Link href="/dashboard/profile" className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-nounGreen border border-nounGreen/30 rounded-lg hover:bg-nounGreen/5 transition-colors">
                            View Full Profile <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // HR / Registry Global Dashboard
    const activeLeavesCount = Object.values(analytics.activeLeaves || {}).reduce((acc: number, val: any) => acc + (typeof val === 'number' ? val : 0), 0);
    const activeDutyCount = Math.max(0, analytics.totalWorkforce - activeLeavesCount);

    return (
        <div>
            <h1 className="mb-6 text-3xl font-bold text-gray-800">
                HQ Registry Overview
            </h1>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* Stat Card 1 */}
                <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500">Total Staff</h3>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                        {loadingActivities ? <Loader2 className="animate-spin text-gray-400 inline h-6 w-6" /> : analytics.totalWorkforce}
                    </p>
                    <span className="text-sm text-green-600 font-medium">Registered system profiles</span>
                </div>

                {/* Stat Card 2 */}
                <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500">Active Duty</h3>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                        {loadingActivities ? <Loader2 className="animate-spin text-gray-400 inline h-6 w-6" /> : activeDutyCount}
                    </p>
                    <span className="text-sm text-gray-500">Currently available</span>
                </div>

                {/* Stat Card 3 */}
                <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500">Staff on Leave</h3>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                        {loadingActivities ? <Loader2 className="animate-spin text-gray-400 inline h-6 w-6" /> : activeLeavesCount}
                    </p>
                    <span className="text-sm text-blue-600 font-medium">Approved requests</span>
                </div>

                {/* Stat Card 4 */}
                <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500">Pending Actions</h3>
                    <p className="mt-2 text-3xl font-bold text-red-600">
                        {loadingActivities ? <Loader2 className="animate-spin text-gray-400 inline h-6 w-6" /> : pendingActionsCount}
                    </p>
                    <span className="text-sm text-red-600 font-medium">Transfers & Queries</span>
                </div>
            </div>

            {/* ====== RECRUITMENT FILTER PANEL ====== */}
            <div className="mt-8 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-700 to-blue-700 text-white">
                    <div className="flex items-center gap-3">
                        <span className="p-2 bg-white/20 rounded-lg"><BarChart2 size={18} /></span>
                        <div>
                            <h2 className="font-bold text-base tracking-tight">Staff Recruitment Analytics</h2>
                            <p className="text-xs text-indigo-200 mt-0.5">Filter recruited staff by period, gender, geopolitical zone</p>
                        </div>
                    </div>
                    {recruitData && (
                        <div className="text-right">
                            <p className="text-2xl font-black">{recruitData.total}</p>
                            <p className="text-xs text-indigo-200">Matching Staff</p>
                        </div>
                    )}
                </div>

                {/* Filters Row */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <Filter size={13} /> Filters
                        </span>

                        {/* Year */}
                        <select
                            value={recruitYear}
                            onChange={e => setRecruitYear(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-700"
                        >
                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>

                        {/* Month */}
                        <select
                            value={recruitMonth}
                            onChange={e => setRecruitMonth(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-700"
                        >
                            <option value="">All Months</option>
                            {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                                <option key={i+1} value={i+1}>{m}</option>
                            ))}
                        </select>

                        {/* Gender */}
                        <select
                            value={recruitGender}
                            onChange={e => setRecruitGender(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-700"
                        >
                            <option value="">All Genders</option>
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                        </select>

                        {/* Geopolitical Zone */}
                        <select
                            value={recruitZone}
                            onChange={e => setRecruitZone(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-700"
                        >
                            <option value="">All Zones / Regions</option>
                            <option value="North Central">North Central</option>
                            <option value="North East">North East</option>
                            <option value="North West">North West</option>
                            <option value="South East">South East</option>
                            <option value="South South">South South</option>
                            <option value="South West">South West</option>
                        </select>

                        {(recruitMonth || recruitGender || recruitZone) && (
                            <button
                                onClick={() => { setRecruitMonth(''); setRecruitGender(''); setRecruitZone(''); }}
                                className="text-xs font-semibold text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg px-3 py-1.5 transition-colors"
                            >
                                Clear Filters
                            </button>
                        )}
                    </div>
                </div>

                {/* Results */}
                <div className="p-6">
                    {loadingRecruit ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="animate-spin text-indigo-600" size={28} />
                        </div>
                    ) : !recruitData ? null : (
                        <div className="space-y-6">

                            {/* Monthly Bar Chart */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <TrendingUp size={13} /> Monthly Recruitment — {recruitData.filterYear}
                                </h3>
                                <div className="flex items-end gap-1.5 h-28">
                                    {(recruitData.monthlyBreakdown || []).map((m: any) => {
                                        const peak = Math.max(...(recruitData.monthlyBreakdown || []).map((x: any) => x.count), 1);
                                        const pct = Math.round((m.count / peak) * 100);
                                        const isActive = recruitMonth && parseInt(recruitMonth) === m.month;
                                        return (
                                            <div key={m.month} className="flex flex-col items-center flex-1 gap-1">
                                                <span className="text-[9px] font-bold text-gray-600">{m.count > 0 ? m.count : ''}</span>
                                                <div
                                                    style={{ height: `${Math.max(pct, 4)}%` }}
                                                    className={`w-full rounded-t-sm transition-all ${
                                                        isActive ? 'bg-indigo-600' : m.count > 0 ? 'bg-indigo-400 hover:bg-indigo-500' : 'bg-gray-100'
                                                    }`}
                                                />
                                                <span className="text-[9px] text-gray-400">{m.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Breakdown Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                {/* By Gender */}
                                <div className="rounded-xl border border-gray-100 p-4 bg-gray-50/40">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <Users size={12} /> By Gender
                                    </h4>
                                    {recruitData.byGender.length === 0 ? (
                                        <p className="text-xs text-gray-400">No data</p>
                                    ) : recruitData.byGender.map((g: any) => (
                                        <div key={g.label} className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-gray-700 capitalize">{g.label?.toLowerCase() || 'Unknown'}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 rounded-full bg-gray-200 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-indigo-500"
                                                        style={{ width: `${Math.round((g.count / recruitData.total) * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-gray-800 w-8 text-right">{g.count}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* By Zone */}
                                <div className="rounded-xl border border-gray-100 p-4 bg-gray-50/40">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <MapPin size={12} /> By Geopolitical Zone
                                    </h4>
                                    {recruitData.byZone.length === 0 ? (
                                        <p className="text-xs text-gray-400">No data</p>
                                    ) : recruitData.byZone.sort((a: any, b: any) => b.count - a.count).map((z: any) => (
                                        <div key={z.zone} className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-gray-600 truncate max-w-[110px]">{z.zone}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-20 h-2 rounded-full bg-gray-200 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-green-500"
                                                        style={{ width: `${Math.round((z.count / recruitData.total) * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-gray-800 w-6 text-right">{z.count}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* By Cadre */}
                                <div className="rounded-xl border border-gray-100 p-4 bg-gray-50/40">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <FileText size={12} /> By Cadre
                                    </h4>
                                    {recruitData.byCadre.length === 0 ? (
                                        <p className="text-xs text-gray-400">No data</p>
                                    ) : recruitData.byCadre.sort((a: any, b: any) => b.count - a.count).map((c: any) => (
                                        <div key={c.label} className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-gray-600 capitalize truncate max-w-[110px]">{(c.label || 'Unknown').replace(/_/g, ' ').toLowerCase()}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-20 h-2 rounded-full bg-gray-200 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-amber-500"
                                                        style={{ width: `${Math.round((c.count / recruitData.total) * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-gray-800 w-6 text-right">{c.count}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* ====== END RECRUITMENT FILTER PANEL ====== */}

            <div className="mt-8 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                <h2 className="mb-6 text-lg font-bold text-gray-950 flex items-center gap-2">
                    <History className="text-blue-600" size={20} />
                    Recent Registry Activity Thread
                </h2>
                
                <div className="max-h-[550px] overflow-y-auto pr-2 scrollbar-thin relative">
                    {loadingActivities ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="animate-spin text-nounGreen" size={28} />
                        </div>
                    ) : activities.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 text-sm bg-gray-50 rounded-2xl border border-dashed">
                            No recent activity recorded.
                        </div>
                    ) : (
                        <div className="relative pl-6 border-l-2 border-gray-150 space-y-6 ml-3 py-1">
                            {activities.map((act) => {
                                // Determine icon based on activity type
                                let IconComponent = FileText;
                                let iconBg = 'bg-blue-50 text-blue-700 border-blue-150';
                                if (act.type === 'TRANSFER') {
                                    IconComponent = MapPin;
                                    iconBg = 'bg-amber-50 text-amber-700 border-amber-150';
                                } else if (act.type === 'QUERY') {
                                    IconComponent = AlertTriangle;
                                    iconBg = 'bg-red-50 text-red-700 border-red-155';
                                }

                                return (
                                    <div key={act.id} className="relative group">
                                        {/* Connecting Dot/Icon */}
                                        <div className={`absolute -left-[37px] top-1.5 h-7 w-7 rounded-full border flex items-center justify-center shadow-sm ${iconBg} transition-transform group-hover:scale-110 bg-white`}>
                                            <IconComponent size={13} />
                                        </div>

                                        {/* Thread Message Card */}
                                        <div className="bg-white rounded-xl border border-gray-150 p-4 shadow-sm hover:shadow-md transition-shadow group-hover:border-gray-250">
                                            <div className="flex justify-between items-start gap-4 flex-wrap">
                                                <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-900 transition-colors">
                                                    {act.title}
                                                </h4>
                                                <span className="text-[10px] font-semibold text-gray-400 bg-gray-50 border px-2 py-0.5 rounded-md">
                                                    {new Date(act.createdAt).toLocaleString(undefined, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-650 mt-1.5 leading-relaxed">
                                                {act.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
