'use client';

import { useState } from 'react';
import api from '../../lib/api';
import { X, Upload } from 'lucide-react';
import RichTextEditor from './RichTextEditor';

interface ApplyLeaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ApplyLeaveModal({ isOpen, onClose, onSuccess }: ApplyLeaveModalProps) {
    const [type, setType] = useState('ANNUAL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg({ type: '', text: '' });

        try {
            let documentUrl = '';
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('type', 'OTHER');
                formData.append('title', `${type} Leave Supporting Document`);
                formData.append('accessLevel', 'RESTRICTED');

                const uploadRes = await api.post('/api/documents/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                documentUrl = uploadRes.data.url;
            }

            const finalReason = reason + (documentUrl ? `<br/><br/><a href="${documentUrl}" target="_blank" class="text-blue-600 underline font-semibold">[Attached Supporting Document]</a>` : '');

            await api.post('/api/leaves/apply', {
                type,
                startDate,
                endDate,
                reason: finalReason
            });
            setMsg({ type: 'success', text: 'Leave Request Submitted Successfully' });
            setTimeout(() => {
                onSuccess();
                onClose();
                // Reset form
                setType('ANNUAL');
                setStartDate('');
                setEndDate('');
                setReason('');
                setFile(null);
                setMsg({ type: '', text: '' });
            }, 1500);
        } catch (error: any) {
            setMsg({ type: 'error', text: error.response?.data?.message || 'Submission Failed' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-800">Apply for Leave</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-650 p-1.5 rounded-full hover:bg-gray-150 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                    <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                        {msg.text && (
                            <div className={`p-4 rounded-xl border text-sm font-semibold ${
                                msg.type === 'success' 
                                    ? 'bg-green-50 border-green-200 text-green-700' 
                                    : 'bg-red-50 border-red-200 text-red-700'
                            }`}>
                                {msg.text}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Leave Type</label>
                                <select
                                    className="w-full border border-gray-200 rounded-xl p-2.5 focus:border-blue-500 outline-none transition-colors"
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                >
                                    <option value="ANNUAL">Annual Leave</option>
                                    <option value="CASUAL">Casual Leave</option>
                                    <option value="SICK">Sick Leave</option>
                                    <option value="MATERNITY">Maternity Leave</option>
                                    <option value="STUDY">Study Leave</option>
                                    <option value="SABBATICAL">Sabbatical</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        className="w-full border border-gray-200 rounded-xl p-2.5 focus:border-blue-500 outline-none transition-colors"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        className="w-full border border-gray-200 rounded-xl p-2.5 focus:border-blue-500 outline-none transition-colors"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason</label>
                                <RichTextEditor
                                    value={reason}
                                    onChange={setReason}
                                    placeholder="Brief reason or handover notes..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Supporting Document (Optional / PDF/Docx/Image)</label>
                                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:bg-gray-50 transition-colors">
                                    <input
                                        type="file"
                                        id="supporting-file-upload"
                                        className="hidden"
                                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                                        accept=".pdf,.doc,.docx,image/*"
                                    />
                                    <label htmlFor="supporting-file-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
                                        <Upload className="text-gray-400" size={24} />
                                        <span className="text-xs text-gray-600 font-medium">
                                            {file ? file.name : 'Click to upload supporting document'}
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-750 hover:bg-gray-100 rounded-xl text-xs font-bold shadow-sm transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-sm ${
                                loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {loading ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
