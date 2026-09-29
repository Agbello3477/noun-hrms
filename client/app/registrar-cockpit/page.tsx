'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { Button } from '../../components/ui/Button';
import {
    CheckCircle2,
    XCircle,
    RotateCcw,
    FileCheck2,
    ArrowRightLeft,
    FolderCheck,
    TrendingUp,
    ShieldCheck,
    Download,
    Eye,
    Key,
    User,
    Stamp,
    Building2,
    Calendar,
    Award,
    FileText
} from 'lucide-react';

export default function RegistrarCockpitPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const [activeSection, setActiveSection] = useState<'queue' | 'postings' | 'files' | 'promotions' | 'roles' | 'audits'>('queue');
    const [queueSummary, setQueueSummary] = useState({
        totalPending: 0,
        postings: 0,
        files: 0,
        promotionOverrides: 0,
        disciplinaryQueries: 0,
        roleChanges: 0
    });

    const [pendingPostings, setPendingPostings] = useState<any[]>([]);
    const [pendingFiles, setPendingFiles] = useState<any[]>([]);
    const [pendingOverrides, setPendingOverrides] = useState<any[]>([]);
    const [pendingRoleChanges, setPendingRoleChanges] = useState<any[]>([]);
    const [audits, setAudits] = useState<any[]>([]);

    const [loadingQueue, setLoadingQueue] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Selected item for Split-screen Diff / Dossier Viewer
    const [selectedPosting, setSelectedPosting] = useState<any | null>(null);
    const [selectedFile, setSelectedFile] = useState<any | null>(null);
    const [selectedOverride, setSelectedOverride] = useState<any | null>(null);

    // Decision modal / input state
    const [decisionRemarks, setDecisionRemarks] = useState('');

    // Role Guard: Only Registrar, Deputy Registrar, or VC
    useEffect(() => {
        if (!authLoading && user) {
            const isAuthorized = ['REGISTRAR', 'DEPUTY_REGISTRAR', 'VICE_CHANCELLOR', 'SUPER_USER'].includes(user.role);
            if (!isAuthorized) {
                router.replace('/registry-workspace');
            }
        }
    }, [user, authLoading, router]);

    // Initial Data Fetch & Periodic Live Sync
    useEffect(() => {
        loadCockpitData();
        const interval = setInterval(loadCockpitData, 15000); // 15s live cockpit sync
        return () => clearInterval(interval);
    }, []);

    const loadCockpitData = async () => {
        setLoadingQueue(true);
        try {
            const [queueRes, postingsRes, filesRes, overridesRes, roleChangesRes] = await Promise.all([
                api.get('/api/v1/registrar/queue').catch(() => ({ data: { queueSummary: { totalPending: 0, postings: 0, files: 0, promotionOverrides: 0, disciplinaryQueries: 0, roleChanges: 0 } } })),
                api.get('/api/v1/registrar/postings/pending').catch(() => ({ data: [] })),
                api.get('/api/v1/registrar/files/pending').catch(() => ({ data: [] })),
                api.get('/api/v1/registrar/promotions/pending-overrides').catch(() => ({ data: [] })),
                api.get('/api/v1/registrar/role-changes/pending').catch(() => ({ data: [] }))
            ]);

            setQueueSummary(queueRes.data.queueSummary);
            setPendingPostings(postingsRes.data || []);
            setPendingFiles(filesRes.data || []);
            setPendingOverrides(overridesRes.data || []);
            setPendingRoleChanges(roleChangesRes.data || []);

            if (postingsRes.data && postingsRes.data.length > 0) {
                setSelectedPosting(postingsRes.data[0]);
            }
            if (filesRes.data && filesRes.data.length > 0) {
                setSelectedFile(filesRes.data[0]);
            }
            if (overridesRes.data && overridesRes.data.length > 0) {
                setSelectedOverride(overridesRes.data[0]);
            }
        } catch (err: any) {
            console.error('Failed to load cockpit data', err);
        } finally {
            setLoadingQueue(false);
        }
    };

    const loadAudits = async () => {
        try {
            const res = await api.get('/api/v1/registrar/audits');
            setAudits(res.data.audits || []);
        } catch (err) {
            console.error('Failed to load audits', err);
        }
    };

    // Posting Decision
    const handlePostingDecision = async (postingId: string, decision: 'APPROVED' | 'REJECTED' | 'RETURNED_TO_IMPUTER') => {
        setActionLoading(true);
        setFeedback(null);
        try {
            const res = await api.put(`/api/v1/registrar/postings/${postingId}/authorize`, {
                decision,
                remarks: decisionRemarks || undefined
            });
            setFeedback({ type: 'success', message: res.data.message });
            setDecisionRemarks('');
            loadCockpitData();
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.response?.data?.message || 'Authorization failed' });
        } finally {
            setActionLoading(false);
        }
    };

    // File Clearance Decision
    const handleFileClearance = async (fileId: string, decision: 'CLEAR' | 'REJECT') => {
        setActionLoading(true);
        setFeedback(null);
        try {
            if (decision === 'CLEAR') {
                const res = await api.put(`/api/v1/registrar/files/${fileId}/clear`, {
                    remarks: decisionRemarks || 'Officially cleared by Registrar'
                });
                setFeedback({ type: 'success', message: `${res.data.message} One-time activation setup token generated.` });
            } else {
                const res = await api.put(`/api/v1/registrar/files/${fileId}/reject`, {
                    reason: decisionRemarks || 'Rejected by Registrar'
                });
                setFeedback({ type: 'success', message: res.data.message });
            }
            setDecisionRemarks('');
            loadCockpitData();
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.response?.data?.message || 'File action failed' });
        } finally {
            setActionLoading(false);
        }
    };

    // Promotion Override Decision
    const handleOverrideDecision = async (overrideId: string, decision: 'APPROVED' | 'REJECTED') => {
        setActionLoading(true);
        setFeedback(null);
        try {
            const res = await api.put(`/api/v1/registrar/promotions/${overrideId}/authorize-override`, {
                decision,
                remarks: decisionRemarks || undefined
            });
            setFeedback({ type: 'success', message: res.data.message });
            setDecisionRemarks('');
            loadCockpitData();
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.response?.data?.message || 'Override decision failed' });
        } finally {
            setActionLoading(false);
        }
    };

    // Institutional Role Change Decision
    const handleRoleChangeDecision = async (userId: string, decision: 'APPROVED' | 'REJECTED') => {
        setActionLoading(true);
        setFeedback(null);
        try {
            if (decision === 'APPROVED') {
                const res = await api.post(`/api/v1/registrar/role-changes/${userId}/authorize`, {
                    remarks: decisionRemarks || 'Institutional role change officially authorized'
                });
                setFeedback({ type: 'success', message: res.data.message });
            } else {
                const reason = decisionRemarks || prompt('Please enter reason for rejecting this role change request:');
                if (!reason) {
                    setActionLoading(false);
                    return;
                }
                const res = await api.post(`/api/v1/registrar/role-changes/${userId}/reject`, {
                    remarks: reason
                });
                setFeedback({ type: 'success', message: res.data.message });
            }
            setDecisionRemarks('');
            loadCockpitData();
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.response?.data?.message || 'Role change action failed' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleExportAuditCsv = () => {
        window.open('/api/v1/registrar/audits?format=csv', '_blank');
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-8">
            {/* Executive Header Banner */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 text-[11px] font-black rounded-md bg-emerald-100 text-[#006533] uppercase tracking-wide">
                            Office of the Registrar
                        </span>
                        <span className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            Executive Cockpit (Authorizer / Checker)
                        </span>
                    </div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-2 flex items-center gap-2">
                        Executive Ratification & Authorization Desk
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Dual-control principal officer clearance gate. Independent review of staff postings, file creation, promotion overrides, and sanctions.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportAuditCsv}
                        icon={<Download size={14} />}
                    >
                        Export Audit Dossier
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadCockpitData}
                        icon={<RotateCcw size={14} />}
                    >
                        Refresh Queue
                    </Button>
                </div>
            </div>

            {/* Notification Feedback */}
            {feedback && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
                    feedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-900 border border-red-200'
                }`}>
                    {feedback.type === 'success' ? <CheckCircle2 size={18} className="text-[#006533]" /> : <XCircle size={18} className="text-red-600" />}
                    <span>{feedback.message}</span>
                </div>
            )}

            {/* High-Priority Role Change Attention Banner */}
            {pendingRoleChanges.length > 0 && (
                <div className="mb-6 p-4 rounded-2xl bg-indigo-50 border border-indigo-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
                            <Key size={20} className="animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                                Action Required: {pendingRoleChanges.length} Role Authorization Request{pendingRoleChanges.length > 1 ? 's' : ''} Pending
                                <span className="text-[10px] bg-indigo-200/80 text-indigo-900 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Dual-Control Gate
                                </span>
                            </h3>
                            <p className="text-xs text-indigo-800 mt-0.5">
                                Role changes requested by HR will take effect immediately after your executive authorization.
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="emerald"
                        size="sm"
                        onClick={() => setActiveSection('roles')}
                        className="shrink-0"
                    >
                        Authorize Requests ({pendingRoleChanges.length})
                    </Button>
                </div>
            )}

            {/* Metrics KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
                <div
                    onClick={() => setActiveSection('queue')}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                        activeSection === 'queue' ? 'bg-white border-[#006533] ring-2 ring-[#006533]/20 shadow-xs' : 'bg-white border-slate-200/80 hover:border-slate-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-semibold">Total Authorizations</span>
                        <FileCheck2 size={16} className="text-[#006533]" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">{queueSummary.totalPending}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Pending across all queues</div>
                </div>

                <div
                    onClick={() => setActiveSection('postings')}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                        activeSection === 'postings' ? 'bg-white border-[#006533] ring-2 ring-[#006533]/20 shadow-xs' : 'bg-white border-slate-200/80 hover:border-slate-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-semibold">Staff Postings</span>
                        <ArrowRightLeft size={16} className="text-blue-600" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">{queueSummary.postings}</div>
                    <div className="text-[10px] text-blue-600 font-semibold mt-1">Awaiting Ratification</div>
                </div>

                <div
                    onClick={() => setActiveSection('files')}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                        activeSection === 'files' ? 'bg-white border-[#006533] ring-2 ring-[#006533]/20 shadow-xs' : 'bg-white border-slate-200/80 hover:border-slate-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-semibold">File Clearances</span>
                        <FolderCheck size={16} className="text-amber-600" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">{queueSummary.files}</div>
                    <div className="text-[10px] text-amber-600 font-semibold mt-1">Pending Activation</div>
                </div>

                <div
                    onClick={() => setActiveSection('promotions')}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                        activeSection === 'promotions' ? 'bg-white border-[#006533] ring-2 ring-[#006533]/20 shadow-xs' : 'bg-white border-slate-200/80 hover:border-slate-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-semibold">Promotion Overrides</span>
                        <TrendingUp size={16} className="text-purple-600" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">{queueSummary.promotionOverrides}</div>
                    <div className="text-[10px] text-purple-600 font-semibold mt-1">Requires Approval</div>
                </div>

                <div
                    onClick={() => setActiveSection('roles')}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                        activeSection === 'roles' ? 'bg-white border-[#006533] ring-2 ring-[#006533]/20 shadow-xs' : 'bg-white border-slate-200/80 hover:border-slate-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-xs font-semibold">Role Changes</span>
                        <Key size={16} className="text-indigo-600" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">{queueSummary.roleChanges || pendingRoleChanges.length}</div>
                    <div className="text-[10px] text-indigo-600 font-semibold mt-1">Dual-Control Gate</div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 mb-6">
                <button
                    onClick={() => setActiveSection('queue')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeSection === 'queue' ? 'bg-[#006533] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    Executive Authorization Queue
                </button>
                <button
                    onClick={() => setActiveSection('postings')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeSection === 'postings' ? 'bg-[#006533] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    Transfer & Posting Ratifications ({pendingPostings.length})
                </button>
                <button
                    onClick={() => setActiveSection('files')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeSection === 'files' ? 'bg-[#006533] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    Pending File Clearances ({pendingFiles.length})
                </button>
                <button
                    onClick={() => setActiveSection('promotions')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeSection === 'promotions' ? 'bg-[#006533] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    Promotion Override Docket ({pendingOverrides.length})
                </button>
                <button
                    onClick={() => setActiveSection('roles')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeSection === 'roles' ? 'bg-[#006533] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    Role Change Docket ({pendingRoleChanges.length})
                </button>
                <button
                    onClick={() => {
                        setActiveSection('audits');
                        loadAudits();
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeSection === 'audits' ? 'bg-[#006533] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    Audit & Digital Signature Trails
                </button>
            </div>

            {/* Section 1: Overview / Fast Executive Queue */}
            {activeSection === 'queue' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <ArrowRightLeft size={16} className="text-[#006533]" />
                                High-Priority Postings Awaiting Ratification
                            </h2>
                            <Button variant="ghost" size="xs" onClick={() => setActiveSection('postings')}>
                                View All
                            </Button>
                        </div>
                        {loadingQueue ? (
                            <div className="space-y-3 py-2">
                                <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                                <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                            </div>
                        ) : pendingPostings.length === 0 ? (
                            <p className="text-xs text-slate-400 py-6 text-center">No postings currently in queue.</p>
                        ) : (
                            <div className="space-y-2">
                                {pendingPostings.slice(0, 3).map((p) => (
                                    <div key={p.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-bold text-slate-900">{p.staff?.name}</div>
                                            <div className="text-[11px] text-slate-500">Destination: {p.newUnit?.name || p.newCenter?.name || 'Assigned'}</div>
                                        </div>
                                        <Button
                                            variant="emerald"
                                            size="xs"
                                            onClick={() => {
                                                setSelectedPosting(p);
                                                setActiveSection('postings');
                                            }}
                                        >
                                            Review
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <FolderCheck size={16} className="text-[#006533]" />
                                Staff Files Awaiting Executive Clearance
                            </h2>
                            <Button variant="ghost" size="xs" onClick={() => setActiveSection('files')}>
                                View All
                            </Button>
                        </div>
                        {loadingQueue ? (
                            <div className="space-y-3 py-2">
                                <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                                <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                            </div>
                        ) : pendingFiles.length === 0 ? (
                            <p className="text-xs text-slate-400 py-6 text-center">No staff files awaiting clearance.</p>
                        ) : (
                            <div className="space-y-2">
                                {pendingFiles.slice(0, 3).map((f) => (
                                    <div key={f.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-bold text-slate-900">{f.surname} {f.otherNames} ({f.staffId})</div>
                                            <div className="text-[11px] text-slate-500">{f.rank} &bull; {f.cadre}</div>
                                        </div>
                                        <Button
                                            variant="emerald"
                                            size="xs"
                                            onClick={() => {
                                                setSelectedFile(f);
                                                setActiveSection('files');
                                            }}
                                        >
                                            Clear File
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs md:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Key size={16} className="text-indigo-600" />
                                Institutional Role Changes Requiring Dual-Control Clearance
                            </h2>
                            <Button variant="ghost" size="xs" onClick={() => setActiveSection('roles')}>
                                View All ({pendingRoleChanges.length})
                            </Button>
                        </div>
                        {loadingQueue ? (
                            <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                        ) : pendingRoleChanges.length === 0 ? (
                            <p className="text-xs text-slate-400 py-4 text-center">No pending role change requests.</p>
                        ) : (
                            <div className="space-y-2">
                                {pendingRoleChanges.slice(0, 5).map((rc) => (
                                    <div key={rc.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                                <span>{rc.name}</span>
                                                <span className="font-mono text-[11px] bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded">
                                                    {rc.staffProfile?.staffId || rc.email}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
                                                <span className="font-mono text-slate-500 line-through">{rc.role}</span>
                                                <span>&rarr;</span>
                                                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                                    {rc.pendingRole}
                                                </span>
                                                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium border border-amber-200">
                                                    Role will take effect immediately after registrar&apos;s authorization
                                                </span>
                                            </div>
                                            {rc.roleChangeRemarks && (
                                                <div className="italic text-slate-500 text-[10px] mt-1">
                                                    Justification: &ldquo;{rc.roleChangeRemarks}&rdquo;
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Button
                                                variant="danger"
                                                size="xs"
                                                isLoading={actionLoading}
                                                onClick={() => handleRoleChangeDecision(rc.id, 'REJECTED')}
                                            >
                                                Reject
                                            </Button>
                                            <Button
                                                variant="emerald"
                                                size="xs"
                                                isLoading={actionLoading}
                                                onClick={() => handleRoleChangeDecision(rc.id, 'APPROVED')}
                                            >
                                                Authorize
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                onClick={() => setActiveSection('roles')}
                                            >
                                                Details
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Section 2: Split-screen Diff / Dossier Viewer for Postings */}
            {activeSection === 'postings' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left: Queue Listing */}
                    <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Pending Postings</h2>
                            <span className="text-[11px] text-slate-500">{pendingPostings.length} records</span>
                        </div>

                        {loadingQueue ? (
                            <div className="space-y-2">
                                <div className="h-14 bg-slate-100 rounded-xl animate-pulse" />
                                <div className="h-14 bg-slate-100 rounded-xl animate-pulse" />
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                {pendingPostings.map((p) => {
                                    const isSelected = selectedPosting?.id === p.id;
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => setSelectedPosting(p)}
                                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                                isSelected
                                                    ? 'bg-emerald-50/60 border-emerald-400 ring-1 ring-emerald-400'
                                                    : 'bg-white border-slate-200/70 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="text-xs font-bold text-slate-900">{p.staff?.name}</div>
                                            <div className="text-[11px] text-slate-500 mt-0.5">
                                                To: {p.newUnit?.name || p.newCenter?.name || 'Unassigned'}
                                            </div>
                                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[10px]">
                                                <span className="text-slate-400">Imputed by: {p.initiatedBy?.name || 'HR Admin'}</span>
                                                <span className="text-amber-700 font-semibold">Pending</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right: Split-screen Diff / Dossier Viewer & Fast Decision Drawer */}
                    <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                        {selectedPosting ? (
                            <div>
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                                    <div>
                                        <span className="text-[10px] font-bold text-emerald-800 uppercase px-2 py-0.5 bg-emerald-100 rounded-sm">
                                            Posting Ratification Dossier
                                        </span>
                                        <h2 className="text-lg font-bold text-slate-900 mt-1">
                                            {selectedPosting.staff?.name}
                                        </h2>
                                        <div className="text-xs text-slate-500">
                                            Staff ID: {selectedPosting.staff?.staffProfile?.staffId || 'N/A'} &bull; Cadre: {selectedPosting.staff?.staffProfile?.cadre || 'N/A'}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-semibold text-slate-400">Effective Date</div>
                                        <div className="text-xs font-bold text-slate-900">
                                            {new Date(selectedPosting.effectiveDate).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>

                                {/* Split Screen Comparison: Current Profile vs Imputed Changes */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                                        <div className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                                            <Building2 size={14} /> Current Institutional Placement
                                        </div>
                                        <div className="space-y-2 text-xs">
                                            <div>
                                                <span className="text-slate-400">Current Unit/Directorate:</span>
                                                <div className="font-semibold text-slate-800">
                                                    {selectedPosting.oldUnit?.name || selectedPosting.staff?.staffProfile?.unit?.name || 'Main Registry'}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-slate-400">Current Rank:</span>
                                                <div className="font-semibold text-slate-800">
                                                    {selectedPosting.staff?.staffProfile?.rank || 'Staff Officer'}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-slate-400">Current Grade Level:</span>
                                                <div className="font-semibold text-slate-800">
                                                    {selectedPosting.staff?.staffProfile?.level || 'CONTISS 08'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                                        <div className="text-xs font-bold text-emerald-800 uppercase mb-3 flex items-center gap-1.5">
                                            <ArrowRightLeft size={14} /> Imputed Posting Order
                                        </div>
                                        <div className="space-y-2 text-xs">
                                            <div>
                                                <span className="text-emerald-700 font-medium">New Target Location:</span>
                                                <div className="font-bold text-emerald-950">
                                                    {selectedPosting.newUnit?.name || selectedPosting.newCenter?.name || 'Target Unit'}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-emerald-700 font-medium">Imputed By:</span>
                                                <div className="font-semibold text-slate-800">
                                                    {selectedPosting.initiatedBy?.name} ({selectedPosting.initiatedBy?.role})
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-emerald-700 font-medium">Administrative Reason:</span>
                                                <div className="italic text-slate-700 bg-white p-2 rounded-md border border-emerald-200/60 mt-1">
                                                    &ldquo;{selectedPosting.reason}&rdquo;
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Fast Decision Action Bar */}
                                <div className="border-t border-slate-100 pt-4">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Executive Remarks / Justification (Mandatory for Rejections)
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={decisionRemarks}
                                        onChange={(e) => setDecisionRemarks(e.target.value)}
                                        placeholder="Add executive comments or conditions for approval..."
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none mb-4"
                                    />

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                isLoading={actionLoading}
                                                onClick={() => handlePostingDecision(selectedPosting.id, 'REJECTED')}
                                                icon={<XCircle size={14} />}
                                            >
                                                Reject Posting
                                            </Button>
                                            <Button
                                                variant="amber"
                                                size="sm"
                                                isLoading={actionLoading}
                                                onClick={() => handlePostingDecision(selectedPosting.id, 'RETURNED_TO_IMPUTER')}
                                                icon={<RotateCcw size={14} />}
                                            >
                                                Query Imputer / Return
                                            </Button>
                                        </div>

                                        <Button
                                            variant="emerald"
                                            size="md"
                                            isLoading={actionLoading}
                                            onClick={() => handlePostingDecision(selectedPosting.id, 'APPROVED')}
                                            icon={<Stamp size={16} />}
                                        >
                                            Authorize & Sign with Digital Stamp
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-12 text-center text-slate-400 text-xs">
                                Select a staff posting order from the queue to view details.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Section 3: File Clearances */}
            {activeSection === 'files' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Files Pending Clearance</h2>
                            <span className="text-[11px] text-slate-500">{pendingFiles.length} files</span>
                        </div>

                        {loadingQueue ? (
                            <div className="space-y-2">
                                <div className="h-14 bg-slate-100 rounded-xl animate-pulse" />
                                <div className="h-14 bg-slate-100 rounded-xl animate-pulse" />
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                {pendingFiles.map((f) => {
                                    const isSelected = selectedFile?.id === f.id;
                                    return (
                                        <div
                                            key={f.id}
                                            onClick={() => setSelectedFile(f)}
                                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                                isSelected
                                                    ? 'bg-emerald-50/60 border-emerald-400 ring-1 ring-emerald-400'
                                                    : 'bg-white border-slate-200/70 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="text-xs font-bold text-slate-900">{f.surname} {f.otherNames}</div>
                                            <div className="text-[11px] text-slate-500 mt-0.5">{f.staffId} &bull; {f.rank}</div>
                                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[10px]">
                                                <span className="text-slate-400">Created: {new Date(f.clearanceSubmittedAt || f.createdAt).toLocaleDateString()}</span>
                                                <span className="text-amber-700 font-semibold">Locked</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                        {selectedFile ? (
                            <div>
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                                    <div>
                                        <span className="text-[10px] font-bold text-emerald-800 uppercase px-2 py-0.5 bg-emerald-100 rounded-sm">
                                            Official Digital File Clearance
                                        </span>
                                        <h2 className="text-lg font-bold text-slate-900 mt-1">
                                            {selectedFile.surname} {selectedFile.otherNames}
                                        </h2>
                                        <div className="text-xs text-slate-500">
                                            Staff ID: {selectedFile.staffId} &bull; Official Email: {selectedFile.user?.email}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                            🟡 PENDING_REGISTRAR_CLEARANCE
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                                        <div className="font-bold text-slate-700 uppercase mb-2">Candidate Bio-Data</div>
                                        <div><span className="text-slate-400">Rank/Cadre:</span> <span className="font-semibold text-slate-800">{selectedFile.rank} ({selectedFile.cadre})</span></div>
                                        <div><span className="text-slate-400">Level / Step:</span> <span className="font-semibold text-slate-800">{selectedFile.level} / {selectedFile.step}</span></div>
                                        <div><span className="text-slate-400">Phone:</span> <span className="font-semibold text-slate-800">{selectedFile.phone || 'N/A'}</span></div>
                                        <div><span className="text-slate-400">Appointment Date:</span> <span className="font-semibold text-slate-800">{new Date(selectedFile.dateOfFirstAppointment).toLocaleDateString()}</span></div>
                                    </div>

                                    <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2 text-xs">
                                        <div className="font-bold text-emerald-800 uppercase mb-2">Imputer Metadata & Security</div>
                                        <div><span className="text-emerald-700">Imputer Officer:</span> <span className="font-semibold text-slate-800">{selectedFile.createdBy?.name || 'Registry HR'}</span></div>
                                        <div><span className="text-emerald-700">Imputer Role:</span> <span className="font-semibold text-slate-800">{selectedFile.createdBy?.role || 'HR_ADMIN'}</span></div>
                                        <div><span className="text-emerald-700">Submission Time:</span> <span className="font-semibold text-slate-800">{new Date(selectedFile.clearanceSubmittedAt || selectedFile.createdAt).toLocaleString()}</span></div>
                                        <div className="p-2 bg-white rounded-md border border-emerald-200/60 text-[11px] text-slate-600 mt-2">
                                            Upon clearance, account will unlock (`isActivated: true`), and a one-time activation token will be dispatched to candidate.
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-4">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Clearance Remarks
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={decisionRemarks}
                                        onChange={(e) => setDecisionRemarks(e.target.value)}
                                        placeholder="Add clearance remarks for staff audit trail..."
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none mb-4"
                                    />

                                    <div className="flex items-center justify-between">
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            isLoading={actionLoading}
                                            onClick={() => handleFileClearance(selectedFile.id, 'REJECT')}
                                            icon={<XCircle size={14} />}
                                        >
                                            Reject File Clearance
                                        </Button>
                                        <Button
                                            variant="emerald"
                                            size="md"
                                            isLoading={actionLoading}
                                            onClick={() => handleFileClearance(selectedFile.id, 'CLEAR')}
                                            icon={<Key size={16} />}
                                        >
                                            Clear File & Dispatch Activation Token
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-12 text-center text-slate-400 text-xs">
                                Select a staff file from the queue to review and clear.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Section 4: Promotion Overrides */}
            {activeSection === 'promotions' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <TrendingUp size={16} className="text-[#006533]" />
                            Promotion Overrides Docket
                        </h2>
                        <span className="text-xs text-slate-500 font-semibold">{pendingOverrides.length} requests</span>
                    </div>

                    {pendingOverrides.length === 0 ? (
                        <p className="text-xs text-slate-400 py-8 text-center">No promotion override requests pending review.</p>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {pendingOverrides.map((ov) => (
                                <div key={ov.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <div className="text-xs font-bold text-slate-900">
                                            {ov.user?.name} ({ov.staffId})
                                        </div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                            Requested Due Year: <strong className="text-emerald-700">{ov.requestedPromotionDueYear}</strong> &bull; Current: {ov.nextDueYear || 'N/A'}
                                        </div>
                                        <div className="text-xs italic text-slate-600 bg-slate-50 p-2 rounded-md mt-1.5 border border-slate-100">
                                            &ldquo;{ov.promotionOverrideJustification || 'Council accelerated approval'}&rdquo;
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            isLoading={actionLoading}
                                            onClick={() => handleOverrideDecision(ov.id, 'REJECTED')}
                                        >
                                            Reject
                                        </Button>
                                        <Button
                                            variant="emerald"
                                            size="sm"
                                            isLoading={actionLoading}
                                            onClick={() => handleOverrideDecision(ov.id, 'APPROVED')}
                                        >
                                            Approve Override
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Section: Institutional Role Changes Docket */}
            {activeSection === 'roles' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Key size={16} className="text-indigo-600" />
                                Institutional Role Authorization Docket (Maker-Checker Gate)
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Dual-control enforcement: Role adjustments requested by HR/Registry Admin require formal Registrar sign-off before taking effect.
                            </p>
                        </div>
                        <span className="text-xs text-slate-500 font-semibold">{pendingRoleChanges.length} pending</span>
                    </div>

                    {pendingRoleChanges.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-xs">
                            <Key className="mx-auto mb-2 text-slate-300" size={32} />
                            No role change requests currently awaiting authorization.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {pendingRoleChanges.map((rc) => (
                                <div key={rc.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-900">
                                                {rc.name}
                                            </span>
                                            {rc.staffProfile?.staffId && (
                                                <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                                    ID: {rc.staffProfile.staffId}
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-500">
                                                ({rc.email})
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs flex-wrap">
                                            <span className="text-slate-500">Current Role:</span>
                                            <span className="px-2 py-0.5 rounded font-mono font-semibold bg-slate-100 text-slate-700">
                                                {rc.role}
                                            </span>
                                            <span className="text-slate-400 font-bold">&rarr;</span>
                                            <span className="text-slate-500">Requested Role:</span>
                                            <span className="px-2 py-0.5 rounded font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                                {rc.pendingRole}
                                            </span>
                                            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium border border-amber-200">
                                                Role will take effect immediately after registrar&apos;s authorization
                                            </span>
                                        </div>

                                        {rc.staffProfile && (
                                            <div className="text-[11px] text-slate-500">
                                                {rc.staffProfile.rank && <span>Rank: {rc.staffProfile.rank} &bull; </span>}
                                                {rc.staffProfile.cadre && <span>Cadre: {rc.staffProfile.cadre} &bull; </span>}
                                                <span>Unit/Location: {rc.staffProfile.unit?.name || rc.staffProfile.studyCenter?.name || 'Unassigned'}</span>
                                            </div>
                                        )}

                                        {rc.roleChangeRemarks && (
                                            <div className="text-xs italic text-slate-600 bg-amber-50/60 p-2 rounded-lg border border-amber-100 max-w-xl">
                                                Justification: &ldquo;{rc.roleChangeRemarks}&rdquo;
                                            </div>
                                        )}

                                        {rc.roleChangeRequestedAt && (
                                            <div className="text-[10px] text-slate-400">
                                                Submitted: {new Date(rc.roleChangeRequestedAt).toLocaleString()}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            isLoading={actionLoading}
                                            onClick={() => handleRoleChangeDecision(rc.id, 'REJECTED')}
                                            icon={<XCircle size={14} />}
                                        >
                                            Reject
                                        </Button>
                                        <Button
                                            variant="emerald"
                                            size="sm"
                                            isLoading={actionLoading}
                                            onClick={() => handleRoleChangeDecision(rc.id, 'APPROVED')}
                                            icon={<ShieldCheck size={14} />}
                                        >
                                            Authorize Role Change
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Section 5: Audit & Digital Signature Trails */}
            {activeSection === 'audits' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <ShieldCheck size={16} className="text-[#006533]" />
                            Authorization Audit Trail & Cryptographic Signature Logs
                        </h2>
                        <Button
                            variant="outline"
                            size="xs"
                            onClick={handleExportAuditCsv}
                            icon={<Download size={14} />}
                        >
                            Download CSV
                        </Button>
                    </div>

                    {audits.length === 0 ? (
                        <p className="text-xs text-slate-400 py-8 text-center">No audit records found.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                                        <th className="py-2.5 px-3">Entity Type</th>
                                        <th className="py-2.5 px-3">Action</th>
                                        <th className="py-2.5 px-3">Imputer</th>
                                        <th className="py-2.5 px-3">Authorizer</th>
                                        <th className="py-2.5 px-3">Authorized At</th>
                                        <th className="py-2.5 px-3">Cryptographic Stamp</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {audits.map((a) => (
                                        <tr key={a.id} className="hover:bg-slate-50/50">
                                            <td className="py-2.5 px-3 font-bold text-slate-800">{a.entityType}</td>
                                            <td className="py-2.5 px-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    a.actionTaken === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {a.actionTaken}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600">{a.imputer?.name} ({a.imputer?.role})</td>
                                            <td className="py-2.5 px-3 text-slate-600">{a.authorizer?.name} ({a.authorizer?.role})</td>
                                            <td className="py-2.5 px-3 text-slate-500">{new Date(a.authorizedAt).toLocaleString()}</td>
                                            <td className="py-2.5 px-3 font-mono text-[10px] text-emerald-800">{a.digitalStampRef || 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
