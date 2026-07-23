"use client";

import React, { useState, useEffect } from 'react';
import { 
    FileText, User, Calendar, Briefcase, Award, CheckCircle2, 
    ChevronLeft, ChevronRight, Save, Send, AlertCircle, Sparkles, Check, HelpCircle
} from 'lucide-react';

interface KeyResponsibilityItem {
    id: string;
    description: string;
    importance: 'CRITICAL' | 'HIGHLY_DESIRABLE' | 'LOW_IMPORTANCE';
    achievementLevel: 'A' | 'B' | 'C' | 'D' | 'E';
}

interface QualificationItem {
    id: string;
    name: string;
    acquiredDuringPeriod: boolean;
}

interface OfficialAperFormProps {
    mode: 'STAFF' | 'HOD_REVIEW';
    session: any;
    profile: any;
    initialData?: any;
    onSubmit: (formData: any, isDraft: boolean) => Promise<void>;
    isSubmitting?: boolean;
}

export default function OfficialAperForm({
    mode,
    session,
    profile,
    initialData,
    onSubmit,
    isSubmitting = false
}: OfficialAperFormProps) {
    const [currentPage, setCurrentPage] = useState<1 | 2 | 3 | 4>(1);

    // ── PAGE 1: Personal Records (Part 1) ───────────────────────────────────
    const [page1, setPage1] = useState({
        title: profile?.title || 'Mr',
        surname: profile?.surname || '',
        firstName: profile?.otherNames?.split(' ')?.[0] || '',
        middleName: profile?.otherNames?.split(' ')?.slice(1)?.join(' ') || '',
        dateOfBirth: profile?.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().split('T')[0] : '',
        dateOfFirstAppointment: profile?.dateOfFirstAppointment ? new Date(profile.dateOfFirstAppointment).toISOString().split('T')[0] : '',
        presentGradePostDate: profile?.rank ? `${profile.rank} (GL ${profile.level || '—'}/${profile.step || '1'})` : '',
        dateOfConfirmation: profile?.dateOfConfirmation ? new Date(profile.dateOfConfirmation).toISOString().split('T')[0] : '',
        dateOfLastPromotion: profile?.dateOfLastPromotion ? new Date(profile.dateOfLastPromotion).toISOString().split('T')[0] : '',
        schoolCentreDept: profile?.department || profile?.unit?.name || profile?.studyCenter?.name || 'NOUN HQ',
        periodInDept: '12 Months',
        actingAppointment: ''
    });

    const [qualifications, setQualifications] = useState<QualificationItem[]>([
        { id: 'q1', name: 'B.Sc. Business Administration', acquiredDuringPeriod: false },
        { id: 'q2', name: 'M.Sc. Human Resource Management', acquiredDuringPeriod: true }
    ]);

    // ── PAGE 2: Present Job & Responsibilities Rating ───────────────────────
    const [page2, setPage2] = useState({
        jobTitle: profile?.rank || 'Administrative Officer',
        keyResponsibilitiesOrder: '1. Oversee staff records and dossier archives.\n2. Coordinate APER appraisal workflow.\n3. Process staff leave and transfer requests.',
        communityService: 'Member, Campus Emergency Response & Welfare Committee.',
        adHocDuties: 'Secretary, 2026 Convocation Planning Committee.'
    });

    const [responsibilitiesTable, setResponsibilitiesTable] = useState<KeyResponsibilityItem[]>([
        { id: '1', description: 'Management of Staff Profile Dossiers', importance: 'CRITICAL', achievementLevel: 'A' },
        { id: '2', description: 'Processing Promotion & APER Documentation', importance: 'HIGHLY_DESIRABLE', achievementLevel: 'B' },
        { id: '3', description: 'Departmental Monthly Attendance Audit', importance: 'CRITICAL', achievementLevel: 'A' },
        { id: '4', description: 'Registry Archival Indexing', importance: 'LOW_IMPORTANCE', achievementLevel: 'C' }
    ]);

    // ── PAGE 3: Self Assessment & Performance Comments ────────────────────
    const [page3, setPage3] = useState({
        jobsDoneToSatisfaction: 'Successfully automated digital file requests and digitized staff dossiers, reducing response turnaround time.',
        causesOfSuccessOrLack: 'Strong team cooperation, institutional support from HR Admin, and access to automated HRMS portals.',
        needMoreTraining: 'Yes, advanced data analytics and strategic HR management training.',
        isEffectiveUseMade: 'YES',
        effectiveUseExpatiation: 'My skills in digital document archiving and administrative workflow optimization are fully utilized in my present registry role.',
        couldAbilitiesBeBetterUsed: 'NO',
        betterUsedExpatiation: 'I am currently placed in the optimal cadre where my professional qualifications and capabilities yield maximum institutional productivity.'
    });

    // ── PAGE 4: Part 2 (Reporting Officer / HOD Assessment) ────────────────
    const [page4, setPage4] = useState({
        agreeOnMainDuties: 'YES',
        disagreementNotes: 'Fully agreed on all assigned responsibilities and priority order.',
        effectivenessComments: 'The staff member has demonstrated exceptional dedication and exceeded expected performance benchmarks during the reporting period.',
        aspectRatings: {
            qualityOfWork: 'A',
            workOutput: 'A',
            dependability: 'B',
            punctuality: 'A',
            leadership: 'B',
            interpersonalRelations: 'A'
        },
        reportingOfficerName: 'Dr. A. O. Bello (HOD / Supervisor)',
        reportingOfficerRank: 'Associate Professor & HOD',
        overallRating: 'OUTSTANDING_A'
    });

    // Load initial data if editing existing draft
    useEffect(() => {
        if (initialData) {
            if (initialData.page1) setPage1(prev => ({ ...prev, ...initialData.page1 }));
            if (initialData.qualifications) setQualifications(initialData.qualifications);
            if (initialData.page2) setPage2(prev => ({ ...prev, ...initialData.page2 }));
            if (initialData.responsibilitiesTable) setResponsibilitiesTable(initialData.responsibilitiesTable);
            if (initialData.page3) setPage3(prev => ({ ...prev, ...initialData.page3 }));
            if (initialData.page4) setPage4(prev => ({ ...prev, ...initialData.page4 }));
        }
    }, [initialData]);

    const handleAddQualification = () => {
        setQualifications(prev => [
            ...prev,
            { id: `q-${Date.now()}`, name: '', acquiredDuringPeriod: false }
        ]);
    };

    const handleAddResponsibilityRow = () => {
        setResponsibilitiesTable(prev => [
            ...prev,
            { id: `${prev.length + 1}`, description: '', importance: 'HIGHLY_DESIRABLE', achievementLevel: 'B' }
        ]);
    };

    const handleSaveDraft = () => {
        const fullPayload = {
            page1,
            qualifications,
            page2,
            responsibilitiesTable,
            page3,
            page4
        };
        onSubmit(fullPayload, true);
    };

    const handleFinalSubmit = () => {
        const fullPayload = {
            page1,
            qualifications,
            page2,
            responsibilitiesTable,
            page3,
            page4
        };
        onSubmit(fullPayload, false);
    };

    const periodYear = session?.year || new Date().getFullYear();
    const staffIdCode = profile?.staffId || profile?.user?.email?.split('@')[0] || 'NOUN/STAFF/001';

    return (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden max-w-5xl mx-auto my-6 animate-in fade-in duration-300">
            {/* Official NOUN Header Banner */}
            <div 
                style={{ backgroundColor: '#006533', color: '#ffffff' }}
                className="px-8 py-6 text-white border-b-4 border-amber-400 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md"
            >
                <div className="flex items-center gap-4 relative z-10">
                    <img src="/noun_logo.png" alt="NOUN Logo" className="h-14 w-14 object-contain bg-white rounded-2xl p-1.5 shadow-md" />
                    <div>
                        <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-amber-300">
                            National Open University of Nigeria
                        </h1>
                        <h2 className="text-sm md:text-base font-bold text-white tracking-wide">
                            ANNUAL PERFORMANCE EVALUATION REPORT (APER)
                        </h2>
                    </div>
                </div>

                <div className="bg-emerald-950/80 border border-emerald-500/60 rounded-2xl px-5 py-2.5 text-right relative z-10 text-xs font-bold space-y-1 shadow-inner">
                    <div className="text-amber-300 uppercase tracking-wider text-[10px] font-extrabold">Report Metadata</div>
                    <div>Period of Report: <span className="text-white font-extrabold text-sm">{periodYear}</span></div>
                    <div>Staff ID: <span className="text-emerald-200 font-extrabold text-sm">{staffIdCode}</span></div>
                </div>

                {/* Decorative background glow */}
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"></div>
            </div>

            {/* 4 Page Tab Navigation Wizard */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 overflow-x-auto py-1">
                    {[
                        { num: 1, label: 'Page 1: Personal Records' },
                        { num: 2, label: 'Page 2: Job & Ratings' },
                        { num: 3, label: 'Page 3: Self Assessment' },
                        { num: 4, label: 'Page 4: HOD Part 2' }
                    ].map(p => (
                        <button
                            key={p.num}
                            onClick={() => setCurrentPage(p.num as any)}
                            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 flex items-center gap-2 border ${
                                currentPage === p.num
                                    ? 'bg-emerald-700 text-white border-emerald-800 shadow-md scale-105'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                                currentPage === p.num ? 'bg-amber-400 text-emerald-950 font-black' : 'bg-slate-200 text-slate-700 font-bold'
                            }`}>
                                {p.num}
                            </span>
                            <span>{p.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSaveDraft}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-slate-300"
                    >
                        <Save size={14} />
                        <span>Save Draft</span>
                    </button>
                    {mode === 'STAFF' && (
                        <button
                            onClick={handleFinalSubmit}
                            disabled={isSubmitting}
                            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md transition"
                        >
                            <Send size={14} />
                            <span>Submit Report</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Form Content Container */}
            <div className="p-6 md:p-10 space-y-8 min-h-[500px]">

                {/* ──────────────────────────────────────────────────────────────────
                    PAGE 1: PART 1. PERSONAL RECORDS OF EMPLOYEE
                   ────────────────────────────────────────────────────────────────── */}
                {currentPage === 1 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <User className="text-emerald-700" size={20} />
                                PART 1. Personal Records of Employee
                            </h3>
                            <p className="text-xs text-slate-500 font-semibold mt-0.5">Please verify and complete all personal identification and substantive appointment parameters.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">1. Title</label>
                                <input
                                    type="text"
                                    value={page1.title}
                                    onChange={e => setPage1({ ...page1, title: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">3. Surname</label>
                                <input
                                    type="text"
                                    value={page1.surname}
                                    onChange={e => setPage1({ ...page1, surname: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">4. First Name</label>
                                <input
                                    type="text"
                                    value={page1.firstName}
                                    onChange={e => setPage1({ ...page1, firstName: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">2. Middle Name</label>
                                <input
                                    type="text"
                                    value={page1.middleName}
                                    onChange={e => setPage1({ ...page1, middleName: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">5. Date of Birth</label>
                                <input
                                    type="date"
                                    value={page1.dateOfBirth}
                                    onChange={e => setPage1({ ...page1, dateOfBirth: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">6. Date of First Appointment</label>
                                <input
                                    type="date"
                                    value={page1.dateOfFirstAppointment}
                                    onChange={e => setPage1({ ...page1, dateOfFirstAppointment: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">7. Present Substantive Grade/Post/Date</label>
                                <input
                                    type="text"
                                    value={page1.presentGradePostDate}
                                    onChange={e => setPage1({ ...page1, presentGradePostDate: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">8. Date of Confirmation of Appointment</label>
                                <input
                                    type="date"
                                    value={page1.dateOfConfirmation}
                                    onChange={e => setPage1({ ...page1, dateOfConfirmation: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">9. Date of Last Promotion</label>
                                <input
                                    type="date"
                                    value={page1.dateOfLastPromotion}
                                    onChange={e => setPage1({ ...page1, dateOfLastPromotion: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">10. School / Centre / Department</label>
                                <input
                                    type="text"
                                    value={page1.schoolCentreDept}
                                    onChange={e => setPage1({ ...page1, schoolCentreDept: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">11. Period you have been in the school/centre/dept</label>
                                <input
                                    type="text"
                                    value={page1.periodInDept}
                                    onChange={e => setPage1({ ...page1, periodInDept: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                    placeholder="e.g. 2 Years 4 Months"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">13. Acting Appointment held during period of report</label>
                                <input
                                    type="text"
                                    value={page1.actingAppointment}
                                    onChange={e => setPage1({ ...page1, actingAppointment: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                    placeholder="Indicate portion (to nearest month) spent on post"
                                />
                            </div>
                        </div>

                        {/* 12. Qualifications Held */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-black text-slate-800 uppercase">12. Qualifications Held (Degree, Diploma, Certificate etc.)</h4>
                                    <p className="text-[11px] text-slate-500 font-semibold">Underline/Check those acquired during the reporting period.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddQualification}
                                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
                                >
                                    + Add Qualification
                                </button>
                            </div>

                            <div className="space-y-2">
                                {qualifications.map((q, idx) => (
                                    <div key={q.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                                        <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}.</span>
                                        <input
                                            type="text"
                                            value={q.name}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setQualifications(prev => prev.map(item => item.id === q.id ? { ...item, name: val } : item));
                                            }}
                                            placeholder="e.g. M.Sc. Information Technology"
                                            className="flex-1 border rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
                                        />
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                                            <input
                                                type="checkbox"
                                                checked={q.acquiredDuringPeriod}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setQualifications(prev => prev.map(item => item.id === q.id ? { ...item, acquiredDuringPeriod: checked } : item));
                                                }}
                                                className="rounded text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span>Acquired During Period</span>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ──────────────────────────────────────────────────────────────────
                    PAGE 2: PRESENT JOB & RESPONSIBILITIES RATING TABLE
                   ────────────────────────────────────────────────────────────────── */}
                {currentPage === 2 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Briefcase className="text-emerald-700" size={20} />
                                PAGE 2. Present Job & Key Responsibilities
                            </h3>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">14. Course/Training/Programme undertaken during period of report</label>
                            <textarea
                                rows={3}
                                value={page2.keyResponsibilitiesOrder}
                                onChange={e => setPage2({ ...page2, keyResponsibilitiesOrder: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                placeholder="List all professional development courses, workshops, and training programmes completed..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                15 (a). State below in order of importance the key responsibilities of present position performed during report period
                            </label>
                            <textarea
                                rows={3}
                                value={page2.keyResponsibilitiesOrder}
                                onChange={e => setPage2({ ...page2, keyResponsibilitiesOrder: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">15 (b). Community Service / Letters of Commendation</label>
                                <textarea
                                    rows={2}
                                    value={page2.communityService}
                                    onChange={e => setPage2({ ...page2, communityService: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">15 (c). Ad-hoc Duties Performed (Non-continuous)</label>
                                <textarea
                                    rows={2}
                                    value={page2.adHocDuties}
                                    onChange={e => setPage2({ ...page2, adHocDuties: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                            </div>
                        </div>

                        {/* 15 (d). Rating Table */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-black text-slate-900 uppercase">
                                        15 (d). List and rate (tick) importance of key responsibilities assigned to you during period under review
                                    </h4>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddResponsibilityRow}
                                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
                                >
                                    + Add Responsibility
                                </button>
                            </div>

                            <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                                <table className="w-full text-xs text-left">
                                    <thead>
                                        <tr className="bg-emerald-900 text-white font-extrabold uppercase border-b border-emerald-950">
                                            <th className="p-3 text-center w-12">S/N</th>
                                            <th className="p-3">Key Responsibilities</th>
                                            <th className="p-3 text-center w-28">Critical</th>
                                            <th className="p-3 text-center w-32">Highly Desirable</th>
                                            <th className="p-3 text-center w-28">Low Importance</th>
                                            <th className="p-3 text-center w-36">Level of Achievement</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {responsibilitiesTable.map((item, idx) => (
                                            <tr key={item.id} className="hover:bg-slate-50">
                                                <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                                                <td className="p-3">
                                                    <input
                                                        type="text"
                                                        value={item.description}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setResponsibilitiesTable(prev => prev.map(r => r.id === item.id ? { ...r, description: val } : r));
                                                        }}
                                                        className="w-full border rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
                                                        placeholder="Describe key assigned responsibility..."
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="radio"
                                                        name={`importance-${item.id}`}
                                                        checked={item.importance === 'CRITICAL'}
                                                        onChange={() => {
                                                            setResponsibilitiesTable(prev => prev.map(r => r.id === item.id ? { ...r, importance: 'CRITICAL' } : r));
                                                        }}
                                                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="radio"
                                                        name={`importance-${item.id}`}
                                                        checked={item.importance === 'HIGHLY_DESIRABLE'}
                                                        onChange={() => {
                                                            setResponsibilitiesTable(prev => prev.map(r => r.id === item.id ? { ...r, importance: 'HIGHLY_DESIRABLE' } : r));
                                                        }}
                                                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="radio"
                                                        name={`importance-${item.id}`}
                                                        checked={item.importance === 'LOW_IMPORTANCE'}
                                                        onChange={() => {
                                                            setResponsibilitiesTable(prev => prev.map(r => r.id === item.id ? { ...r, importance: 'LOW_IMPORTANCE' } : r));
                                                        }}
                                                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <select
                                                        value={item.achievementLevel}
                                                        onChange={e => {
                                                            const val = e.target.value as any;
                                                            setResponsibilitiesTable(prev => prev.map(r => r.id === item.id ? { ...r, achievementLevel: val } : r));
                                                        }}
                                                        className="border rounded-lg p-1.5 font-bold text-xs bg-slate-50 text-slate-800 outline-none focus:border-emerald-600"
                                                    >
                                                        <option value="A">Grade A (Highest)</option>
                                                        <option value="B">Grade B</option>
                                                        <option value="C">Grade C</option>
                                                        <option value="D">Grade D</option>
                                                        <option value="E">Grade E (Lowest)</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <p className="text-center font-black text-slate-900 text-xs tracking-wide pt-1">
                                Please Rank (A - Highest and E - Lowest)
                            </p>
                        </div>
                    </div>
                )}

                {/* ──────────────────────────────────────────────────────────────────
                    PAGE 3: COMMENTS ON DUTIES & CAPABILITY EXPATIATION
                   ────────────────────────────────────────────────────────────────── */}
                {currentPage === 3 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Award className="text-emerald-700" size={20} />
                                PAGE 3. Comments & Capability Expatiation
                            </h3>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                16 (a). Which jobs assigned to you do you think you have undertaken to the satisfaction of your immediate supervisor/HOD?
                            </label>
                            <textarea
                                rows={3}
                                value={page3.jobsDoneToSatisfaction}
                                onChange={e => setPage3({ ...page3, jobsDoneToSatisfaction: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                16 (b). What are the causes or reasons, personal or otherwise, to which you ascribe your success or lack of success?
                            </label>
                            <textarea
                                rows={3}
                                value={page3.causesOfSuccessOrLack}
                                onChange={e => setPage3({ ...page3, causesOfSuccessOrLack: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                16 (c). Do you think that you need more training or experience to enable you to do your job better? If so, of what kind?
                            </label>
                            <textarea
                                rows={3}
                                value={page3.needMoreTraining}
                                onChange={e => setPage3({ ...page3, needMoreTraining: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                            />
                        </div>

                        {/* 16 (d) Capability Checkbox & Expatiation */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <label className="text-xs font-extrabold text-slate-900">
                                    16 (d). Is the most effective use being made of your capabilities in your present job?
                                </label>
                                <div className="flex items-center gap-4 shrink-0">
                                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-slate-800">
                                        <input
                                            type="radio"
                                            name="effectiveUse"
                                            checked={page3.isEffectiveUseMade === 'YES'}
                                            onChange={() => setPage3({ ...page3, isEffectiveUseMade: 'YES' })}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>[ ✓ ] YES</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-slate-800">
                                        <input
                                            type="radio"
                                            name="effectiveUse"
                                            checked={page3.isEffectiveUseMade === 'NO'}
                                            onChange={() => setPage3({ ...page3, isEffectiveUseMade: 'NO' })}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>[ ✓ ] NO</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Please Expatiate:</label>
                                <textarea
                                    rows={2}
                                    value={page3.effectiveUseExpatiation}
                                    onChange={e => setPage3({ ...page3, effectiveUseExpatiation: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                                />
                            </div>
                        </div>

                        {/* 16 (e) Abilities Checkbox & Expatiation */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <label className="text-xs font-extrabold text-slate-900">
                                    16 (e). Do you think that your abilities could be better used in your present job or in another kind of job?
                                </label>
                                <div className="flex items-center gap-4 shrink-0">
                                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-slate-800">
                                        <input
                                            type="radio"
                                            name="betterUsed"
                                            checked={page3.couldAbilitiesBeBetterUsed === 'YES'}
                                            onChange={() => setPage3({ ...page3, couldAbilitiesBeBetterUsed: 'YES' })}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>[ ✓ ] YES</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-slate-800">
                                        <input
                                            type="radio"
                                            name="betterUsed"
                                            checked={page3.couldAbilitiesBeBetterUsed === 'NO'}
                                            onChange={() => setPage3({ ...page3, couldAbilitiesBeBetterUsed: 'NO' })}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>[ ✓ ] NO</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Please Expatiate:</label>
                                <textarea
                                    rows={2}
                                    value={page3.betterUsedExpatiation}
                                    onChange={e => setPage3({ ...page3, betterUsedExpatiation: e.target.value })}
                                    className="w-full border rounded-xl p-2.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ──────────────────────────────────────────────────────────────────
                    PAGE 4: PART 2 (TO BE COMPLETED BY REPORTING OFFICER / HOD)
                   ────────────────────────────────────────────────────────────────── */}
                {currentPage === 4 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="border-b pb-3 border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                    <Award className="text-amber-500" size={20} />
                                    PART 2. Assessment of Performance (Reporting Officer / HOD)
                                </h3>
                                <p className="text-xs text-slate-500 font-semibold mt-0.5">To be completed by Immediate Supervisor / Head of Department.</p>
                            </div>

                            {mode === 'STAFF' && (
                                <span className="bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200">
                                    HOD Review Section
                                </span>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                (a) Do you and the person reported upon agree on the main duties performed and order of importance? (Record unresolved differences below):
                            </label>
                            <textarea
                                rows={3}
                                disabled={mode === 'STAFF'}
                                value={page4.disagreementNotes}
                                onChange={e => setPage4({ ...page4, disagreementNotes: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 disabled:bg-slate-50"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                (b) How effective is he/she in the performance of duties set out in 15 (a) and (b), or how far achieved required results?
                            </label>
                            <textarea
                                rows={3}
                                disabled={mode === 'STAFF'}
                                value={page4.effectivenessComments}
                                onChange={e => setPage4({ ...page4, effectivenessComments: e.target.value })}
                                className="w-full border rounded-xl p-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 disabled:bg-slate-50"
                            />
                        </div>

                        {/* Item 17: Aspects of Performance Assessment Matrix */}
                        <div className="border rounded-2xl p-5 bg-slate-50 border-slate-200 space-y-4">
                            <h4 className="text-xs font-black text-slate-900 uppercase">
                                17. Aspects of Performance (Rate A: Outstanding through E: Unsatisfactory)
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { key: 'qualityOfWork', label: 'Quality of Work & Accuracy' },
                                    { key: 'workOutput', label: 'Work Output & Timeliness' },
                                    { key: 'dependability', label: 'Dependability & Reliability' },
                                    { key: 'punctuality', label: 'Punctuality & Attendance' },
                                    { key: 'leadership', label: 'Leadership & Initiative' },
                                    { key: 'interpersonalRelations', label: 'Interpersonal Relations & Teamwork' }
                                ].map(aspect => (
                                    <div key={aspect.key} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-800">{aspect.label}</span>
                                        <select
                                            disabled={mode === 'STAFF'}
                                            value={(page4.aspectRatings as any)[aspect.key]}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setPage4({
                                                    ...page4,
                                                    aspectRatings: { ...page4.aspectRatings, [aspect.key]: val }
                                                });
                                            }}
                                            className="border rounded-lg p-1.5 text-xs font-black bg-slate-50 text-slate-900 outline-none focus:border-emerald-600 disabled:bg-slate-100"
                                        >
                                            <option value="A">Rating A (Outstanding)</option>
                                            <option value="B">Rating B (Very Good)</option>
                                            <option value="C">Rating C (Good)</option>
                                            <option value="D">Rating D (Fair)</option>
                                            <option value="E">Rating E (Unsatisfactory)</option>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Pagination Bar */}
            <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
                <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((currentPage - 1) as any)}
                    className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-200 disabled:opacity-40 rounded-xl text-xs font-bold transition border border-slate-300 flex items-center gap-1"
                >
                    <ChevronLeft size={16} />
                    <span>Previous Page</span>
                </button>

                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                    Page {currentPage} of 4
                </span>

                <button
                    disabled={currentPage === 4}
                    onClick={() => setCurrentPage((currentPage + 1) as any)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1"
                >
                    <span>Next Page</span>
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
}
