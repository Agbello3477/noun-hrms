'use client';

import { useState, useEffect } from 'react';
import { 
    X, Send, Paperclip, AlertCircle, Building, User, Tag, Clock, 
    FileText, CheckCircle2, ShieldCheck, ChevronRight, Info, Sparkles, Lock
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
    role?: string;
    unit?: string;
    department?: string;
    staffProfile?: {
        rank?: string;
        title?: string;
        unit?: { id: string; name: string };
        studyCenter?: { id: string; name: string };
    };
}

interface DesignatedDirectorInfo {
    id: string;
    name: string;
    email: string;
    unit?: string;
    role?: string;
    reason?: string;
}

interface FacultyStaffHierarchy {
    isFacultyStaff: boolean;
    department?: { id: string; name: string; code: string };
    hod?: { id: string; name: string; email: string; title?: string };
    faculty?: { id: string; name: string; code: string };
    dean?: { id: string; name: string; email: string; title?: string };
    isCallerHod: boolean;
    isCallerDean: boolean;
}

const LEADERSHIP_ROLES = [
    'DIRECTOR',
    'UNIT_HEAD',
    'HOD',
    'DEAN',
    'HEAD_OF_ADMIN',
    'REGISTRAR',
    'HR_ADMIN',
    'REGISTRY_ADMIN',
    'SUPER_USER',
    'ADMIN',
    'STUDY_CENTER_MANAGER',
    'VICE_CHANCELLOR'
];

export default function WriteOfficialApplicationModal({
    isOpen,
    onClose,
    onSuccess,
    initialMode = 'THROUGH_DIRECTOR'
}: WriteOfficialApplicationModalProps) {
    const { user } = useAuth();
    const isLeadership = Boolean(user && LEADERSHIP_ROLES.includes(user.role as string));

    // Routing Mode toggle: 'THROUGH_DIRECTOR' (Statutory) vs 'DIRECT_REGISTRY' (Desk/Stamp)
    const [routingMode, setRoutingMode] = useState<'THROUGH_DIRECTOR' | 'DIRECT_REGISTRY'>(initialMode);
    
    // Directors list for Through Director mode
    const [directors, setDirectors] = useState<DirectorOption[]>([]);
    const [directorId, setDirectorId] = useState('');
    const [designatedDirector, setDesignatedDirector] = useState<DesignatedDirectorInfo | null>(null);
    const [facultyHierarchy, setFacultyHierarchy] = useState<FacultyStaffHierarchy | null>(null);
    const [loadingDirectors, setLoadingDirectors] = useState(false);

    // Form fields
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState(isLeadership ? STATUTORY_CATEGORIES[0].value : '');
    const [customCategory, setCustomCategory] = useState('');
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
            if (!isLeadership) {
                setUrgency('NORMAL');
            }
        }
    }, [isOpen, initialMode, isLeadership]);

    const loadEligibleDirectors = async () => {
        try {
            setLoadingDirectors(true);
            let res: any;
            try {
                res = await api.get('/api/v1/applications/eligible-directors');
            } catch {
                try {
                    res = await api.get('/api/v1/applications/directors');
                } catch {
                    res = await api.get('/api/applications/eligible-directors');
                }
            }
            const directorList: DirectorOption[] = res?.data?.directors || res?.data?.data || [];
            setDirectors(directorList);

            if (res?.data?.facultyHierarchy) {
                setFacultyHierarchy(res.data.facultyHierarchy);
            }

            if (res?.data?.designatedDirector) {
                const detected = res.data.designatedDirector;
                setDesignatedDirector(detected);
                setDirectorId(detected.id);

                // Dynamically update the Through line in template if it has the generic placeholder
                setContent((prevContent) => {
                    const fh = res.data.facultyHierarchy;
                    let throughLine = `Through: ${detected.name} (${detected.unit || 'Designated Head / Director'})`;
                    if (fh?.isFacultyStaff) {
                        if (!fh.isCallerHod && !fh.isCallerDean) {
                            throughLine = `Through: The Head of Department (HOD) - ${fh.hod?.name || 'HOD'}, Department of ${fh.department?.name || 'Department'}\nThrough: The Dean - ${fh.dean?.name || 'Dean'}, Faculty of ${fh.faculty?.name || 'Faculty'}`;
                        } else if (fh.isCallerHod) {
                            throughLine = `Through: The Dean - ${fh.dean?.name || 'Dean'}, Faculty of ${fh.faculty?.name || 'Faculty'}`;
                        }
                    }
                    if (!prevContent || prevContent.includes('Through: The Director / Head of Unit')) {
                        if (!prevContent) return prevContent;
                        return prevContent.replace('Through: The Director / Head of Unit', throughLine);
                    }
                    return prevContent;
                });
            } else if (directorList.length > 0 && !directorId) {
                setDirectorId(directorList[0].id);
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

            let throughLine = designatedDirector
                ? `Through: ${designatedDirector.name} (${designatedDirector.unit || 'Designated Head / Director'})`
                : 'Through: The Director / Head of Unit';

            if (facultyHierarchy?.isFacultyStaff) {
                if (!facultyHierarchy.isCallerHod && !facultyHierarchy.isCallerDean) {
                    throughLine = `Through: The Head of Department (HOD) - ${facultyHierarchy.hod?.name || 'Head of Department'}, Department of ${facultyHierarchy.department?.name || 'Department'}\nThrough: The Dean - ${facultyHierarchy.dean?.name || 'Dean'}, Faculty of ${facultyHierarchy.faculty?.name || 'Faculty'}`;
                } else if (facultyHierarchy.isCallerHod) {
                    throughLine = `Through: The Dean - ${facultyHierarchy.dean?.name || 'Dean'}, Faculty of ${facultyHierarchy.faculty?.name || 'Faculty'}`;
                }
            }

            if (!content) {
                if (routingMode === 'THROUGH_DIRECTOR') {
                    setContent(
`The University Registrar,
National Open University of Nigeria (NOUN),
University Village, Plot 91, Cadastral Zone,
Nnamdi Azikiwe Expressway, Jabi, Abuja.

${throughLine}

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

Thank you.

Yours faithfully,

${user.name}
${defaultRank}
${defaultUnit}`
                    );
                }
            }
        }
    }, [isOpen, user, routingMode, designatedDirector, facultyHierarchy]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!subject.trim()) {
            setError('Please provide an application subject/title.');
            return;
        }

        let effectiveCategory = '';
        if (isLeadership) {
            if (category === 'OTHER') {
                if (!customCategory.trim()) {
                    setError('Please write and specify your official application category.');
                    return;
                }
                effectiveCategory = customCategory.trim();
            } else {
                effectiveCategory = category;
            }
        } else {
            if (!customCategory.trim()) {
                setError('Please write your application category.');
                return;
            }
            effectiveCategory = customCategory.trim();
        }

        setSubmitting(true);
        try {
            if (routingMode === 'THROUGH_DIRECTOR') {
                // Submit to the Statutory Multi-Tier Institutional Workflow
                const payload: any = {
                    subject: subject.trim(),
                    category: effectiveCategory,
                    urgency: isLeadership ? urgency : 'NORMAL',
                    content: content.trim(),
                    attachmentUrls: []
                };

                if (directorId) {
                    payload.directorId = directorId;
                }

                // If file attached, upload first
                if (file) {
                    const uploadData = new FormData();
                    uploadData.append('file', file);
                    try {
                        const uploadRes = await api.post('/api/v1/applications/upload-attachment', uploadData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        if (uploadRes.data?.url) {
                            payload.attachmentUrls = [uploadRes.data.url];
                        }
                    } catch (uploadErr) {
                        try {
                            const uploadRes2 = await api.post('/api/v1/applications/upload', uploadData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                            });
                            if (uploadRes2.data?.url) {
                                payload.attachmentUrls = [uploadRes2.data.url];
                            }
                        } catch (err2) {
                            console.warn('Pre-upload fallback triggered, will send directly as multipart:', err2);
                        }
                    }
                }

                let res: any;
                // If file is attached but pre-upload didn't set attachmentUrls, submit directly as multipart/form-data
                if (file && (!payload.attachmentUrls || payload.attachmentUrls.length === 0)) {
                    const multiForm = new FormData();
                    multiForm.append('subject', payload.subject);
                    multiForm.append('category', payload.category);
                    multiForm.append('urgency', payload.urgency);
                    multiForm.append('content', payload.content);
                    if (payload.directorId) multiForm.append('directorId', payload.directorId);
                    multiForm.append('files', file);

                    try {
                        res = await api.post('/api/v1/applications/submit', multiForm, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                    } catch (firstErr) {
                        res = await api.post('/api/applications/submit', multiForm, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                    }
                } else {
                    try {
                        res = await api.post('/api/v1/applications/submit', payload);
                    } catch (firstErr) {
                        try {
                            res = await api.post('/api/applications/submit', payload);
                        } catch (fallbackErr: any) {
                            throw fallbackErr?.response ? fallbackErr : firstErr;
                        }
                    }
                }

                if (res.data?.success) {
                    setSuccessMessage('Application submitted successfully! It has been routed to your Director for statutory vetting.');
                    setTimeout(() => {
                        setSuccessMessage('');
                        onClose();
                        if (onSuccess) onSuccess();
                    }, 1400);
                } else {
                    setError(res.data?.error || res.data?.message || 'Failed to submit application.');
                }
            } else {
                // Submit Direct to Registry (Stamped Docket)
                const formData = new FormData();
                formData.append('subject', subject.trim());
                formData.append('category', effectiveCategory);
                formData.append('urgency', isLeadership ? urgency : 'NORMAL');
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
            const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to submit official application. Please try again.';
            setError(errMsg);
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

                    {/* Auto-Detected Unit Head / Director Card or Faculty Hierarchy Routing Banner */}
                    {routingMode === 'THROUGH_DIRECTOR' && facultyHierarchy?.isFacultyStaff ? (
                        <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-[#006533]" />
                                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                                        Faculty Statutory Application Pathway
                                    </span>
                                </div>
                                <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                    STATUTORY ENFORCED
                                </span>
                            </div>
                            <p className="text-[11px] text-emerald-900 leading-relaxed">
                                {facultyHierarchy.isCallerHod ? (
                                    <>Addressed: <strong>To: The Registrar, Through: The Dean</strong> ({facultyHierarchy.dean?.name || 'Dean'}). Forwarded directly to the Dean for onward recommendation to Registry.</>
                                ) : (
                                    <>Addressed: <strong>To: The Registrar, Through: The HOD, Through: The Dean</strong>. Your application is routed first to your HOD ({facultyHierarchy.hod?.name || 'HOD'}) for recommendation, then pushed to the Dean ({facultyHierarchy.dean?.name || 'Dean'}), and then to Registry Admin for stamping and docketing.</>
                                )}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-emerald-800 bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                                <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded">1. Staff Submits</span>
                                <span>&rarr;</span>
                                <span className="bg-emerald-100 text-[#006533] px-1.5 py-0.5 rounded">2. HOD Recommends</span>
                                <span>&rarr;</span>
                                <span className="bg-emerald-100 text-[#006533] px-1.5 py-0.5 rounded">3. Dean Recommends</span>
                                <span>&rarr;</span>
                                <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">4. Registry Admin Folio Docket</span>
                                <span>&rarr;</span>
                                <span className="bg-emerald-800 text-white px-1.5 py-0.5 rounded">5. Registrar Final Approval</span>
                            </div>
                        </div>
                    ) : routingMode === 'THROUGH_DIRECTOR' && designatedDirector ? (
                        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5">
                            <Sparkles className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
                            <div className="text-xs">
                                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                                    Designated Unit Head Auto-Detected
                                    <span className="bg-emerald-200/80 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-bold">
                                        AUTOMATIC
                                    </span>
                                </div>
                                <p className="text-emerald-700 mt-0.5">
                                    Routing automatically to <strong className="text-emerald-950">{designatedDirector.name}</strong> ({designatedDirector.unit || 'Directorate'}).
                                </p>
                            </div>
                        </div>
                    ) : null}

                    {/* Through Director Target selector (shown when mode is THROUGH_DIRECTOR) */}
                    {routingMode === 'THROUGH_DIRECTOR' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <ShieldCheck size={13} className="text-[#006533]" />
                                Designated Supervisor / Head of Department *
                            </label>
                            <select
                                value={directorId}
                                onChange={(e) => setDirectorId(e.target.value)}
                                disabled={loadingDirectors || Boolean(facultyHierarchy?.isFacultyStaff)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006533]"
                            >
                                {designatedDirector && (
                                    <option value={designatedDirector.id}>
                                        ✨ {designatedDirector.name} - {designatedDirector.unit || 'Designated Head'} (Statutory Auto-Routing)
                                    </option>
                                )}
                                {directors
                                    .filter((d) => !designatedDirector || d.id !== designatedDirector.id)
                                    .map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name} {d.staffProfile?.unit?.name ? `(${d.staffProfile.unit.name})` : d.unit ? `(${d.unit})` : ''}
                                        </option>
                                    ))}
                            </select>
                            <p className="text-[10px] text-slate-400 mt-1">
                                {facultyHierarchy?.isFacultyStaff 
                                    ? 'Enforced statutory hierarchy: routed to your designated HOD for departmental vetting.'
                                    : 'Your application will land on the Director&apos;s vetting cockpit for recommendation before forward transit to Registry.'}
                            </p>
                        </div>
                    )}

                    {/* Category & Urgency */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <Tag size={13} className="text-[#006533]" /> Application Category *
                            </label>
                            {isLeadership ? (
                                <div>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006533]"
                                    >
                                        {STATUTORY_CATEGORIES.map((cat) => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                    {category === 'OTHER' && (
                                        <div className="mt-2.5">
                                            <label className="block text-xs font-bold text-emerald-800 mb-1">
                                                Specify Official Application Category *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Special Duty Allowance, Overtime Clearance, Facility Reallocation..."
                                                value={customCategory}
                                                onChange={(e) => setCustomCategory(e.target.value)}
                                                className="w-full bg-emerald-50/40 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006533]"
                                            />
                                            <p className="text-[10px] text-emerald-700 mt-1">
                                                Clearly specify the statutory purpose or category for this official application.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Sabbatical Leave, Office Transfer, Study Fellowship..."
                                        value={customCategory}
                                        onChange={(e) => setCustomCategory(e.target.value)}
                                        className="w-full bg-blue-50/40 border border-blue-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006533]"
                                    />
                                    <p className="text-[10px] text-blue-600 mt-1">
                                        Write your official application category or purpose.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                    <Clock size={13} className="text-[#006533]" /> Priority / Urgency *
                                </span>
                                {!isLeadership && (
                                    <span className="text-[10px] text-slate-400 font-normal flex items-center gap-0.5">
                                        <Lock size={10} /> Leadership Only
                                    </span>
                                )}
                            </label>
                            {isLeadership ? (
                                <select
                                    value={urgency}
                                    onChange={(e) => setUrgency(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006533]"
                                >
                                    {URGENCIES.map((u) => (
                                        <option key={u.value} value={u.value}>{u.label}</option>
                                    ))}
                                </select>
                            ) : (
                                <div>
                                    <input
                                        type="text"
                                        disabled
                                        value="Normal (Standard Processing)"
                                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 cursor-not-allowed"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Priority selection is managed by Unit Heads & Deans.
                                    </p>
                                </div>
                            )}
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
                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-mono leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006533]"
                            required
                        />
                    </div>

                    {/* File Attachment */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                            <Paperclip size={13} className="text-[#006533]" /> Attach Supporting Scanned Document (Optional)
                        </label>
                        <input
                            type="file"
                            onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                            className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-[#006533] hover:file:bg-emerald-100 cursor-pointer"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                            Accepted: PDF, Word, JPG, PNG (Max 10MB).
                        </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 text-xs font-bold text-white bg-[#006533] hover:bg-emerald-800 rounded-xl transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Submitting Application...
                                </>
                            ) : (
                                <>
                                    <Send size={13} />
                                    {routingMode === 'THROUGH_DIRECTOR' ? 'Submit Through Director' : 'Submit to Registry'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
