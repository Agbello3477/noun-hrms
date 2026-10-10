'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';
import { X, Upload, Calendar, Clock, AlertCircle, FileCheck, ShieldAlert } from 'lucide-react';
import dynamic from 'next/dynamic';
import Button from '../ui/Button';

const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
    ssr: false,
    loading: () => <div className="h-[200px] bg-slate-50 border rounded-xl animate-pulse flex items-center justify-center text-xs text-gray-400 font-medium">Loading editor...</div>
});

interface ApplyLeaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const LEAVE_TAXONOMY_OPTIONS = [
    { value: 'ANNUAL', label: 'Annual Leave (Statutory 30 / 42 Days)', docRequired: false },
    { value: 'CASUAL', label: 'Casual Leave (Max 7 Days Cumulative)', docRequired: false },
    { value: 'SICK', label: 'Sick Leave (Exceeding 2 days requires Clinic Report)', docRequired: false },
    { value: 'MATERNITY', label: 'Maternity Leave (16 Weeks Statutory with Pay)', docRequired: true },
    { value: 'PATERNITY', label: 'Paternity Leave (14 Working Days with Pay)', docRequired: true },
    { value: 'STUDY', label: 'Study Leave (SDC Approval Required)', docRequired: true },
    { value: 'TRAINING', label: 'Training Leave (SDC Approval Required)', docRequired: true },
    { value: 'EXAMINATION', label: 'Examination Leave (Exam Timetable/Pass Required)', docRequired: true },
    { value: 'SABBATICAL', label: 'Sabbatical Leave (Academic Cadre Only - Senior Lecturer+)', docRequired: true },
    { value: 'RESEARCH', label: 'Research Leave (Academic Cadre Only)', docRequired: true },
    { value: 'EXTERNAL_ACADEMIC_AWARD', label: 'External Academic Award Leave', docRequired: true },
    { value: 'TERMINAL', label: 'Terminal Leave (Statutory 30 Days Pre-Retirement)', docRequired: false },
    { value: 'LEAVE_OF_ABSENCE_WITHOUT_PAY', label: 'Leave of Absence (Without Pay - Halts Salary Disbursement)', docRequired: false },
];

export default function ApplyLeaveModal({ isOpen, onClose, onSuccess }: ApplyLeaveModalProps) {
    const [type, setType] = useState('ANNUAL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [reliefStaffName, setReliefStaffName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    // Client-side real-time working days estimation
    const workingDaysEstimate = useMemo(() => {
        if (!startDate || !endDate) return null;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) return null;

        let working = 0;
        let weekends = 0;
        let total = 0;

        const curr = new Date(start);
        while (curr <= end) {
            total++;
            const day = curr.getDay();
            if (day === 0 || day === 6) {
                weekends++;
            } else {
                working++;
            }
            curr.setDate(curr.getDate() + 1);
        }

        return { working, weekends, total };
    }, [startDate, endDate]);

    const isDocMandatory = useMemo(() => {
        const option = LEAVE_TAXONOMY_OPTIONS.find(o => o.value === type);
        if (option?.docRequired) return true;
        if (type === 'SICK' && workingDaysEstimate && workingDaysEstimate.working > 2) return true;
        return false;
    }, [type, workingDaysEstimate]);

    const [facultyHierarchy, setFacultyHierarchy] = useState<any>(null);

    // Load draft from IndexedDB and fetch faculty hierarchy when modal opens
    useEffect(() => {
        if (isOpen) {
            import('../../lib/indexedDb').then(({ getDraft }) => {
                getDraft<{ type: string; startDate: string; endDate: string; reason: string; reliefStaffName?: string }>('apply_leave').then((draft) => {
                    if (draft) {
                        setType(draft.type || 'ANNUAL');
                        setStartDate(draft.startDate || '');
                        setEndDate(draft.endDate || '');
                        setReason(draft.reason || '');
                        setReliefStaffName(draft.reliefStaffName || '');
                    }
                });
            });

            api.get('/api/v1/leave/faculty-hierarchy').then((res) => {
                if (res.data?.success && res.data?.facultyHierarchy) {
                    setFacultyHierarchy(res.data.facultyHierarchy);
                }
            }).catch(() => {});
        }
    }, [isOpen]);

    // Auto-save draft changes to IndexedDB
    useEffect(() => {
        if (isOpen && (type !== 'ANNUAL' || startDate || endDate || reason || reliefStaffName)) {
            import('../../lib/indexedDb').then(({ saveDraft }) => {
                saveDraft('apply_leave', { type, startDate, endDate, reason, reliefStaffName });
            });
        }
    }, [isOpen, type, startDate, endDate, reason, reliefStaffName]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg({ type: '', text: '' });

        if (isDocMandatory && !file) {
            setMsg({
                type: 'error',
                text: `Official supporting documentation is mandatory for ${type.replace(/_/g, ' ')}.`
            });
            setLoading(false);
            return;
        }

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

            const handoverNote = reliefStaffName ? ` (Relief Officer: ${reliefStaffName})` : '';
            const cleanReason = reason ? `${reason.trim()}${handoverNote}` : (reliefStaffName ? `Relief Officer: ${reliefStaffName}` : '');

            await api.post('/api/v1/leave/apply', {
                leaveType: type,
                startDate,
                endDate,
                reason: cleanReason || undefined,
                supportingDocumentUrl: documentUrl || undefined,
                isPaidLeave: type !== 'LEAVE_OF_ABSENCE_WITHOUT_PAY',
            });

            setMsg({ type: 'success', text: 'Leave Application Submitted Successfully (Pending Dual-Level Vetting)' });

            import('../../lib/indexedDb').then(({ clearDraft }) => {
                clearDraft('apply_leave');
            });

            setTimeout(() => {
                onSuccess();
                onClose();
                setType('ANNUAL');
                setStartDate('');
                setEndDate('');
                setReason('');
                setReliefStaffName('');
                setFile(null);
                setMsg({ type: '', text: '' });
            }, 1200);
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
                    <div>
                        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Calendar size={18} className="text-blue-600" />
                            Apply for Statutory Leave
                        </h2>
                        <p className="text-xs text-gray-500">13 Official Statutory Categories • Real-time Working Day Deduction</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                    <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                        {msg.text && (
                            <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                                msg.type === 'success' 
                                    ? 'bg-green-50 border-green-200 text-green-700' 
                                    : 'bg-red-50 border-red-200 text-red-700'
                            }`}>
                                {msg.type === 'success' ? <FileCheck size={16} /> : <AlertCircle size={16} />}
                                {msg.text}
                            </div>
                        )}

                        {facultyHierarchy?.isFacultyStaff && (
                            <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                                        <Calendar size={14} className="text-blue-700" />
                                        Faculty Statutory Leave Workflow
                                    </span>
                                    <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                        STATUTORY
                                    </span>
                                </div>
                                <p className="text-[11px] text-blue-800 leading-snug">
                                    Addressed: <strong>To The Dean, Faculty of {facultyHierarchy.faculty?.name || 'Faculty'}, Through: The Head of Department (HOD)</strong>.
                                    Your HOD ({facultyHierarchy.hod?.name || 'HOD'}) will recommend and push to the Dean ({facultyHierarchy.dean?.name || 'Dean'}) for final approval.
                                </p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                                    Statutory Leave Category
                                </label>
                                <select
                                    className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                >
                                    {LEAVE_TAXONOMY_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                {type === 'LEAVE_OF_ABSENCE_WITHOUT_PAY' && (
                                    <div className="mt-1.5 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                                        <ShieldAlert size={16} className="text-amber-600 flex-shrink-0" />
                                        <span>Statutory Notice: Approval of Leave of Absence Without Pay halts automated salary computation in the Payroll Engine.</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                                        Commencement Date
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                                        Resumption Date (End)
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Real-time Working-Day Calculator Badge */}
                            {workingDaysEstimate && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} className="text-blue-600" />
                                        <span>
                                            Duration: <strong className="text-blue-700">{workingDaysEstimate.working} working days</strong>
                                            {workingDaysEstimate.weekends > 0 && ` (${workingDaysEstimate.weekends} weekend days excluded)`}
                                        </span>
                                    </div>
                                    <span className="text-[11px] font-semibold text-blue-600 bg-white px-2.5 py-1 rounded-md border border-blue-100">
                                        {workingDaysEstimate.total} Calendar Days
                                    </span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                                    Designated Relief / Handover Officer
                                </label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    value={reliefStaffName}
                                    onChange={(e) => setReliefStaffName(e.target.value)}
                                    placeholder="e.g. Dr. A. Bello (Handover coverage)"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                                    Reason & Operational Notes
                                </label>
                                <RichTextEditor
                                    value={reason}
                                    onChange={setReason}
                                    placeholder="Detail purpose of leave, handover arrangements, and emergency contact..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                                    Supporting Document {isDocMandatory ? <span className="text-red-600 font-bold">* (MANDATORY)</span> : <span className="text-gray-400 font-normal">(Optional)</span>}
                                </label>
                                <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                                    isDocMandatory && !file ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50' : 'border-gray-200 hover:bg-gray-50'
                                }`}>
                                    <input
                                        type="file"
                                        id="supporting-file-upload"
                                        className="hidden"
                                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                                        accept=".pdf,.doc,.docx,image/*"
                                    />
                                    <label htmlFor="supporting-file-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
                                        <Upload className={isDocMandatory && !file ? 'text-amber-500' : 'text-gray-400'} size={24} />
                                        <span className="text-xs text-gray-700 font-medium">
                                            {file ? file.name : (isDocMandatory ? 'Upload mandatory certificate, medical report, or SDC approval (PDF/Doc/Image)' : 'Click to upload supporting documents')}
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            isLoading={loading}
                        >
                            Submit Leave Application
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
