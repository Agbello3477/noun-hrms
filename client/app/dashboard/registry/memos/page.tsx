'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { Mail, Plus, CheckCircle, Eye, X, Loader2, Calendar, User, MessageSquare, ChevronRight, Paperclip, Download } from 'lucide-react';
import RichTextEditor from '../../../../components/dashboard/RichTextEditor';

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

export default function RegistryMemosPage() {
    const [memos, setMemos] = useState<Memo[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMemo, setViewMemo] = useState<Memo | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showModal, setShowModal] = useState(false);

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
            const res = await api.get('/api/staff');
            setStaffList(res.data);
        } catch (error) {
            console.error('Error fetching staff directory:', error);
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

            // Refresh memos
            await fetchMemos();
            alert(recipientType === 'selected' ? `Memo sent successfully to ${selectedRecipientIds.length} staff member(s)` : 'Memo Broadcasted Successfully to all staff');
        } catch (error: any) {
            console.error(error);
            setErrorMessage(error.response?.data?.message || 'Failed to send memo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewClick = (memo: Memo) => {
        setViewMemo(memo);
        fetchMemoDetails(memo.id);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-gradient-to-r from-blue-900 to-indigo-900 p-6 rounded-2xl text-white shadow-lg">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">General Memos</h1>
                    <p className="text-blue-100 text-sm mt-1">Broadcast official notices and collect feedback from all staff members.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-500 transition shadow-md hover:scale-105 active:scale-95 duration-150"
                >
                    <Plus size={20} /> New Memo
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Memo details</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Broadcast Date</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sender</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Feedback Type</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Responses</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="text-center py-12">
                                    <div className="flex flex-col items-center gap-2 text-gray-500">
                                        <Loader2 className="animate-spin text-blue-600" size={32} />
                                        <span>Loading memos...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : memos.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-12 text-gray-400">
                                    <Mail className="mx-auto text-gray-300 mb-3" size={48} />
                                    <p className="text-lg font-medium">No memos broadcasted yet</p>
                                    <p className="text-sm">Click "New Memo" to create and broadcast your first general announcement.</p>
                                </td>
                            </tr>
                        ) : Array.isArray(memos) && memos.map((memo, index) => {
                            if (!memo) return null;
                            return (
                                <tr key={memo.id || index} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-gray-900 line-clamp-1">{memo.title}</span>
                                            {memo.recipient ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                    Direct Memo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                    Broadcast
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                                            {memo.recipient ? `To: ${memo.recipient.name || 'Unknown Staff'} (${memo.recipient.staffProfile?.staffId || 'No ID'})` : 'To: All Staff'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                        {memo.createdAt ? new Date(memo.createdAt).toLocaleDateString(undefined, {
                                            year: 'numeric', month: 'short', day: 'numeric'
                                        }) : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {memo.sender?.name || 'Registry Office'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            memo.allowResponses 
                                                ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                                                : 'bg-gray-50 text-gray-600 border border-gray-150'
                                        }`}>
                                            {memo.allowResponses ? 'Requires Response' : 'Broadcast Only'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
                                        {memo.allowResponses ? (
                                            <span className="flex items-center gap-1 text-indigo-600">
                                                <MessageSquare size={14} />
                                                {memo._count?.responses ?? 0} response(s)
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 italic font-normal">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleViewClick(memo)}
                                            className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1 hover:underline"
                                        >
                                            <Eye size={16} /> View Details
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* View Memo Details Modal */}
            {viewMemo && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{viewMemo.title}</h3>
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                                    <span className="flex items-center gap-1"><User size={13} /> {viewMemo.sender?.name || 'Registry Office'}</span>
                                    <span className="flex items-center gap-1"><Calendar size={13} /> {viewMemo.createdAt ? new Date(viewMemo.createdAt).toLocaleString() : 'N/A'}</span>
                                </p>
                            </div>
                            <button onClick={() => setViewMemo(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition">
                                <X size={22} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100/50">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Memo Message</h4>
                                    {viewMemo.recipient ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                            Direct Memo to: {viewMemo.recipient.name || 'Unknown Staff'} ({viewMemo.recipient.staffProfile?.staffId || 'N/A'})
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                            Broadcast to All Staff
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-gray-800 leading-relaxed">
                                    <div dangerouslySetInnerHTML={{ __html: viewMemo.content }} className="prose max-w-none text-black" />
                                </div>
                            </div>

                            {/* Attachment Section */}
                            {viewMemo.attachmentUrl && (
                                <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <Paperclip size={16} className="text-gray-500" />
                                        <span className="text-sm font-semibold text-gray-700">{viewMemo.attachmentName || 'attachment'}</span>
                                    </div>
                                    <a
                                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5055'}${viewMemo.attachmentUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs px-3.5 py-1.5 rounded-lg font-bold border border-blue-150 transition flex items-center gap-1.5"
                                    >
                                        <Download size={13} /> View / Download
                                    </a>
                                </div>
                            )}

                            {/* Responses Area */}
                            {viewMemo.allowResponses && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                        <MessageSquare size={16} className="text-indigo-600" />
                                        Staff Feedback & Responses ({viewMemo.responses?.length || 0})
                                    </h4>

                                    {!viewMemo.responses ? (
                                        <div className="flex items-center gap-2 text-gray-500 py-4 justify-center">
                                            <Loader2 className="animate-spin text-blue-600" size={20} />
                                            <span>Loading responses...</span>
                                        </div>
                                    ) : viewMemo.responses.length === 0 ? (
                                        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400">
                                            No staff members have responded to this memo yet.
                                        </div>
                                    ) : (
                                        <div className="border border-gray-150 rounded-xl overflow-hidden shadow-sm">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff Details</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit / Cadet</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Response Content</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {Array.isArray(viewMemo.responses) && viewMemo.responses.map(resp => (
                                                        <tr key={resp.id} className="hover:bg-gray-50/35 transition">
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                <div className="text-sm font-medium text-gray-900">{resp.staff?.name || 'Unknown Staff'}</div>
                                                                <div className="text-xs text-gray-500">ID: {resp.staff?.staffProfile?.staffId || 'N/A'}</div>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                                                                <div className="font-semibold text-gray-700">{resp.staff?.staffProfile?.unit?.name || 'General Registry'}</div>
                                                                <div>Cadre: {resp.staff?.staffProfile?.cadre || 'N/A'} (Lvl {resp.staff?.staffProfile?.level || 'N/A'}/{resp.staff?.staffProfile?.step || 'N/A'})</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap max-w-md">
                                                                {resp.content}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                                                {resp.createdAt ? new Date(resp.createdAt).toLocaleString(undefined, {
                                                                    dateStyle: 'short', timeStyle: 'short'
                                                                }) : 'N/A'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setViewMemo(null)}
                                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-sm font-semibold transition"
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
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-slideUp">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Mail className="text-blue-600" size={20} />
                                Create Official Memo
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateMemo} className="p-6 space-y-4">
                            {errorMessage && (
                                <div className="p-3 bg-red-50 text-red-700 border border-red-100 text-sm rounded-lg">
                                    {errorMessage}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Recipient Type</label>
                                <div className="flex gap-4 p-1">
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
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
                                        Broadcast to All Staff
                                    </label>
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
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
                                    <label className="block text-sm font-semibold text-gray-700">Select Staff Members</label>
                                    <input
                                        type="text"
                                        placeholder="Search staff by name, email, or ID..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                                    />
                                    
                                    {(() => {
                                        const filteredStaff = Array.isArray(staffList) ? staffList.filter(staff => {
                                            if (!staff) return false;
                                            const name = (staff.name || '').toLowerCase();
                                            const surname = (staff.staffProfile?.surname || '').toLowerCase();
                                            const otherNames = (staff.staffProfile?.otherNames || '').toLowerCase();
                                            const email = (staff.email || '').toLowerCase();
                                            const staffId = (staff.staffProfile?.staffId || '').toLowerCase();
                                            const query = searchQuery.toLowerCase();
                                            return name.includes(query) || 
                                                   surname.includes(query) || 
                                                   otherNames.includes(query) || 
                                                   email.includes(query) || 
                                                   staffId.includes(query);
                                        }) : [];

                                        return (
                                            <>
                                                <div className="flex gap-2 text-xs font-semibold">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const visibleIds = filteredStaff.map(s => s.id);
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
                                                            const staffId = staff.staffProfile?.staffId ? ` (${staff.staffProfile.staffId})` : '';
                                                            const unit = staff.staffProfile?.unit?.name ? ` - ${staff.staffProfile.unit.name}` : '';
                                                            const isChecked = selectedRecipientIds.includes(staff.id);
                                                            return (
                                                                <label
                                                                    key={staff.id}
                                                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-100 cursor-pointer transition select-none text-xs font-medium text-gray-700"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => {
                                                                            if (isChecked) {
                                                                                setSelectedRecipientIds(prev => prev.filter(id => id !== staff.id));
                                                                            } else {
                                                                                setSelectedRecipientIds(prev => [...prev, staff.id]);
                                                                            }
                                                                        }}
                                                                        className="h-4 w-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                                    />
                                                                    <div className="flex-1">
                                                                        <span className="font-semibold text-gray-900">{staff.name || staff.email}</span>
                                                                        <span className="text-[10px] text-gray-400 block mt-0.5">{staff.email} {staffId} {unit}</span>
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
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Memo Title / Subject</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. End of Year Appraisal Submissions Deadline"
                                    className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Memo Content</label>
                                <RichTextEditor
                                    value={content}
                                    onChange={setContent}
                                    placeholder="Write your official announcement details here..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                                    <Paperclip size={14} className="text-gray-500" />
                                    Attachment (Optional)
                                </label>
                                <input
                                    type="file"
                                    onChange={e => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            setAttachmentFile(e.target.files[0]);
                                        } else {
                                            setAttachmentFile(null);
                                        }
                                    }}
                                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 file:cursor-pointer hover:file:bg-blue-100 border border-gray-300 rounded-xl p-2 outline-none"
                                />
                            </div>

                            <div className="flex items-center gap-2 py-2">
                                <input
                                    type="checkbox"
                                    id="allowResponses"
                                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                    checked={allowResponses}
                                    onChange={e => setAllowResponses(e.target.checked)}
                                />
                                <label htmlFor="allowResponses" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                                    Allow staff feedback/responses to this memo
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2.5 border border-gray-250 rounded-xl hover:bg-gray-50 text-sm font-semibold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="animate-spin" size={16} />
                                            Sending...
                                        </>
                                    ) : (
                                        recipientType === 'selected' ? 'Send Memo' : 'Broadcast Memo'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
