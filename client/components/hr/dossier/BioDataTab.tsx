'use client';

import { User, Phone, Mail, MapPin, Building, Briefcase, GraduationCap, TrendingUp, Calendar, AlertCircle, CheckCircle2, CreditCard } from 'lucide-react';

export default function BioDataTab({ staff }: { staff: any }) {
    if (!staff) return null;

    const profile = staff.staffProfile || staff;
    const lastPromo = staff.lastPromotionDate || profile.lastPromotionDate || staff.dateOfFirstAppointment || profile.dateOfFirstAppointment;
    const nextDueYear = staff.nextPromotionDueYear || profile.nextPromotionDueYear || staff.nextDueYear || profile.nextDueYear;
    const nextDueDate = staff.nextPromotionDueDate || profile.nextPromotionDueDate || staff.nextDueDate || profile.nextDueDate;
    const eligibility = staff.promotionEligibilityStatus || profile.promotionEligibilityStatus || staff.eligibilityStatus || profile.eligibilityStatus || 'PENDING_MATURITY';

    const getEligibilityBadge = (status: string) => {
        switch (status) {
            case 'DUE_THIS_CYCLE':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200"><AlertCircle size={12} /> Due This Cycle</span>;
            case 'MATURED_OVERDUE':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200"><AlertCircle size={12} /> Matured / Overdue</span>;
            case 'IN_REVIEW':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200"><TrendingUp size={12} /> In Review</span>;
            case 'PROMOTED':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"><CheckCircle2 size={12} /> Promoted</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">Pending Maturity</span>;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Bio Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Personal Info */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <User className="text-nounGreen" size={20} /> Personal Information
                    </h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Full Name</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.name}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Email</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.email}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Phone</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.phone || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Gender</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.gender || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">State of Origin</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.stateOfOrigin || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">LGA</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.lga || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 text-sm">Address</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.address || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                {/* Professional Info */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Briefcase className="text-nounGreen" size={20} /> Professional Details
                    </h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Staff ID</span>
                            <span className="col-span-2 font-medium text-gray-900 font-mono">{staff.staffId || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Role</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.role}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Cadre</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.cadre || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Level/Step</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.level || 'N/A'} / {staff.step || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Directorate / Faculty</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.unit?.name || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Study Center</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.studyCenter?.name || 'HQ'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm flex items-center gap-1">
                                <GraduationCap size={14} className="text-nounGreen" /> Highest Qualification
                            </span>
                            <span className="col-span-2 font-medium text-gray-900">
                                {staff.highestQualification || staff.staffProfile?.highestQualification || 'Not Specified'}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 text-sm">Date Created</span>
                            <span className="col-span-2 font-medium text-gray-900">{new Date(staff.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Bursary & Banking Details Section */}
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6 overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="text-blue-700" size={20} />
                    <h3 className="text-lg font-bold text-gray-900">Bursary &amp; Banking Details (Disbursements &amp; Payroll)</h3>
                </div>
                <p className="text-xs text-slate-500 mb-6">
                    Statutory banking information used by the Bursary department for salary payment, allowances, and IPPIS reconciliation.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block mb-1">Bank Name</span>
                        <span className="text-sm font-extrabold text-blue-950">
                            {profile.bankName || staff.bankName || 'Not Provided'}
                        </span>
                    </div>

                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block mb-1">Account Number (NUBAN)</span>
                        <span className="text-base font-black text-blue-950 font-mono tracking-wider">
                            {profile.accountNumber || staff.accountNumber || 'Not Provided'}
                        </span>
                    </div>

                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block mb-1">Account Name (Beneficiary)</span>
                        <span className="text-sm font-bold text-blue-950 uppercase">
                            {profile.accountName || staff.accountName || staff.name || 'Not Provided'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Promotion Maturity & Scheduling Section */}
            <div className="bg-white rounded-xl border border-emerald-200/80 shadow-sm p-6 overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <TrendingUp className="text-emerald-700" size={20} /> Promotion Maturity &amp; Scheduling
                    </h3>
                    <div>{getEligibilityBadge(eligibility)}</div>
                </div>
                <p className="text-xs text-slate-500 mb-6">
                    Statutory appraisal milestones, next substantive promotion cycle, and eligibility status tracked by the Registry promotion engine.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Last Promotion Date</span>
                        <span className="text-sm font-extrabold text-slate-900">
                            {lastPromo ? new Date(lastPromo).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'First Appointment'}
                        </span>
                    </div>

                    <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100">
                        <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">Next Due Year</span>
                        <span className="text-base font-black text-emerald-950 font-mono">
                            {nextDueYear || 'Pending Computation'}
                        </span>
                    </div>

                    <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100">
                        <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">Target Effective Date</span>
                        <span className="text-sm font-extrabold text-emerald-950">
                            {nextDueDate ? new Date(nextDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : (nextDueYear ? `01 Jan ${nextDueYear}` : 'Not Specified')}
                        </span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Statutory Waiting Period</span>
                        <span className="text-sm font-bold text-slate-900">
                            {staff.cadre === 'ACADEMIC' ? '3 Years (Oct 1)' : '3–4 Years (Jan 1)'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
