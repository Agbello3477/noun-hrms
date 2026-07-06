import { useEffect, useState, Suspense, useMemo } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import api from '../../../../lib/api';
import { Mail, Plus, CheckCircle, Eye, X, Loader2, Calendar, User, MessageSquare, ChevronRight, Paperclip, Download } from 'lucide-react';
import RichTextEditor from '../../../../components/dashboard/RichTextEditor';
import Pagination from '../../../../components/ui/Pagination';

interface MemoResponse {
    id: string;
    content: string;
    createdAt: string;
    staff: {
        name: string;
        email: string;
        staffProfile?: {
            staffId: string;
            level: number;
            step: number;
            cadre: string;
            unit?: {
                name: string;
            };
        };
    };
}

interface Memo {
    id: string;
    title: string;
    content: string;
    allowResponses: boolean;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    createdAt: string;
    senderId: string;
    sender: {
        name: string;
        email: string;
    };
    recipientId?: string | null;
    recipient?: {
        name: string;
        email: string;
        staffProfile?: {
            staffId: string;
        };
    } | null;
    _count?: {
        responses: number;
    };
    responses?: MemoResponse[];
}

function UnitMemosContent() {
    const { user: currentUser } = useAuth();
    const currentUserId = currentUser?.id;

    const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
    const [memos, setMemos] = useState<Memo[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMemo, setViewMemo] = useState<Memo | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Form states
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [allowResponses, setAllowResponses] = useState(true);
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [recipientType, setRecipientType] = useState<'broadcast' | 'selected'>('broadcast');
    const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [staffList, setStaffList] = useState<any[]>([]);
    const [errorMessage, setErrorMessage] = useState('');

    // Response states (replying to received memos)
    const [replyContent, setReplyContent] = useState('');
    const [isReplying, setIsReplying] = useState(false);

    const fetchMemos = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/memos');
            setMemos(res.data);
        } catch (error) {
            console.error('Error fetching memos:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStaff = async () => {
        try {
            const res = await api.get('/api/staff/unit');
            setStaffList(res.data);
        } catch (error) {
            console.error('Error fetching unit staff directory:', error);
        }
    };

    const fetchMemoDetails = async (id: string) => {
        try {
            const res = await api.get(`/api/memos/${id}`);
            setViewMemo(res.data);
        } catch (error) {
            console.error('Error fetching memo details:', error);
            alert('Failed to load memo details.');
        }
    };

    useEffect(() => {
        fetchMemos();
        fetchStaff();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, memos]);

    const handleCreateMemo = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMessage('');

        if (recipientType === 'selected' && selectedRecipientIds.length === 0) {
            setErrorMessage('Please select at least one recipient staff member');
            setIsSubmitting(false);
            return;
        }

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('content', content);
            formData.append('allowResponses', String(allowResponses));
            if (recipientType === 'selected') {
                formData.append('recipientIds', JSON.stringify(selectedRecipientIds));
            }
            if (attachmentFile) {
                formData.append('file', attachmentFile);
            }

            await api.post('/api/memos', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setShowModal(false);
            setTitle('');
            setContent('');
            setAllowResponses(true);
            setAttachmentFile(null);
            setRecipientType('broadcast');
            setSelectedRecipientIds([]);
            setSearchQuery('');
            fetchMemos();
        } catch (error: any) {
            console.error('Error creating memo:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to dispatch memo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendResponse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!viewMemo || !replyContent.trim()) return;

        setIsReplying(true);
        try {
            await api.post(`/api/memos/${viewMemo.id}/respond`, { content: replyContent });
            setReplyContent('');
            fetchMemoDetails(viewMemo.id);
            fetchMemos();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to submit response');
        } finally {
            setIsReplying(false);
        }
    };

    const filteredMemos = memos.filter(m => {
        if (activeTab === 'sent') {
            return m.senderId === currentUserId;
        } else {
            return m.senderId !== currentUserId;
        }
    });

    const paginatedMemos = useMemo(() => {
        return filteredMemos.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    }, [filteredMemos, currentPage, pageSize]);

    const totalPages = Math.max(1, Math.ceil(filteredMemos.length / pageSize));

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Unit Memos</h1>
                    <p className="text-sm text-gray-500 mt-1">Send and manage official memos scoped within your unit</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                    <Plus size={16} />
                    Create Memo
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('inbox')}
                    className={`px-5 py-3 text-xs font-bold border-b-2 transition-colors ${
                        activeTab === 'inbox'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Inbox Memos
                </button>
                <button
                    onClick={() => setActiveTab('sent')}
                    className={`px-5 py-3 text-xs font-bold border-b-2 transition-colors ${
                        activeTab === 'sent'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Sent Memos
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading memos...</div>
            ) : filteredMemos.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                    <Mail className="mx-auto text-gray-400 mb-3" size={36} />
                    <p className="text-gray-500 font-medium">No memos found</p>
                    <p className="text-xs text-gray-400 mt-1">Memos relating to your unit will appear here.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        {activeTab === 'sent' ? 'Recipient' : 'Sender'}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                    {activeTab === 'sent' && (
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Responses</th>
                                    )}
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {paginatedMemos.map(memo => (
                                    <tr key={memo.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                                {memo.title}
                                                {memo.attachmentUrl && <Paperclip size={12} className="text-gray-400" />}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate max-w-xs mt-0.5" dangerouslySetInnerHTML={{ __html: memo.content.replace(/<[^>]*>/g, '').substring(0, 50) + '...' }} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {activeTab === 'sent' ? (
                                                memo.recipient ? (
                                                    <div>
                                                        <span className="font-semibold">{memo.recipient.name}</span>
                                                        <span className="text-xs text-gray-400 block">{memo.recipient.email}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 italic">Broadcast to Unit</span>
                                                )
                                            ) : (
                                                <div>
                                                    <span className="font-semibold">{memo.sender?.name}</span>
                                                    <span className="text-xs text-gray-400 block">{memo.sender?.email}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(memo.createdAt).toLocaleDateString()}
                                        </td>
                                        {activeTab === 'sent' && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {memo.allowResponses ? (
                                                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-semibold flex items-center gap-1 w-fit">
                                                        <MessageSquare size={12} />
                                                        {memo._count?.responses || 0} responses
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">Disabled</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => fetchMemoDetails(memo.id)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-all shadow-sm"
                                            >
                                                <Eye size={12} />
                                                <span>View</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {!loading && filteredMemos.length > 0 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredMemos.length}
                            pageSize={pageSize}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                        />
                    )}
                </div>
            )}

            {/* View Memo Details Modal */}
            {viewMemo && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-slideUp">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">{viewMemo.title}</h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    Posted on {new Date(viewMemo.createdAt).toLocaleDateString()} by {viewMemo.sender?.name}
                                </p>
                            </div>
                            <button onClick={() => setViewMemo(null)} className="text-gray-400 hover:text-gray-650 p-1 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {/* Content */}
                            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                                <div dangerouslySetInnerHTML={{ __html: viewMemo.content }} className="prose max-w-none text-sm text-gray-800 leading-relaxed" />
                                
                                {viewMemo.attachmentUrl && (
                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-150 shadow-sm">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                                                <Paperclip size={14} className="text-blue-500" />
                                                <span>{viewMemo.attachmentName || 'Attachment'}</span>
                                            </div>
                                            <a
                                                href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5055'}${viewMemo.attachmentUrl}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                                            >
                                                <Download size={12} />
                                                Download
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Responses Block */}
                            {viewMemo.senderId === currentUserId ? (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b pb-2">Staff Feedbacks / Responses</h4>
                                    {!viewMemo.responses || viewMemo.responses.length === 0 ? (
                                        <p className="text-center text-xs text-gray-400 py-6 italic bg-gray-50 rounded-xl border">No responses submitted yet.</p>
                                    ) : (
                                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Staff</th>
                                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Unit/Placement</th>
                                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Response</th>
                                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {viewMemo.responses.map(resp => (
                                                        <tr key={resp.id} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                <div className="text-xs font-bold text-gray-800">{resp.staff?.name}</div>
                                                                <div className="text-[10px] text-gray-400">ID: {resp.staff?.staffProfile?.staffId || 'N/A'}</div>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                                                <div>{resp.staff?.staffProfile?.unit?.name || 'My Unit'}</div>
                                                                <div className="text-[10px] text-gray-450">{resp.staff?.staffProfile?.cadre} (Lvl {resp.staff?.staffProfile?.level})</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-xs text-gray-750 whitespace-pre-wrap max-w-xs">
                                                                {resp.content}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">
                                                                {new Date(resp.createdAt).toLocaleDateString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Reply Form for Received Memos */
                                viewMemo.allowResponses && (
                                    <div className="space-y-4 border-t pt-4">
                                        <h4 className="text-sm font-bold text-gray-700">Submit Your Response</h4>
                                        {/* @ts-ignore */}
                                        {viewMemo.myResponse ? (
                                            <div className="bg-blue-50 border border-blue-150 p-4 rounded-xl">
                                                <span className="text-xs text-blue-500 block font-semibold mb-1">Your response:</span>
                                                {/* @ts-ignore */}
                                                <p className="text-xs text-blue-900 whitespace-pre-wrap">{viewMemo.myResponse.content}</p>
                                            </div>
                                        ) : (
                                            <form onSubmit={handleSendResponse} className="space-y-3">
                                                <textarea
                                                    rows={3}
                                                    required
                                                    placeholder="Type your official feedback response here..."
                                                    value={replyContent}
                                                    onChange={e => setReplyContent(e.target.value)}
                                                    className="w-full border border-gray-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={isReplying || !replyContent.trim()}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-colors"
                                                >
                                                    {isReplying && <Loader2 size={12} className="animate-spin" />}
                                                    Submit Response
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                )
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end flex-shrink-0">
                            <button
                                onClick={() => setViewMemo(null)}
                                className="px-5 py-2.5 bg-gray-250 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors shadow-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Memo Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-slideUp">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Mail className="text-blue-600" size={20} />
                                Create Unit Memo
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-650 p-1 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateMemo} className="overflow-y-auto p-6 space-y-4 flex-1">
                            {errorMessage && (
                                <div className="p-3 bg-red-50 text-red-700 border border-red-100 text-sm rounded-lg">
                                    {errorMessage}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Recipient Type</label>
                                <div className="flex gap-4 p-1">
                                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="recipientType"
                                            value="broadcast"
                                            checked={recipientType === 'broadcast'}
                                            onChange={() => {
                                                setRecipientType('broadcast');
                                                setSelectedRecipientIds([]);
                                                setSearchQuery('');
                                            }}
                                            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                                        />
                                        Broadcast to All Unit Staff
                                    </label>
                                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="recipientType"
                                            value="selected"
                                            checked={recipientType === 'selected'}
                                            onChange={() => setRecipientType('selected')}
                                            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                                        />
                                        Send to Selected Staff
                                    </label>
                                </div>
                            </div>

                            {recipientType === 'selected' && (
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">Select Staff Members</label>
                                    <input
                                        type="text"
                                        placeholder="Search staff by name, email, or ID..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                                    />
                                    
                                    {(() => {
                                        const filteredStaff = Array.isArray(staffList) ? staffList.filter(staff => {
                                            if (!staff) return false;
                                            // Handle different staff list formats
                                            const u = staff.user || staff;
                                            const profile = staff.staffProfile || staff;
                                            const name = (u.name || '').toLowerCase();
                                            const surname = (profile.surname || '').toLowerCase();
                                            const otherNames = (profile.otherNames || '').toLowerCase();
                                            const email = (u.email || '').toLowerCase();
                                            const staffId = (profile.staffId || '').toLowerCase();
                                            const query = searchQuery.toLowerCase();
                                            return name.includes(query) || 
                                                   surname.includes(query) || 
                                                   otherNames.includes(query) || 
                                                   email.includes(query) || 
                                                   staffId.includes(query);
                                        }) : [];

                                        return (
                                            <>
                                                <div className="flex gap-2 text-xs font-bold">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const visibleIds = filteredStaff.map(s => s.user?.id || s.id);
                                                            setSelectedRecipientIds(prev => Array.from(new Set([...prev, ...visibleIds])));
                                                        }}
                                                        className="px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-150 rounded-lg hover:bg-blue-100 transition"
                                                    >
                                                        Select All Visible
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedRecipientIds([])}
                                                        className="px-2.5 py-1 bg-gray-50 text-gray-600 border border-gray-155 rounded-lg hover:bg-gray-100 transition"
                                                    >
                                                        Clear Selection
                                                    </button>
                                                    <span className="ml-auto text-gray-500 self-center">
                                                        Selected: {selectedRecipientIds.length} staff
                                                    </span>
                                                </div>

                                                <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-100 p-2 space-y-1 bg-gray-50/30">
                                                    {filteredStaff.length === 0 ? (
                                                        <div className="text-center py-6 text-xs text-gray-400">
                                                            No matching staff members found
                                                        </div>
                                                    ) : (
                                                        filteredStaff.map(staff => {
                                                            const u = staff.user || staff;
                                                            const profile = staff.staffProfile || staff;
                                                            const identifier = u.id || staff.id;
                                                            return (
                                                                <label key={identifier} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedRecipientIds.includes(identifier)}
                                                                        onChange={e => {
                                                                            if (e.target.checked) {
                                                                                setSelectedRecipientIds(prev => [...prev, identifier]);
                                                                            } else {
                                                                                setSelectedRecipientIds(prev => prev.filter(id => id !== identifier));
                                                                            }
                                                                        }}
                                                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                                                    />
                                                                    <div className="text-xs">
                                                                        <div className="font-semibold text-gray-700">{u.name}</div>
                                                                        <div className="text-[10px] text-gray-400">
                                                                            {u.email} {profile.staffId ? `| ID: ${profile.staffId}` : ''}
                                                                        </div>
                                                                    </div>
                                                                </label>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Title / Subject</label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Enter memo title..."
                                    className="w-full border border-gray-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Content</label>
                                <RichTextEditor
                                    value={content}
                                    onChange={setContent}
                                    placeholder="Type memo content here..."
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 p-1">
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={allowResponses}
                                        onChange={e => setAllowResponses(e.target.checked)}
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                    />
                                    Allow staff feedback/responses to this memo
                                </label>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">File Attachment (Optional)</label>
                                <input
                                    type="file"
                                    onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
                                    className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer transition-all border border-gray-250 p-2.5 rounded-xl bg-gray-50/20"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !title || !content}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-colors"
                                >
                                    {isSubmitting && <Loader2 size={12} className="animate-spin" />}
                                    Dispatch Memo
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function UnitMemosPage() {
    return (
        <Suspense fallback={
            <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
                <div className="text-gray-500 font-medium">Loading unit memos...</div>
            </div>
        }>
            <UnitMemosContent />
        </Suspense>
    );
}
