'use client';

import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { FileText, AlertCircle, Upload, CheckCircle, X } from 'lucide-react';
import dynamic from 'next/dynamic';

const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
    ssr: false,
    loading: () => <div className="h-[300px] bg-slate-50 border rounded-xl animate-pulse flex items-center justify-center text-xs text-gray-400 font-medium">Loading editor...</div>
});

interface ApplySabbaticalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ApplySabbaticalModal({ isOpen, onClose, onSuccess }: ApplySabbaticalModalProps) {
    const [eligibility, setEligibility] = useState<{ eligible: boolean; yearsServed: number; message: string } | null>(null);
    const [loading, setLoading] = useState(true);

    // Form State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        const checkEligibility = async () => {
            setLoading(true);
            try {
                const { data } = await api.get('/api/academic/sabbatical/eligibility');
                setEligibility(data);
            } catch (err) {
                console.error('Eligibility check failed', err);
            } finally {
                setLoading(false);
            }
        };
        checkEligibility();
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            if (!file) {
                setError('Please upload your Research Plan document.');
                setSubmitting(false);
                return;
            }

            // 1. Upload Document first (using our Document API)
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'OTHER');
            formData.append('title', 'Sabbatical Research Plan');
            formData.append('accessLevel', 'RESTRICTED');

            const uploadRes = await api.post('/api/documents/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const documentUrl = uploadRes.data.url;

            // 2. Submit Leave Request (saving with raw HTML format link)
            await api.post('/api/leaves/apply', {
                type: 'SABBATICAL',
                startDate,
                endDate,
                reason: reason + `<br/><br/><a href="${documentUrl}" target="_blank" class="text-blue-600 underline font-semibold">[Attached Research Plan]</a>`
            });

            onSuccess();
            onClose();
            // Reset form states
            setStartDate('');
            setEndDate('');
            setReason('');
            setFile(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to submit application');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText size={20} className="text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-800">Apply for Sabbatical</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-650 p-1.5 rounded-full hover:bg-gray-150 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[75vh]">
                    {loading ? (
                        <div className="py-8 text-center text-gray-500 font-medium">Checking eligibility...</div>
                    ) : !eligibility?.eligible ? (
                        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-4">
                            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-red-700">Not Eligible for Sabbatical</h3>
                                <p className="text-sm text-red-650">{eligibility?.message || 'You do not meet the minimum requirements.'}</p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2 bg-white border border-red-300 rounded-xl text-xs font-bold text-red-700 hover:bg-red-50 transition-colors"
                            >
                                Close Modal
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="bg-green-50 border border-green-150 p-4 rounded-xl flex items-center gap-2.5 text-green-800 text-sm">
                                <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                                <span>You are eligible! Years of Service: <strong>{eligibility.yearsServed} years</strong></span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-700">Start Date</label>
                                    <input type="date" required className="w-full p-2.5 border border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors"
                                        value={startDate} onChange={e => setStartDate(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-700">End Date</label>
                                    <input type="date" required className="w-full p-2.5 border border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-colors"
                                        value={endDate} onChange={e => setEndDate(e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-gray-700">Research Topic / Abstract</label>
                                <RichTextEditor
                                    value={reason}
                                    onChange={setReason}
                                    placeholder="Briefly describe your research goals..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Research Plan (PDF/Docx)</label>
                                <div className="border-2 border-dashed border-gray-350 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
                                    <input
                                        type="file"
                                        id="sabbatical-file-upload"
                                        className="hidden"
                                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                                        accept=".pdf,.doc,.docx"
                                    />
                                    <label htmlFor="sabbatical-file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                        <Upload className="text-gray-400" size={32} />
                                        <span className="text-sm text-gray-600 font-medium">
                                            {file ? file.name : 'Click to upload Research Plan'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {error && <div className="text-red-600 text-sm font-semibold">{error}</div>}

                            {/* Footer inside form */}
                            <div className="border-t pt-4 flex justify-end gap-3 bg-white">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 bg-white border border-gray-300 text-gray-750 hover:bg-gray-100 rounded-xl text-xs font-bold shadow-sm transition-colors"
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-sm ${
                                        submitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                                >
                                    {submitting ? 'Submitting Application...' : 'Submit Sabbatical Request'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
