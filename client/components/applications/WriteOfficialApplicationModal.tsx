'use client';

import { useState, useEffect } from 'react';
import { 
    X, Send, Paperclip, AlertCircle, Building, User, Tag, Clock, 
    FileText, CheckCircle2, ShieldCheck, ChevronRight, Info
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

interface WriteOfficialApplicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    initialMode?: 'DIRECT_REGISTRY' | 'THROUGH_DIRECTOR';
}

const STATUTORY_CATEGORIES = [
    { value: 'POSTING_REQUEST', label: 'Posting / Transfer Request' },
    { value: 'CONCURRENCE', label: 'Concurrence / Endorsement' },
    { value: 'STUDY_FELLOWSHIP', label: 'Study Fellowship / Training Leave' },
    { value: 'SPECIAL_CLEARANCE', label: 'Special Clearance' },
    { value: 'GENERAL_MEMORANDUM', label: 'General Memorandum' },
    { value: 'ADMINISTRATIVE_APPEAL', label: 'Administrative Appeal' },
    { value: 'GENERAL_REQUEST', label: 'General Administrative Request' },
    { value: 'STAFFING_REQUEST', label: 'Staffing & Manpower Request' },
    { value: 'FACILITY_RESOURCE', label: 'Facility & Resource Request' },
    { value: 'CONFIRMATION_REQUEST', label: 'Staff Confirmation / Regularization' },
    { value: 'EXEMPTION_REQUEST', label: 'Duty Exemption / Official Permission' },
    { value: 'OTHER', label: 'Other Official Application' }
];

const URGENCIES = [
    { value: 'NORMAL', label: 'Normal (Standard Processing)', color: 'border-slate-200 text-slate-700 bg-slate-50' },
    { value: 'URGENT', label: 'Urgent (24-48 Hours)', color: 'border-amber-300 text-amber-800 bg-amber-50' },
    { value: 'HIGH_PRIORITY', label: 'High Priority / Immediate', color: 'border-rose-300 text-rose-800 bg-rose-50' }
];

interface DirectorOption {
    id: string;
    name: string;
    email: string;
    unit?: string;
    department?: string;
}

export default function WriteOfficialApplicationModal({
    isOpen,
    onClose,
    onSuccess,
    initialMode = 'THROUGH_DIRECTOR'
}: WriteOfficialApplicationModalProps) {
    const { user } = useAuth();

    // Routing Mode toggle: 'THROUGH_DIRECTOR' (Statutory) vs 'DIRECT_REGISTRY' (Desk/Stamp)
    const [routingMode, setRoutingMode] = useState<'THROUGH_DIRECTOR' | 'DIRECT_REGISTRY'>(initialMode);
    
    // Directors list for Through Director mode
    const [directors, setDirectors] = useState<DirectorOption[]>([]);
    const [directorId, setDirectorId] = useState('');
    const [loadingDirectors, setLoadingDirectors] = useState(false);

    // Form fields
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState(STATUTORY_CATEGORIES[0].value);
    const [urgency, setUrgency] = useState('NORMAL');
    const [content, setContent] = useState('');
    const [customUnit, setCustomUnit] = useState('');
    const [customRank, setCustomRank] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (isOpen) {
            setRoutingMode(initialMode);
            loadEligibleDirectors();
        }
    }, [isOpen, initialMode]);

    const loadEligibleDirectors = async () => {
        try {
            setLoadingDirectors(true);
            const res = await api.get('/api/v1/applications/eligible-directors');
            if (res.data?.success && res.data.directors) {
                setDirectors(res.data.directors);
                if (res.data.directors.length > 0 && !directorId) {
                    setDirectorId(res.data.directors[0].id);
                }
            }
        } catch (err) {
            console.warn('Could not load directors list:', err);
        } finally {
            setLoadingDirectors(false);
        }
    };

    useEffect(() => {
        if (isOpen && user) {
            const profile = user.staffProfile;
            const defaultUnit = profile?.unit?.name || profile?.studyCenter?.name || profile?.department || '';
            const defaultRank = profile?.rank || profile?.cadre || user.role;
            setCustomUnit(defaultUnit);
            setCustomRank(defaultRank);

            if (!content) {
                if (routingMode === 'THROUGH_DIRECTOR') {
                    setContent(
`The University Registrar,
National Open University of Nigeria (NOUN),
University Village, Plot 91, Cadastral Zone,
Nnamdi Azikiwe Expressway, Jabi, Abuja.

Through: The Director / Head of Unit

Dear Sir/Madam,

APPLICATION FOR: [SPECIFY STATUTORY PURPOSE]

I hereby apply formally through my Directorate/Unit for...

[State detailed institutional justification, official background, and relevant references here]

Thank you for your favorable consideration.

Yours faithfully,

${user.name}
${defaultRank}
${defaultUnit}`
                    );
                } else {
                    setContent(
`The Central Registry,
National Open University of Nigeria (NOUN),
University Village, Plot 91, Cadastral Zone,
Nnamdi Azikiwe Expressway, Jabi, Abuja.

Dear Sir/Madam,

APPLICATION FOR: [SPECIFY PURPOSE HERE]

I write officially to lodge this application with Central Registry...

[Provide specific details, justification, and background here]

Yours faithfully,

${user.name}
${defaultRank}
${defaultUnit}`
                    );
                }
            }
        }
    }, [isOpen, user, routingMode]);

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
            if (routingMode === 'THROUGH_DIRECTOR') {
                // Submit to the Statutory Multi-Tier Institutional Workflow
                const payload: any = {
                    subject: subject.trim(),
                    category,
                    content: content.trim(),
                    attachmentUrls: []
                };

                if (directorId) {
                    payload.directorId = directorId;
                }

                // If file attached, we can upload or submit
                if (file) {
                    const uploadData = new FormData();
                    uploadData.append('file', file);
                    try {
                        const uploadRes = await api.post('/api/upload', uploadData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        if (uploadRes.data?.url) {
                            payload.attachmentUrls = [uploadRes.data.url];
                        }
                    } catch (uploadErr) {
                        console.warn('File upload fallback:', uploadErr);
                    }
                }

                const res = await api.post('/api/v1/applications/submit', payload);
                if (res.data?.success) {
                    setSuccessMessage('Application submitted successfully! It has been routed to your Director for statutory vetting.');
                    setTimeout(() => {
                        setSuccessMessage('');
                        onClose();
                        if (onSuccess) onSuccess();
                    }, 1400);
                } else {
                    setError(res.data?.error || 'Failed to submit application.');
                }
            } else {
                // Submit Direct to Registry (Stamped Docket)
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

                setSuccessMessage('Official application submitted directly to Central Registry!');
                setTimeout(() => {
                    setSuccessMessage('');
                    onClose();
                    if (onSuccess) onSuccess();
                }, 1200);
            }
        } catch (err: any) {
            console.error('Failed to submit application:', err);
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to submit official application. Please try again.');
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
                            <span className="text-emerald-200 text-xs font-medium">National Open University of Nigeria</span>
                        </div>
                        <h2 className="text-lg font-bold mt-1">Write Application</h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Routing Mode Selector Strip */}
                <div className="bg-slate-50 border-b border-slate-200 p-4">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Info size={14} className="text-[#006533]" />
                        Choose Statutory Application Pathway:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setRoutingMode('THROUGH_DIRECTOR');
                                setContent(''); // trigger auto-template refresh
                            }}
                            className={`p-3.5 rounded-xl border text-left transition-all ${
                                routingMode === 'THROUGH_DIRECTOR'
                                    ? 'bg-emerald-50/80 border-[#006533] ring-2 ring-[#006533]/20 shadow-xs'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-bold ${routingMode === 'THROUGH_DIRECTOR' ? 'text-[#006533]' : 'text-slate-800'}`}>
                                    Through Director &rarr; Registrar
                                </span>
                                {routingMode === 'THROUGH_DIRECTOR' && (
                                    <span className="w-2 h-2 rounded-full bg-[#006533]"></span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-500 leading-snug">
                                Recommended for Postings, Study Fellowships, Appeals, and Statutory Approvals requiring Directorate Vetting first.
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setRoutingMode('DIRECT_REGISTRY');
                                setContent(''); // trigger auto-template refresh
                            }}
                            className={`p-3.5 rounded-xl border text-left transition-all ${
                                routingMode === 'DIRECT_REGISTRY'
                                    ? 'bg-emerald-50/80 border-[#006533] ring-2 ring-[#006533]/20 shadow-xs'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-bold ${routingMode === 'DIRECT_REGISTRY' ? 'text-[#006533]' : 'text-slate-800'}`}>
                                    Direct to Central Registry
                                </span>
                                {routingMode === 'DIRECT_REGISTRY' && (
                                    <span className="w-2 h-2 rounded-full bg-[#006533]"></span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-500 leading-snug">
                                Lodge directly into Central Registry inward desk for immediate electronic date-stamping and archiving.
                            </p>
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
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

                    {/* Sender Identity Preview */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Originating Staff
                            </span>
                            <div className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                                <User size={13} className="text-emerald-700" />
                                {user?.name} {user?.staffProfile?.staffId ? `(${user.staffProfile.staffId})` : ''}
                            </div>
                        </div>

                        <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Directorate / Unit
                            </span>
                            <div className="font-semibold text-slate-700 mt-0.5 truncate">
                                {customUnit || 'University Headquarters / Unit'}
                            </div>
                        </div>
                    </div>

                    {/* Through Director Target selector (shown when mode is THROUGH_DIRECTOR) */}
                    {routingMode === 'THROUGH_DIRECTOR' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <ShieldCheck size={13} className="text-[#006533]" />
                                Designated Unit Head / Director *
                            </label>
                            <select
                                value={directorId}
                                onChange={(e) => setDirectorId(e.target.value)}
                                disabled={loadingDirectors}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006533]"
                            >
                                <option value="">-- Automatically Route to my Unit/Department Head --</option>
                                {directors.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name} {d.unit ? `(${d.unit})` : d.department ? `(${d.department})` : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[10px] text-slate-400 mt-1">
                                Your application will land on the Director&apos;s vetting cockpit for recommendation before forward transit to Registry.
                            </p>
                        </div>
                    )}

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
                                {STATUTORY_CATEGORIES.map((cat) => (
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
                            placeholder="e.g. Application for Study Fellowship / Posting Request for 2026/2027 Session"
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
                            <span className="text-[11px] text-slate-400">Formal NOUN Institutional Format</span>
                        </div>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={9}
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
                            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#006533] hover:bg-[#004d26] text-white text-xs font-bold transition shadow-md active:scale-95 disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Routing Application...</span>
                                </>
                            ) : (
                                <>
                                    <Send size={14} />
                                    <span>
                                        {routingMode === 'THROUGH_DIRECTOR' ? 'Submit "Through Director"' : 'Submit to Registry'}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
