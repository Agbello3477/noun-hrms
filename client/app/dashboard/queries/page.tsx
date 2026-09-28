'use client';

import { useState, useEffect } from 'react';
import api, { getImageUrl } from '../../../lib/api';
import { useSwrData } from '../../../hooks/useSwrData';
import { 
    AlertTriangle, 
    Clock, 
    Paperclip, 
    Send, 
    CheckCircle, 
    Plus, 
    X, 
    ShieldAlert, 
    FileText, 
    AlertCircle, 
    XCircle,
    UserCheck,
    Lock
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import Button from '../../../components/ui/Button';

interface Query {
    id: string;
    description: string;
    content?: string;
    title?: string;
    severity: string;
    actionType?: 'QUERY' | 'OFFICIAL_WARNING';
    stipulatedHours?: number;
    slaBreached?: boolean;
    deadline?: string;
    responseDeadline?: string;
    status: 'OPEN' | 'PENDING' | 'DEFAULTED_UNANSWERED' | 'RESPONDED' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';
    createdAt: string;
    updatedAt?: string;
    issuedBy?: {
        id: string;
        name: string;
        role?: string;
        staffProfile?: {
            rank?: string;
            signatureUrl?: string | null;
        };
    };
    staff?: {
        id: string;
        staffId: string;
        user?: { name: string; email: string };
    };
    response?: string;
    responseAttachmentUrl?: string;
    copyHR?: boolean;
}

export default function MyQueriesPage() {
    const { user } = useAuth();
    const { data: queries = [], isLoading: loading, refresh: fetchQueries } = useSwrData<Query[]>('/api/queries', { ttl: 15000 });

    const isIssuerRole = user && ['HR_ADMIN', 'REGISTRAR', 'SUPER_USER', 'VICE_CHANCELLOR', 'UNIT_HEAD', 'UNIT_ADMIN', 'STUDY_CENTER_MANAGER', 'ADMIN'].includes(user.role);

    // Reply State
    const [replyContent, setReplyContent] = useState('');
    const [replyFile, setReplyFile] = useState<File | null>(null);
    const [activeQuery, setActiveQuery] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Issue Action Modal State
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [issueFormData, setIssueFormData] = useState({
        staffProfileId: '',
        actionType: 'QUERY' as 'QUERY' | 'OFFICIAL_WARNING',
        title: '',
        content: '',
        severity: 'NORMAL',
        stipulatedHours: '48',
        copyHR: true
    });
    const [issueLoading, setIssueLoading] = useState(false);
    const [issueError, setIssueError] = useState('');

    useEffect(() => {
        if (showIssueModal && staffList.length === 0) {
            api.get('/api/staff')
                .then(res => setStaffList(res.data || []))
                .catch(err => console.error('Failed to load staff list for disciplinary modal', err));
        }
    }, [showIssueModal, staffList.length]);

    const getIssuerDisplayName = (issuedBy?: any) => {
        if (!issuedBy) return 'Central Registry';
        const role = issuedBy.role;
        if (['HR_ADMIN', 'REGISTRAR', 'SUPER_USER', 'ADMIN', 'VICE_CHANCELLOR'].includes(role)) {
            return 'Central Registry';
        }
        if (['UNIT_HEAD', 'UNIT_ADMIN', 'DIRECTOR', 'DEAN'].includes(role)) {
            return 'Director / Dean / HOD';
        }
        if (role === 'STUDY_CENTER_MANAGER') {
            return 'Study Center Director';
        }
        return 'Registry HR';
    };

    const handleReply = async (e: React.FormEvent, targetQueryId: string, text: string, file: File | null) => {
        e.preventDefault();
        if (!targetQueryId || !text || !text.trim()) {
            alert('Please enter your response explanation before submitting.');
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('queryId', targetQueryId);
            formData.append('responseText', text.trim());
            formData.append('content', text.trim());
            if (file) {
                formData.append('file', file);
            }

            await api.post('/api/queries/respond', formData);
            setReplyContent('');
            setReplyFile(null);
            setActiveQuery(null);
            await fetchQueries();
            alert('Formal response submitted successfully.');
        } catch (error: any) {
            console.error('Reply submission error:', error);
            const msg = error.response?.data?.message || error.message || 'Failed to send reply';
            alert(`Failed to send reply: ${msg}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleIssueSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIssueLoading(true);
        setIssueError('');

        try {
            await api.post('/api/queries', {
                ...issueFormData,
                stipulatedHours: Number(issueFormData.stipulatedHours)
            });

            alert(issueFormData.actionType === 'OFFICIAL_WARNING' 
                ? 'Official Warning / Caution logged into staff record.' 
                : 'Formal Query dispatched with mandatory response deadline.');
            
            setShowIssueModal(false);
            setIssueFormData({
                staffProfileId: '',
                actionType: 'QUERY',
                title: '',
                content: '',
                severity: 'NORMAL',
                stipulatedHours: '48',
                copyHR: true
            });
            await fetchQueries();
        } catch (err: any) {
            console.error('Issue error:', err);
            setIssueError(err.response?.data?.message || err.message || 'Failed to issue disciplinary action');
        } finally {
            setIssueLoading(false);
        }
    };

    if (loading && queries.length === 0) return <div className="p-8 text-center text-gray-500">Loading queries...</div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-gradient-to-r from-red-950 via-slate-900 to-red-950 p-6 rounded-2xl text-white shadow-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-red-500/20 rounded-xl border border-red-400/30">
                            <ShieldAlert className="w-7 h-7 text-red-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Disciplinary Folio &amp; Official Queries</h1>
                            <p className="text-slate-300 text-xs mt-0.5">
                                Institutional queries, mandatory defense SLA monitors, and permanent official warnings.
                            </p>
                        </div>
                    </div>
                </div>

                {isIssuerRole && (
                    <Button
                        variant="primary"
                        onClick={() => setShowIssueModal(true)}
                        className="bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30"
                    >
                        <Plus className="w-4 h-4 mr-1.5" /> Issue Disciplinary Action
                    </Button>
                )}
            </div>

            {/* Queries List */}
            <div className="space-y-6">
                {queries.map(query => {
                    const isWarning = query.actionType === 'OFFICIAL_WARNING';
                    const isDefaulted = query.status === 'DEFAULTED_UNANSWERED' || query.slaBreached;
                    const isOpen = query.status === 'OPEN' || query.status === 'PENDING';
                    const targetDeadline = query.responseDeadline || query.deadline;

                    return (
                        <div key={query.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
                            isDefaulted ? 'border-rose-300 ring-2 ring-rose-500/20' : 'border-gray-200'
                        }`}>
                            {/* Card Header */}
                            <div className={`px-6 py-4 border-b flex justify-between items-start ${
                                isDefaulted ? 'bg-rose-50/80 border-rose-100' : isWarning ? 'bg-amber-50/70 border-amber-100' : 'bg-red-50/60 border-red-100'
                            }`}>
                                <div className="flex gap-4">
                                    <AlertTriangle className={`mt-1 flex-shrink-0 ${isDefaulted ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-red-600'}`} size={24} />
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap pb-1">
                                            <h3 className="font-bold text-gray-900 text-base">
                                                {query.title || (isWarning ? 'Official Warning / Caution' : 'Disciplinary Query')}
                                            </h3>
                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                                                isWarning 
                                                    ? 'bg-amber-100 text-amber-900 border-amber-300' 
                                                    : 'bg-red-100 text-red-900 border-red-300'
                                            }`}>
                                                {isWarning ? 'OFFICIAL WARNING (NO DEFENSE REQUIRED)' : 'FORMAL QUERY (MANDATORY DEFENSE)'}
                                            </span>
                                            {isDefaulted && (
                                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-600 text-white flex items-center gap-1 shadow-sm">
                                                    <Lock size={10} /> DEFAULTED — DISCIPLINARY HOLD ACTIVE
                                                </span>
                                            )}
                                            {!query.copyHR && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                                                    Internal
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-xs text-gray-600 mb-2 font-medium">
                                            Issued by <strong className="text-gray-900">{getIssuerDisplayName(query.issuedBy)}</strong>
                                        </p>

                                        <div className="text-gray-900 text-sm bg-white p-3 rounded-lg border border-gray-150 shadow-inner">
                                            <div dangerouslySetInnerHTML={{ __html: query.content || query.description }} className="prose max-w-none text-gray-900" />
                                        </div>

                                        <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-600 font-medium items-center">
                                            <span className="uppercase bg-gray-100 px-2 py-0.5 rounded font-bold text-gray-700">
                                                Severity: {query.severity || 'NORMAL'}
                                            </span>
                                            {targetDeadline && !isWarning && (
                                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded font-semibold ${
                                                    isDefaulted ? 'bg-rose-100 text-rose-800' : 'bg-blue-50 text-blue-800'
                                                }`}>
                                                    <Clock size={12} /> Deadline: {new Date(targetDeadline).toLocaleString('en-NG')}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1 font-bold">
                                                Status: <span className={isDefaulted ? 'text-rose-600' : 'text-gray-900'}>{query.status}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-xs text-gray-400 font-medium">
                                    {new Date(query.createdAt).toLocaleDateString()}
                                </div>
                            </div>

                            {/* Response Section */}
                            {!isWarning && (
                                <div className="px-6 py-4 bg-gray-50/50 space-y-4">
                                    {!query.response ? (
                                        <p className="text-center text-gray-400 text-xs italic py-2">
                                            {isDefaulted ? 'Deadline expired without an official defense. This matter has escalated to Central Registry.' : 'No defense explanation submitted yet.'}
                                        </p>
                                    ) : (
                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between items-center text-xs text-gray-500">
                                                <span className="font-bold text-gray-700">Staff Formal Explanation / Defense</span>
                                                <span>Submitted</span>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border border-gray-200 text-sm text-gray-800 shadow-sm">
                                                {query.response}
                                                {query.responseAttachmentUrl && (
                                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                                        <a href={`${process.env.NEXT_PUBLIC_API_URL}${query.responseAttachmentUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-xs font-semibold">
                                                            <Paperclip size={12} /> View Defense Attachment
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Reply Form (For regular queries still open) */}
                            {!isWarning && isOpen && !query.response && (
                                <div className="p-4 border-t border-gray-200 bg-white">
                                    <form onSubmit={(e) => handleReply(e, query.id, activeQuery === query.id ? replyContent : '', activeQuery === query.id ? replyFile : null)}>
                                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                                            Submit Formal Defense &amp; Representation
                                        </label>
                                        <textarea
                                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none text-black"
                                            rows={3}
                                            placeholder="State your formal defense and explanation..."
                                            value={activeQuery === query.id ? replyContent : ''}
                                            onChange={e => { setActiveQuery(query.id); setReplyContent(e.target.value); }}
                                            required
                                        />
                                        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mt-2">
                                            <input
                                                type="file"
                                                className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                                                onChange={e => { setActiveQuery(query.id); setReplyFile(e.target.files?.[0] || null); }}
                                            />
                                            <button
                                                type="submit"
                                                disabled={submitting && activeQuery === query.id}
                                                className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 transition"
                                            >
                                                <Send size={14} /> {submitting && activeQuery === query.id ? 'Submitting...' : 'Submit Official Defense'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>
                    );
                })}

                {queries.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
                        <CheckCircle className="mx-auto text-emerald-500 mb-2" size={36} />
                        <h3 className="text-lg font-bold text-gray-900">Good Standing</h3>
                        <p className="text-gray-500 text-sm mt-1">Your staff record is clean with no active queries or warnings.</p>
                    </div>
                )}
            </div>

            {/* Issue Disciplinary Action Modal */}
            {showIssueModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
                        <div className="flex items-center justify-between border-b pb-3">
                            <div className="flex items-center gap-2 text-red-600">
                                <ShieldAlert size={22} />
                                <h3 className="text-lg font-bold text-gray-900">Issue Disciplinary Action</h3>
                            </div>
                            <button onClick={() => setShowIssueModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        {issueError && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                                {issueError}
                            </div>
                        )}

                        <form onSubmit={handleIssueSubmit} className="space-y-4">
                            {/* Action Type Toggle */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Disciplinary Instrument Type *</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIssueFormData(prev => ({ ...prev, actionType: 'QUERY' }))}
                                        className={`p-3 rounded-xl border text-left transition ${
                                            issueFormData.actionType === 'QUERY'
                                                ? 'border-red-600 bg-red-50/60 ring-2 ring-red-500/20'
                                                : 'border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="font-bold text-xs text-red-950">1. Formal Query</div>
                                        <div className="text-[11px] text-red-700 mt-0.5">Requires mandatory defense within stipulated timeframe.</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setIssueFormData(prev => ({ ...prev, actionType: 'OFFICIAL_WARNING' }))}
                                        className={`p-3 rounded-xl border text-left transition ${
                                            issueFormData.actionType === 'OFFICIAL_WARNING'
                                                ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20'
                                                : 'border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="font-bold text-xs text-amber-950">2. Official Warning / Admonition</div>
                                        <div className="text-[11px] text-amber-800 mt-0.5">Formal caution auto-logged into permanent staff folio.</div>
                                    </button>
                                </div>
                            </div>

                            {/* Select Staff */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Target Staff Member *</label>
                                <select
                                    required
                                    value={issueFormData.staffProfileId}
                                    onChange={e => setIssueFormData(prev => ({ ...prev, staffProfileId: e.target.value }))}
                                    className="w-full p-2.5 border rounded-lg text-sm bg-white text-black focus:ring-2 focus:ring-red-500 outline-none"
                                >
                                    <option value="">-- Select Staff Member --</option>
                                    {staffList.map(s => (
                                        <option key={s.id} value={s.staffProfile?.id || s.id}>
                                            {s.name} ({s.staffProfile?.staffId || s.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Title / Subject */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Subject / Query Title *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Query on Unauthorized Absence from Duty / Negligence"
                                    value={issueFormData.title}
                                    onChange={e => setIssueFormData(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-red-500 outline-none"
                                />
                            </div>

                            {/* Stipulated Hours (if Query) */}
                            {issueFormData.actionType === 'QUERY' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Stipulated Defense Deadline *</label>
                                    <select
                                        value={issueFormData.stipulatedHours}
                                        onChange={e => setIssueFormData(prev => ({ ...prev, stipulatedHours: e.target.value }))}
                                        className="w-full p-2.5 border rounded-lg text-sm bg-white text-black focus:ring-2 focus:ring-red-500 outline-none"
                                    >
                                        <option value="24">24 Hours (Urgent / Critical Matter)</option>
                                        <option value="48">48 Hours (Standard Statutory Window)</option>
                                        <option value="72">72 Hours (Extended Representation Window)</option>
                                    </select>
                                </div>
                            )}

                            {/* Content */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Detailed Particulars / Allegation *</label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="Specify details, dates, and institutional regulations breached..."
                                    value={issueFormData.content}
                                    onChange={e => setIssueFormData(prev => ({ ...prev, content: e.target.value }))}
                                    className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-red-500 outline-none"
                                />
                            </div>

                            {/* Copy HR Toggle */}
                            <label className="flex items-center gap-2 cursor-pointer pt-1">
                                <input
                                    type="checkbox"
                                    checked={issueFormData.copyHR}
                                    onChange={e => setIssueFormData(prev => ({ ...prev, copyHR: e.target.checked }))}
                                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                />
                                <span className="text-xs font-semibold text-gray-700">
                                    Copy Central Registry HR &amp; Registrar Folio (Mandatory for Institutional Queries)
                                </span>
                            </label>

                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <Button
                                    variant="secondary"
                                    type="button"
                                    onClick={() => setShowIssueModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    type="submit"
                                    disabled={issueLoading}
                                >
                                    {issueLoading ? 'Dispatching...' : 'Dispatch Action'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
