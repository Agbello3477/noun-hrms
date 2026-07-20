'use client';

import { useEffect, useState } from 'react';
import api, { getImageUrl } from '../../../lib/api';
import { AlertTriangle, Clock, Paperclip, Send, CheckCircle } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

interface Query {
    id: string;
    description: string;
    content?: string;
    title?: string;
    severity: string;
    deadline?: string;
    status: 'OPEN' | 'RESPONDED' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';
    createdAt: string;
    updatedAt?: string;
    issuedBy?: {
        name: string;
        staffProfile?: {
            rank?: string;
            signatureUrl?: string | null;
        };
    };
    response?: string;
    responseAttachmentUrl?: string;
    copyHR?: boolean;
}

export default function MyQueriesPage() {
    const { user } = useAuth();
    const [queries, setQueries] = useState<Query[]>([]);
    const [loading, setLoading] = useState(true);

    const getIssuerDisplayName = (issuedBy?: any) => {
        if (!issuedBy) return 'Registry';
        const role = issuedBy.role;
        if (['HR_ADMIN', 'SUPER_USER', 'ADMIN', 'VICE_CHANCELLOR'].includes(role)) {
            return 'Registry';
        }
        if (['UNIT_HEAD', 'UNIT_ADMIN', 'DIRECTOR', 'DEAN'].includes(role)) {
            return 'Unit Head';
        }
        if (role === 'STUDY_CENTER_MANAGER') {
            return 'Study Center Director';
        }
        return 'Registry';
    };

    // Reply State
    const [replyContent, setReplyContent] = useState('');
    const [replyFile, setReplyFile] = useState<File | null>(null);
    const [activeQuery, setActiveQuery] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const fetchQueries = async () => {
        try {
            const res = await api.get('/api/queries');
            setQueries(res.data);
        } catch (error) {
            console.error('Error fetching queries', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueries();
    }, []);

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
            alert('Response submitted successfully');
        } catch (error: any) {
            console.error('Reply submission error:', error);
            const msg = error.response?.data?.message || error.message || 'Failed to send reply';
            alert(`Failed to send reply: ${msg}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading queries...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">My Queries</h1>
            <p className="text-sm text-gray-500">View and respond to official queries issued to you.</p>

            <div className="space-y-6">
                {queries.map(query => (
                    <div key={query.id} className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
                        {/* Header */}
                        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-start">
                            <div className="flex gap-4">
                                <AlertTriangle className="text-red-600 mt-1" size={24} />
                                <div>
                                    <h3 className="font-bold text-red-900 pb-1 flex items-center gap-2">
                                        {query.title || 'Disciplinary Query'}
                                        {!query.copyHR && (
                                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-150 text-indigo-850 border border-indigo-250 rounded">Internal Only</span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-red-700 mb-2 font-medium">Issued by {getIssuerDisplayName(query.issuedBy)}</p>
                                    <div className="text-red-800 text-sm">
                                        <div dangerouslySetInnerHTML={{ __html: query.content || query.description }} className="prose max-w-none text-red-950" />
                                    </div>

                                    <div className="flex gap-4 mt-3 text-xs text-red-600 font-medium">
                                        <span className="uppercase bg-red-100 px-2 py-0.5 rounded">Severity: {query.severity || 'NORMAL'}</span>
                                        {query.deadline && (
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} /> Deadline: {new Date(query.deadline).toLocaleDateString()}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            Status: {query.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-xs text-gray-400">
                                {new Date(query.createdAt).toLocaleDateString()}
                            </div>
                        </div>

                        {/* Response Section */}
                        <div className="px-6 py-4 bg-gray-50 space-y-4">
                            {!query.response ? (
                                <p className="text-center text-gray-400 text-sm italic">No response submitted yet.</p>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    <div className="flex justify-between items-center text-xs text-gray-500">
                                        <span className="font-bold">Your Response</span>
                                        {/* Format timestamp if available, otherwise just show label */}
                                        <span>Submitted</span>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-gray-200 text-sm text-gray-800 shadow-sm">
                                        {query.response}
                                        {query.responseAttachmentUrl && (
                                            <div className="mt-2 pt-2 border-t border-gray-100">
                                                <a href={`${process.env.NEXT_PUBLIC_API_URL}${query.responseAttachmentUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-xs">
                                                    <Paperclip size={12} /> View Attachment
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Reply Form */}
                        {query.status === 'OPEN' && !query.response && (
                            <div className="p-4 border-t border-gray-200 bg-white">
                                <form onSubmit={(e) => handleReply(e, query.id, activeQuery === query.id ? replyContent : '', activeQuery === query.id ? replyFile : null)}>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Reply to Query</label>
                                    <textarea
                                        className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none"
                                        rows={3}
                                        placeholder="Type your explanation here..."
                                        value={activeQuery === query.id ? replyContent : ''}
                                        onChange={e => { setActiveQuery(query.id); setReplyContent(e.target.value); }}
                                        required
                                    />
                                    <div className="flex justify-between items-center mt-2">
                                        <input
                                            type="file"
                                            className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                                            onChange={e => { setActiveQuery(query.id); setReplyFile(e.target.files?.[0] || null); }}
                                        />
                                        <button
                                            type="submit"
                                            disabled={submitting && activeQuery === query.id}
                                            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <Send size={16} /> {submitting && activeQuery === query.id ? 'Sending...' : 'Send Response'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                        {(query.status !== 'OPEN' || query.response) && (
                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                    <CheckCircle size={16} /> Response Submitted. Status: {query.status}
                                </div>
                                {/* Show issuer signature on CLOSED / RESOLVED queries */}
                                {(query.status === 'CLOSED' || query.status === 'RESOLVED') && query.issuedBy?.staffProfile?.signatureUrl && (
                                    <div className="flex flex-col items-end gap-1 border border-slate-200 bg-white p-2.5 rounded-xl shadow-sm">
                                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wide">Resolved &amp; signed by:</span>
                                        <span className="text-[10px] text-gray-700 font-extrabold">{query.issuedBy.name}</span>
                                        <img
                                            src={getImageUrl(query.issuedBy.staffProfile.signatureUrl)}
                                            alt="Signature"
                                            className="max-h-[28px] object-contain border bg-white rounded p-0.5"
                                        />
                                        <span className="text-[9px] text-gray-400">
                                            {query.updatedAt ? new Date(query.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {queries.length === 0 && (
                    <div className="text-center py-10 bg-white rounded-lg border border-gray-200">
                        <CheckCircle className="mx-auto text-green-500 mb-2" size={32} />
                        <h3 className="text-lg font-medium text-gray-900">Good Standing</h3>
                        <p className="text-gray-500">You have no pending queries.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
