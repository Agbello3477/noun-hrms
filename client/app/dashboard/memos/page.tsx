'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api, { getImageUrl } from '../../../lib/api';
import { Mail, Calendar, User, MessageSquare, Send, CheckCircle, Loader2, Info, Paperclip, Download } from 'lucide-react';

interface Memo {
    id: string;
    title: string;
    content: string;
    allowResponses: boolean;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    createdAt: string;
    sender: {
        name: string;
        email: string;
        role?: string;
        staffProfile?: {
            signatureUrl?: string | null;
        } | null;
    };
    recipientId?: string | null;
    recipient?: {
        name: string;
        email: string;
        staffProfile?: {
            staffId: string;
        };
    } | null;
    myResponse?: {
        id: string;
        content: string;
        createdAt: string;
    } | null;
}

function MemosContent() {
    const searchParams = useSearchParams();
    const memoIdParam = searchParams.get('id');

    const [memos, setMemos] = useState<Memo[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
    const [responseContent, setResponseContent] = useState('');
    const [submittingResponse, setSubmittingResponse] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const fetchMemos = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/memos');
            setMemos(res.data);

            // Determine initial memo to select
            if (res.data.length > 0) {
                const initialId = memoIdParam || res.data[0].id;
                const found = res.data.find((m: Memo) => m.id === initialId);
                if (found) {
                    fetchMemoDetails(found.id);
                } else {
                    fetchMemoDetails(res.data[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching memos:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMemoDetails = async (id: string) => {
        try {
            const res = await api.get(`/api/memos/${id}`);
            setSelectedMemo(res.data);
            setResponseContent('');
            setSubmitSuccess(false);
            setSubmitError('');
        } catch (error) {
            console.error('Error fetching memo details:', error);
        }
    };

    useEffect(() => {
        fetchMemos();
    }, [memoIdParam]);

    const handleSelectMemo = (id: string) => {
        fetchMemoDetails(id);
    };

    const handleResponseSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMemo || !responseContent.trim()) return;

        setSubmittingResponse(true);
        setSubmitError('');
        setSubmitSuccess(false);

        try {
            const res = await api.post(`/api/memos/${selectedMemo.id}/respond`, {
                content: responseContent
            });

            // Update state
            setSelectedMemo({
                ...selectedMemo,
                myResponse: res.data
            });
            setSubmitSuccess(true);
            setResponseContent('');

            // Also update main list count / local copies if needed
            fetchMemos();
        } catch (error: any) {
            console.error('Response submit error:', error);
            setSubmitError(error.response?.data?.message || 'Failed to submit response.');
        } finally {
            setSubmittingResponse(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-10rem)] border border-gray-200 rounded-2xl bg-white overflow-hidden shadow-sm">
            {/* Left list pane */}
            <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50/50">
                <div className="p-4 border-b border-gray-200 bg-white">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Mail className="text-blue-600" size={18} />
                        Memos & Memos
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Official communications from Registry</p>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-gray-150">
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="animate-spin text-blue-600" size={24} />
                        </div>
                    ) : memos.length === 0 ? (
                        <div className="p-6 text-center text-gray-400">
                            <Mail className="mx-auto text-gray-300 mb-2" size={32} />
                            <p className="text-sm font-medium">No memos available</p>
                        </div>
                    ) : (
                        memos.map(memo => (
                            <button
                                key={memo.id}
                                onClick={() => handleSelectMemo(memo.id)}
                                className={`w-full text-left p-4 hover:bg-gray-50 transition-colors flex flex-col gap-1.5 ${
                                    selectedMemo?.id === memo.id ? 'bg-blue-50/70 border-l-4 border-blue-600' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between gap-1.5 w-full">
                                    <div className="font-semibold text-sm text-gray-900 line-clamp-1 flex-1">
                                        {memo.title}
                                    </div>
                                    {memo.recipientId ? (
                                        <span className="shrink-0 bg-indigo-50 text-indigo-705 border border-indigo-100 text-[10px] px-1.5 py-0.5 rounded font-semibold">
                                            Direct
                                        </span>
                                    ) : (
                                        <span className="shrink-0 bg-emerald-50 text-emerald-705 border border-emerald-100 text-[10px] px-1.5 py-0.5 rounded font-semibold">
                                            General
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                    {memo.content.replace(/<[^>]*>/g, '')}
                                </div>
                                <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
                                    <span>{new Date(memo.createdAt).toLocaleDateString()}</span>
                                    {memo.allowResponses && (
                                        <span className="bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded font-medium">
                                            Feedback
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Right details pane */}
            <div className="flex-1 flex flex-col overflow-y-auto bg-white">
                {selectedMemo ? (
                    <div className="p-8 flex-1 flex flex-col space-y-6">
                        <div className="border-b border-gray-150 pb-5">
                            <div className="flex items-start justify-between gap-4">
                                <h1 className="text-2xl font-bold text-gray-900 leading-tight flex-1">
                                    {selectedMemo.title}
                                </h1>
                                {selectedMemo.recipientId ? (
                                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-150 text-xs px-2.5 py-1 rounded-full font-semibold shrink-0">
                                        Direct Memo
                                    </span>
                                ) : (
                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-150 text-xs px-2.5 py-1 rounded-full font-semibold shrink-0">
                                        General Broadcast
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                                <span className="flex items-center gap-1.5">
                                    <User size={14} className="text-gray-400" />
                                    From: <span className="font-semibold text-gray-700">{selectedMemo.sender?.name || 'Registry Office'}</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Calendar size={14} className="text-gray-400" />
                                    Date: <span className="font-semibold text-gray-700">{new Date(selectedMemo.createdAt).toLocaleString()}</span>
                                </span>
                            </div>
                        </div>

                        {/* Content Card */}
                        <div className="flex-1 bg-gray-50/50 p-6 rounded-2xl border border-gray-150 leading-relaxed text-gray-800 text-sm flex flex-col justify-between min-h-[180px]">
                            <div dangerouslySetInnerHTML={{ __html: selectedMemo.content }} className="prose max-w-none text-black flex-1" />
                            {selectedMemo.sender?.staffProfile?.signatureUrl && (
                                <div className="mt-8 pt-4 border-t border-gray-200/60 flex items-center justify-between">
                                    <div className="text-[10px] text-gray-400 font-medium">Verified Directive</div>
                                    <div className="text-right space-y-1.5">
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Authorized Signature</div>
                                        <img 
                                            src={getImageUrl(selectedMemo.sender.staffProfile.signatureUrl)} 
                                            alt="Authorized Signature" 
                                            className="max-h-[45px] object-contain border bg-white rounded p-0.5 ml-auto shadow-sm" 
                                        />
                                        <div className="text-[9px] text-gray-400 font-medium">{new Date(selectedMemo.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Attachment Section */}
                        {selectedMemo.attachmentUrl && (
                            <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-2">
                                    <Paperclip size={16} className="text-gray-500" />
                                    <span className="text-sm font-semibold text-gray-700">{selectedMemo.attachmentName || 'attachment'}</span>
                                </div>
                                <a
                                    href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5055'}${selectedMemo.attachmentUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs px-3.5 py-1.5 rounded-lg font-bold border border-blue-150 transition flex items-center gap-1.5"
                                >
                                    <Download size={13} /> View / Download
                                </a>
                            </div>
                        )}

                        {/* Response Form Section */}
                        {selectedMemo.allowResponses && (
                            <div className="border-t border-gray-150 pt-6">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <MessageSquare size={16} className="text-blue-600" />
                                    Memo Feedback Submission
                                </h3>

                                {selectedMemo.myResponse ? (
                                    <div className="bg-green-50/60 border border-green-150 rounded-xl p-5 space-y-2">
                                        <div className="flex items-center gap-2 text-green-800 font-semibold text-sm">
                                            <CheckCircle size={16} />
                                            Feedback Submitted Successfully
                                        </div>
                                        <p className="text-xs text-green-600">
                                            Submitted on {new Date(selectedMemo.myResponse.createdAt).toLocaleString()}
                                        </p>
                                        <div className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-green-100 shadow-sm whitespace-pre-wrap mt-2">
                                            {selectedMemo.myResponse.content}
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleResponseSubmit} className="space-y-4">
                                        {submitSuccess && (
                                            <div className="p-3 bg-green-50 text-green-700 border border-green-100 rounded-lg text-sm flex items-center gap-2">
                                                <CheckCircle size={16} /> Response submitted successfully!
                                            </div>
                                        )}

                                        {submitError && (
                                            <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-lg text-sm">
                                                {submitError}
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                                Your Response / Acknowledgment
                                            </label>
                                            <textarea
                                                required
                                                rows={4}
                                                placeholder="Draft your acknowledgment or feedback response here..."
                                                className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                                                value={responseContent}
                                                onChange={e => setResponseContent(e.target.value)}
                                            />
                                        </div>

                                        <div className="flex justify-end">
                                            <button
                                                type="submit"
                                                disabled={submittingResponse || !responseContent.trim()}
                                                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition flex items-center gap-2 disabled:opacity-50 shadow-md hover:scale-102 active:scale-98"
                                            >
                                                {submittingResponse ? (
                                                    <>
                                                        <Loader2 className="animate-spin" size={16} />
                                                        Submitting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send size={16} />
                                                        Submit Response
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col justify-center items-center text-gray-400 p-8">
                        <Mail size={48} className="text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium">Select a Memo</h3>
                        <p className="text-sm">Choose a memo from the sidebar list to view its official details.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function MemosPage() {
    return (
        <Suspense fallback={
            <div className="flex h-[calc(100vh-10rem)] justify-center items-center bg-white border rounded-2xl">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        }>
            <MemosContent />
        </Suspense>
    );
}
