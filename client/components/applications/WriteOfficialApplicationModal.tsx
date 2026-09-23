'use client';

import { useState, useEffect } from 'react';
import { X, Send, Paperclip, AlertCircle, Building, User, Tag, Clock, FileText, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

interface WriteOfficialApplicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const CATEGORIES = [
    { value: 'GENERAL_REQUEST', label: 'General Administrative Request' },
    { value: 'STAFFING_REQUEST', label: 'Staffing & Manpower Request' },
    { value: 'TRANSFER_REQUEST', label: 'Staff Transfer / Deployment Request' },
    { value: 'FACILITY_RESOURCE', label: 'Facility & Resource Request' },
    { value: 'CONFIRMATION_REQUEST', label: 'Staff Confirmation / Regularization' },
    { value: 'ADMINISTRATIVE_APPROVAL', label: 'Official Administrative Approval' },
    { value: 'EXEMPTION_REQUEST', label: 'Duty Exemption / Official Permission' },
    { value: 'OFFICIAL_MEMO_LETTER', label: 'Official Directorate Memo / Letter' },
    { value: 'OTHER', label: 'Other Official Application' }
];

const URGENCIES = [
    { value: 'NORMAL', label: 'Normal (Standard Processing)', color: 'border-slate-200 text-slate-700 bg-slate-50' },
    { value: 'URGENT', label: 'Urgent (24-48 Hours)', color: 'border-amber-300 text-amber-800 bg-amber-50' },
    { value: 'HIGH_PRIORITY', label: 'High Priority / Immediate', color: 'border-rose-300 text-rose-800 bg-rose-50' }
];

export default function WriteOfficialApplicationModal({
    isOpen,
    onClose,
    onSuccess
}: WriteOfficialApplicationModalProps) {
    const { user } = useAuth();

    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState('GENERAL_REQUEST');
    const [urgency, setUrgency] = useState('NORMAL');
    const [content, setContent] = useState('');
    const [customUnit, setCustomUnit] = useState('');
    const [customRank, setCustomRank] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            const profile = user.staffProfile;
            const defaultUnit = profile?.unit?.name || profile?.studyCenter?.name || profile?.department || '';
            const defaultRank = profile?.rank || profile?.cadre || user.role;
            setCustomUnit(defaultUnit);
            setCustomRank(defaultRank);

            // Default formal letter template
            if (!content) {
                setContent(
`The Registrar,
National Open University of Nigeria (NOUN),
University Village, Plot 91, Cadastral Zone,
Nnamdi Azikiwe Expressway, Jabi, Abuja.

Through: Head of Unit / Dean / Director

Dear Sir/Madam,

APPLICATION FOR: [SPECIFY PURPOSE HERE]

I write on behalf of the [Directorate / Faculty / Department / Self] to officially apply for...

[Provide specific details, justification, and background here]

Thank you for your anticipated prompt attention and consideration.

Yours faithfully,

${user.name}
${defaultRank}
${defaultUnit}`
                );
            }
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!subject.trim()) {
            setError('Please provide an application subject/title.');
            return;
        }

        if (!content.trim()) {
            setError('Please provide the application letter content.');
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('subject', subject.trim());
            formData.append('category', category);
            formData.append('urgency', urgency);
            formData.append('content', content.trim());
            if (customUnit) formData.append('customUnit', customUnit.trim());
            if (customRank) formData.append('customRank', customRank.trim());
            if (file) {
                formData.append('attachment', file);
            }

            await api.post('/api/official-applications', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setSuccessMessage('Official application submitted successfully to Central Registry!');
            setTimeout(() => {
                setSuccessMessage('');
                onClose();
                if (onSuccess) onSuccess();
            }, 1200);
        } catch (err: any) {
            console.error('Failed to submit application:', err);
            setError(err.response?.data?.message || 'Failed to submit official application. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-[#006533] to-emerald-800 px-6 py-4 text-white flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                Official Letterhead
                            </span>
                            <span className="text-emerald-200 text-xs font-medium">To: HR &amp; Central Registry</span>
                        </div>
                        <h2 className="text-lg font-bold mt-1">Write Official Application to Registry</h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                    {error && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* Origin & Identification Info */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Sender Name &amp; ID
                            </label>
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                <User size={14} className="text-emerald-700" />
                                {user?.name} {user?.staffProfile?.staffId ? `(${user.staffProfile.staffId})` : ''}
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Directorate / Faculty / Department
                            </label>
                            <input
                                type="text"
                                value={customUnit}
                                onChange={(e) => setCustomUnit(e.target.value)}
                                placeholder="e.g. Directorate of Academic Planning"
                                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006533]"
                            />
                        </div>
                    </div>

                    {/* Category & Urgency */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <Tag size={13} className="text-[#006533]" /> Application Category *
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006533]"
                            >
                                {CATEGORIES.map((cat) => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <Clock size={13} className="text-[#006533]" /> Priority / Urgency *
                            </label>
                            <select
                                value={urgency}
                                onChange={(e) => setUrgency(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006533]"
                            >
                                {URGENCIES.map((u) => (
                                    <option key={u.value} value={u.value}>{u.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Subject */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                            <FileText size={13} className="text-[#006533]" /> Subject / Title of Application *
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="e.g. Request for Additional Academic Support Personnel for 2026/2027 Academic Session"
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006533]"
                            required
                        />
                    </div>

                    {/* Official Letter Body */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-slate-700">
                                Formal Letter Content *
                            </label>
                            <span className="text-[11px] text-slate-400">Formal NOUN Registry format</span>
                        </div>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={10}
                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-mono text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#006533]"
                            placeholder="Type your official letter here..."
                            required
                        />
                    </div>

                    {/* Attachment Upload */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                            <Paperclip size={13} className="text-[#006533]" /> Supporting Document / Attachment (Optional)
                        </label>
                        <div className="border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 transition flex items-center justify-between">
                            <input
                                type="file"
                                accept=".pdf,.doc,.docx,image/*"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 cursor-pointer"
                            />
                            {file && (
                                <button
                                    type="button"
                                    onClick={() => setFile(null)}
                                    className="text-xs text-rose-600 hover:text-rose-800 font-bold"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Accepted: PDF, Word Documents (.doc, .docx), Images up to 10MB.</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 text-xs font-bold text-white bg-[#006533] hover:bg-[#005028] rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
                        >
                            <Send size={14} />
                            {submitting ? 'Submitting to Registry...' : 'Submit Application to Registry'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
