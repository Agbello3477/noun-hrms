'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { CADRE_LIST, getPostsByCadre, getPostDefinition } from '../../lib/schemeOfService';
import {
    FileText,
    Send,
    AlertCircle,
    CheckCircle2,
    Clock,
    UserCheck,
    ArrowRightLeft,
    FolderPlus,
    ShieldAlert,
    TrendingUp,
    Calendar,
    Layers,
    RotateCcw
} from 'lucide-react';

export default function RegistryWorkspacePage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'posting' | 'file' | 'query' | 'promotion' | 'drafts'>('posting');
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Staged Drafts Data
    const [draftPostings, setDraftPostings] = useState<any[]>([]);
    const [draftFiles, setDraftFiles] = useState<any[]>([]);
    const [loadingDrafts, setLoadingDrafts] = useState(false);

    // Form States - Posting
    const [postingForm, setPostingForm] = useState({
        staffId: '',
        toUnitId: '',
        toCenterId: '',
        destinationType: 'unit',
        reason: '',
        effectiveDate: new Date().toISOString().split('T')[0],
        relocationAllowance: false,
        relocationAllowanceAmount: 0
    });

    // Form States - Staff File
    const [fileForm, setFileForm] = useState({
        email: '',
        surname: '',
        otherNames: '',
        title: 'Mr',
        gender: 'Male',
        phone: '',
        cadre: 'Administrative Cadre',
        rank: 'Administrative Officer II',
        level: 'CONTISS 07',
        step: '1',
        employmentCategory: 'PERMANENT',
        dateOfBirth: '1990-01-01',
        dateOfFirstAppointment: new Date().toISOString().split('T')[0]
    });

    // Form States - Query
    const [queryForm, setQueryForm] = useState({
        staffId: '',
        title: '',
        content: ''
    });

    // Form States - Promotion Override Request
    const [promotionForm, setPromotionForm] = useState({
        staffProfileId: '',
        requestedDueYear: new Date().getFullYear(),
        justification: ''
    });

    // Role Verification
    useEffect(() => {
        if (!authLoading && user) {
            // Authorizers (Registrar) belong in Registrar Cockpit, not Imputer Workspace
            if (user.role === 'REGISTRAR' || user.role === 'DEPUTY_REGISTRAR') {
                router.replace('/registrar-cockpit');
            }
        }
    }, [user, authLoading, router]);

    // Load drafts when tab is selected
    useEffect(() => {
        if (activeTab === 'drafts') {
            loadDrafts();
        }
    }, [activeTab]);

    const loadDrafts = async () => {
        setLoadingDrafts(true);
        try {
            const [postingsRes, filesRes] = await Promise.all([
                api.get('/api/v1/registry/postings/drafts').catch(() => ({ data: [] })),
                api.get('/api/v1/registry/files/drafts').catch(() => ({ data: [] }))
            ]);
            setDraftPostings(postingsRes.data || []);
            setDraftFiles(filesRes.data || []);
        } catch (err: any) {
            console.error('Failed to load drafts', err);
        } finally {
            setLoadingDrafts(false);
        }
    };

    const handleDraftPosting = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setFeedback(null);
        try {
            await api.post('/api/v1/registry/postings/draft', {
                staffId: postingForm.staffId,
                toUnitId: postingForm.destinationType === 'unit' ? postingForm.toUnitId : undefined,
                toCenterId: postingForm.destinationType === 'center' ? postingForm.toCenterId : undefined,
                reason: postingForm.reason,
                effectiveDate: postingForm.effectiveDate,
                relocationAllowance: postingForm.relocationAllowance,
                relocationAllowanceAmount: postingForm.relocationAllowanceAmount
            });
            setFeedback({ type: 'success', message: 'Staff posting order drafted and staged for Registrar authorization.' });
            setPostingForm({
                staffId: '',
                toUnitId: '',
                toCenterId: '',
                destinationType: 'unit',
                reason: '',
                effectiveDate: new Date().toISOString().split('T')[0],
                relocationAllowance: false,
                relocationAllowanceAmount: 0
            });
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to draft posting order' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleInitiateFile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setFeedback(null);
        try {
            const res = await api.post('/api/v1/registry/files/initiate', fileForm);
            setFeedback({
                type: 'success',
                message: `Staff file initiated (${res.data.staffId}). Staged with status 🟡 Awaiting Registrar Clearance.`
            });
            setFileForm({
                email: '',
                surname: '',
                otherNames: '',
                title: 'Mr',
                gender: 'Male',
                phone: '',
                cadre: 'ADMINISTRATIVE',
                rank: 'Administrative Officer',
                level: 'CONTISS 08',
                step: '1',
                employmentCategory: 'PERMANENT',
                dateOfBirth: '1990-01-01',
                dateOfFirstAppointment: new Date().toISOString().split('T')[0]
            });
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to initiate staff file' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleIssueQuery = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setFeedback(null);
        try {
            await api.post('/api/v1/registry/queries/issue', queryForm);
            setFeedback({ type: 'success', message: 'Official disciplinary query issued successfully.' });
            setQueryForm({ staffId: '', title: '', content: '' });
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to issue query' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRequestPromotionOverride = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setFeedback(null);
        try {
            await api.post('/api/v1/registry/promotions/request-override', promotionForm);
            setFeedback({ type: 'success', message: 'Promotion override request staged for Registrar review.' });
            setPromotionForm({
                staffProfileId: '',
                requestedDueYear: new Date().getFullYear(),
                justification: ''
            });
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to request promotion override' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-8">
            {/* Top Operational Header */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-blue-100 text-blue-800 uppercase tracking-wide">
                            Registry Operations Workspace
                        </span>
                        <span className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-emerald-50 text-[#006533] border border-emerald-200">
                            Imputer (Maker Mode)
                        </span>
                    </div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-2">
                        Dual-Control Registry Operations Desk
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Impute and stage sensitive administrative records. All actions require independent Registrar authorization before activation.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button
                        variant="emerald"
                        size="sm"
                        onClick={() => router.push('/registry/inward-docket')}
                        icon={<FileText size={14} />}
                    >
                        Inward Docket Desk
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/registry/master-application-archive')}
                        icon={<Layers size={14} />}
                    >
                        Master Archive
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadDrafts}
                        icon={<RotateCcw size={14} />}
                    >
                        Refresh Drafts
                    </Button>
                </div>
            </div>

            {/* Notification Banner */}
            {feedback && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
                    feedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-900 border border-red-200'
                }`}>
                    {feedback.type === 'success' ? <CheckCircle2 size={18} className="text-[#006533]" /> : <AlertCircle size={18} className="text-red-600" />}
                    <span>{feedback.message}</span>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 mb-6">
                <button
                    onClick={() => setActiveTab('posting')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'posting' ? 'bg-[#006533] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <ArrowRightLeft size={15} />
                    Draft Staff Posting
                </button>
                <button
                    onClick={() => setActiveTab('file')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'file' ? 'bg-[#006533] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <FolderPlus size={15} />
                    Create Staff File
                </button>
                <button
                    onClick={() => setActiveTab('query')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'query' ? 'bg-[#006533] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <ShieldAlert size={15} />
                    Issue Query / Warning
                </button>
                <button
                    onClick={() => setActiveTab('promotion')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'promotion' ? 'bg-[#006533] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <TrendingUp size={15} />
                    Promotion Override Request
                </button>
                <button
                    onClick={() => setActiveTab('drafts')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'drafts' ? 'bg-[#006533] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <Clock size={15} />
                    Staged Records & Drafts
                </button>
            </div>

            {/* Tab 1: Draft Staff Posting Form */}
            {activeTab === 'posting' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs max-w-3xl">
                    <div className="mb-4">
                        <h2 className="text-base font-bold text-slate-900">Draft Staff Posting / Transfer Order</h2>
                        <p className="text-xs text-slate-500">Staged orders will be routed to the Registrar Cockpit for executive authorization.</p>
                    </div>

                    <form onSubmit={handleDraftPosting} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Staff Member Identifier (Staff ID / Email)</label>
                            <input
                                type="text"
                                required
                                value={postingForm.staffId}
                                onChange={(e) => setPostingForm({ ...postingForm, staffId: e.target.value })}
                                placeholder="e.g. NOUN/2026/0012 or ST-1001"
                                className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] focus:border-[#006533] outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Type</label>
                                <select
                                    value={postingForm.destinationType}
                                    onChange={(e) => setPostingForm({ ...postingForm, destinationType: e.target.value })}
                                    className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] focus:border-[#006533] outline-none"
                                >
                                    <option value="unit">Directorate / Unit / Faculty</option>
                                    <option value="center">Study Center</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    {postingForm.destinationType === 'unit' ? 'Target Unit Code / UUID' : 'Target Center Code / UUID'}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={postingForm.destinationType === 'unit' ? postingForm.toUnitId : postingForm.toCenterId}
                                    onChange={(e) => {
                                        if (postingForm.destinationType === 'unit') {
                                            setPostingForm({ ...postingForm, toUnitId: e.target.value });
                                        } else {
                                            setPostingForm({ ...postingForm, toCenterId: e.target.value });
                                        }
                                    }}
                                    placeholder={postingForm.destinationType === 'unit' ? 'e.g. REG-HR' : 'e.g. SC-ABJ'}
                                    className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] focus:border-[#006533] outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Effective Date</label>
                            <input
                                type="date"
                                required
                                value={postingForm.effectiveDate}
                                onChange={(e) => setPostingForm({ ...postingForm, effectiveDate: e.target.value })}
                                className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] focus:border-[#006533] outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Administrative Justification / Reason</label>
                            <textarea
                                required
                                rows={3}
                                value={postingForm.reason}
                                onChange={(e) => setPostingForm({ ...postingForm, reason: e.target.value })}
                                placeholder="State institutional reason for posting..."
                                className="w-full text-xs px-3.5 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] focus:border-[#006533] outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                            <input
                                type="checkbox"
                                id="relocAllowance"
                                checked={postingForm.relocationAllowance}
                                onChange={(e) => setPostingForm({ ...postingForm, relocationAllowance: e.target.checked })}
                                className="h-4 w-4 text-[#006533] rounded-sm border-slate-300 focus:ring-[#006533]"
                            />
                            <label htmlFor="relocAllowance" className="text-xs font-medium text-slate-700">
                                Relocation Allowance Applicable
                            </label>
                        </div>

                        {postingForm.relocationAllowance && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Allowance Amount (₦)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={postingForm.relocationAllowanceAmount}
                                    onChange={(e) => setPostingForm({ ...postingForm, relocationAllowanceAmount: parseFloat(e.target.value) || 0 })}
                                    className="w-full text-xs px-3.5 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] focus:border-[#006533] outline-none"
                                />
                            </div>
                        )}

                        <div className="pt-2 flex justify-end">
                            <Button
                                type="submit"
                                variant="emerald"
                                size="md"
                                isLoading={submitting}
                                loadingText="Staging Posting..."
                                icon={<Send size={15} />}
                            >
                                Stage Posting for Registrar Approval
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tab 2: Create Staff File Form */}
            {activeTab === 'file' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs max-w-3xl">
                    <div className="mb-4">
                        <h2 className="text-base font-bold text-slate-900">Initiate Digital Staff File</h2>
                        <p className="text-xs text-slate-500">File will be initiated in 🟡 PENDING_REGISTRAR_CLEARANCE status. Account remains locked until authorized.</p>
                    </div>

                    <form onSubmit={handleInitiateFile} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                                <select
                                    value={fileForm.title}
                                    onChange={(e) => setFileForm({ ...fileForm, title: e.target.value })}
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none"
                                >
                                    <option value="Mr">Mr</option>
                                    <option value="Mrs">Mrs</option>
                                    <option value="Ms">Ms</option>
                                    <option value="Dr">Dr</option>
                                    <option value="Prof">Prof</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Surname</label>
                                <input
                                    type="text"
                                    required
                                    value={fileForm.surname}
                                    onChange={(e) => setFileForm({ ...fileForm, surname: e.target.value })}
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Other Names</label>
                                <input
                                    type="text"
                                    required
                                    value={fileForm.otherNames}
                                    onChange={(e) => setFileForm({ ...fileForm, otherNames: e.target.value })}
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={fileForm.email}
                                    onChange={(e) => setFileForm({ ...fileForm, email: e.target.value })}
                                    placeholder="user@noun.edu.ng"
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    value={fileForm.phone}
                                    onChange={(e) => setFileForm({ ...fileForm, phone: e.target.value })}
                                    placeholder="+234..."
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Cadre</label>
                                <select
                                    value={fileForm.cadre}
                                    onChange={(e) => {
                                        const newCadre = e.target.value;
                                        const posts = getPostsByCadre(newCadre);
                                        const first = posts[0];
                                        setFileForm({
                                            ...fileForm,
                                            cadre: newCadre,
                                            rank: first ? first.post : '',
                                            level: first ? first.salaryScale : fileForm.level
                                        });
                                    }}
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none bg-white"
                                >
                                    <option value="">-- Select Cadre --</option>
                                    {CADRE_LIST.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Rank/Post</label>
                                <select
                                    value={fileForm.rank}
                                    onChange={(e) => {
                                        const newRank = e.target.value;
                                        const def = getPostDefinition(fileForm.cadre, newRank);
                                        setFileForm({
                                            ...fileForm,
                                            rank: newRank,
                                            level: def ? def.salaryScale : fileForm.level
                                        });
                                    }}
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none bg-white"
                                >
                                    <option value="">-- Select Rank/Post --</option>
                                    {getPostsByCadre(fileForm.cadre).map(p => (
                                        <option key={p.post} value={p.post}>{p.post} ({p.salaryScale})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Grade Level</label>
                                <input
                                    type="text"
                                    value={fileForm.level}
                                    onChange={(e) => setFileForm({ ...fileForm, level: e.target.value })}
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none"
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <Button
                                type="submit"
                                variant="emerald"
                                size="md"
                                isLoading={submitting}
                                loadingText="Initiating File..."
                                icon={<FolderPlus size={15} />}
                            >
                                Initiate File for Registrar Clearance
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tab 3: Issue Disciplinary Query */}
            {activeTab === 'query' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs max-w-3xl">
                    <div className="mb-4">
                        <h2 className="text-base font-bold text-slate-900">Issue Disciplinary Query / Warning</h2>
                        <p className="text-xs text-slate-500">Official registry query. Sets active disciplinary flag blocking automatic promotions.</p>
                    </div>

                    <form onSubmit={handleIssueQuery} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Staff Member Identifier</label>
                            <input
                                type="text"
                                required
                                value={queryForm.staffId}
                                onChange={(e) => setQueryForm({ ...queryForm, staffId: e.target.value })}
                                placeholder="Staff ID, Profile UUID, or User ID"
                                className="w-full text-xs px-3.5 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Query Subject / Title</label>
                            <input
                                type="text"
                                required
                                value={queryForm.title}
                                onChange={(e) => setQueryForm({ ...queryForm, title: e.target.value })}
                                placeholder="e.g. Unexplained Absence from Official Post"
                                className="w-full text-xs px-3.5 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Content / Query Details</label>
                            <textarea
                                required
                                rows={4}
                                value={queryForm.content}
                                onChange={(e) => setQueryForm({ ...queryForm, content: e.target.value })}
                                placeholder="State specific query observations, references, and deadline to respond..."
                                className="w-full text-xs px-3.5 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none"
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button
                                type="submit"
                                variant="amber"
                                size="md"
                                isLoading={submitting}
                                loadingText="Issuing Query..."
                                icon={<ShieldAlert size={15} />}
                            >
                                Dispatch Official Disciplinary Query
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tab 4: Promotion Override Request */}
            {activeTab === 'promotion' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs max-w-3xl">
                    <div className="mb-4">
                        <h2 className="text-base font-bold text-slate-900">Promotion Override Docket Staging</h2>
                        <p className="text-xs text-slate-500">Imputer requests fast-track or accelerated promotion due year for Registrar ratification.</p>
                    </div>

                    <form onSubmit={handleRequestPromotionOverride} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Staff Profile ID</label>
                            <input
                                type="text"
                                required
                                value={promotionForm.staffProfileId}
                                onChange={(e) => setPromotionForm({ ...promotionForm, staffProfileId: e.target.value })}
                                placeholder="Staff Profile UUID"
                                className="w-full text-xs px-3.5 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Requested Due Year</label>
                            <input
                                type="number"
                                required
                                min="2024"
                                max="2035"
                                value={promotionForm.requestedDueYear}
                                onChange={(e) => setPromotionForm({ ...promotionForm, requestedDueYear: parseInt(e.target.value, 10) })}
                                className="w-full text-xs px-3.5 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Administrative Justification (min 5 characters)</label>
                            <textarea
                                required
                                minLength={5}
                                rows={3}
                                value={promotionForm.justification}
                                onChange={(e) => setPromotionForm({ ...promotionForm, justification: e.target.value })}
                                placeholder="Council approval citation, outstanding service award justification, etc."
                                className="w-full text-xs px-3.5 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#006533] outline-none"
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button
                                type="submit"
                                variant="emerald"
                                size="md"
                                isLoading={submitting}
                                loadingText="Staging Override..."
                                icon={<TrendingUp size={15} />}
                            >
                                Stage Promotion Override for Registrar Approval
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tab 5: Staged Records & Drafts */}
            {activeTab === 'drafts' && (
                <div className="space-y-6">
                    {/* Draft Postings List */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <ArrowRightLeft size={16} className="text-[#006533]" />
                                Imputed Staff Postings
                            </h3>
                            <span className="text-xs text-slate-500 font-medium">{draftPostings.length} records</span>
                        </div>

                        {loadingDrafts ? (
                            <div className="space-y-2 py-4">
                                <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                                <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                            </div>
                        ) : draftPostings.length === 0 ? (
                            <p className="text-xs text-slate-400 py-3 text-center">No postings currently staged.</p>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {draftPostings.map((p) => (
                                    <div key={p.id} className="py-3 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-bold text-slate-800">
                                                {p.staff?.name} ({p.staff?.staffProfile?.staffId || 'N/A'})
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-0.5">
                                                Destination: {p.newUnit?.name || p.newCenter?.name || 'Unassigned'} &bull; Effective: {new Date(p.effectiveDate).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                                🟡 Awaiting Registrar Clearance
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Draft Files List */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <FolderPlus size={16} className="text-[#006533]" />
                                Imputed Staff Files
                            </h3>
                            <span className="text-xs text-slate-500 font-medium">{draftFiles.length} files</span>
                        </div>

                        {loadingDrafts ? (
                            <div className="space-y-2 py-4">
                                <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                                <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                            </div>
                        ) : draftFiles.length === 0 ? (
                            <p className="text-xs text-slate-400 py-3 text-center">No digital files awaiting clearance.</p>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {draftFiles.map((f) => (
                                    <div key={f.id} className="py-3 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-bold text-slate-800">
                                                {f.surname} {f.otherNames} ({f.staffId})
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-0.5">
                                                Rank: {f.rank} &bull; Cadre: {f.cadre} &bull; Email: {f.user?.email}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                                🔵 Imputed - In Review
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
