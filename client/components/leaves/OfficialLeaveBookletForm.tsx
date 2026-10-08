'use client';

import React, { useState, useEffect } from 'react';
import { OfficialLeaveBooklet } from '../../types/leaveBooklet';
import SignaturePad from '../ui/SignaturePad';
import {
  FileText,
  User,
  Calendar,
  Building,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Save,
  Send,
  Loader2,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  Award,
  PenTool,
  Check,
} from 'lucide-react';

interface OfficialLeaveBookletFormProps {
  initialData?: Partial<OfficialLeaveBooklet>;
  profile?: any;
  userRole?: string;
  onSubmit: (data: OfficialLeaveBooklet, isDraft: boolean) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  mode?: 'STAFF_APPLY' | 'HOD_REVIEW' | 'DEAN_REVIEW' | 'HR_REVIEW' | 'REGISTRAR_REVIEW' | 'VIEW_ONLY';
}

export default function OfficialLeaveBookletForm({
  initialData,
  profile,
  userRole = 'STAFF',
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = 'STAFF_APPLY',
}: OfficialLeaveBookletFormProps) {
  const currentYear = new Date().getFullYear();

  // Auto-populate from staffProfile
  const defaultStaffNo = profile?.staffId || profile?.user?.staffId || profile?.user?.email?.split('@')[0] || '';
  const defaultSurname = profile?.surname || profile?.user?.surname || '';
  const defaultOtherNames = profile?.otherNames || profile?.user?.otherNames || '';
  const defaultFullName = defaultSurname ? `${defaultSurname}, ${defaultOtherNames}` : profile?.user?.name || '';
  const defaultDesignation = profile?.rank || profile?.currentAcademicRank || profile?.designation || 'Staff';
  const defaultSalaryScale = profile?.salaryScale || (profile?.level ? `CONTISS ${profile.level}` : 'CONUASS 04');
  const defaultAppointmentDate = profile?.dateOfFirstAppointment
    ? new Date(profile.dateOfFirstAppointment).toISOString().split('T')[0]
    : '2020-01-15';
  const defaultUnit =
    profile?.department ||
    profile?.unit?.name ||
    profile?.studyCenter?.name ||
    profile?.faculty?.name ||
    'National Open University of Nigeria';
  const defaultLocation = profile?.studyCenter?.name || profile?.location || 'Abuja Headquarters';
  const defaultPhone = profile?.phoneNumber || profile?.user?.phoneNumber || '';
  const defaultEmail = profile?.officialEmail || profile?.user?.email || '';

  const [formData, setFormData] = useState<OfficialLeaveBooklet>({
    leaveYear: initialData?.leaveYear || currentYear,
    staffNo: initialData?.staffNo || defaultStaffNo,
    fullName: initialData?.fullName || defaultFullName,
    surname: initialData?.surname || defaultSurname,
    otherNames: initialData?.otherNames || defaultOtherNames,
    designation: initialData?.designation || defaultDesignation,
    salaryScale: initialData?.salaryScale || defaultSalaryScale,
    dateOfAppointment: initialData?.dateOfAppointment || defaultAppointmentDate,
    facultyDeptStudyCenter: initialData?.facultyDeptStudyCenter || defaultUnit,
    location: initialData?.location || defaultLocation,
    phoneNo: initialData?.phoneNo || defaultPhone,
    officialEmail: initialData?.officialEmail || defaultEmail,
    dateResumedPreviousLeave: initialData?.dateResumedPreviousLeave || '',
    dateProceedingOnLeave: initialData?.dateProceedingOnLeave || '',
    dateLeaveEnds: initialData?.dateLeaveEnds || '',
    dateOfResumption: initialData?.dateOfResumption || '',
    staffSignature: initialData?.staffSignature || '',
    staffSignatureDate: initialData?.staffSignatureDate || new Date().toISOString().split('T')[0],
    reliefOfficerName: initialData?.reliefOfficerName || '',
    reliefOfficerStaffId: initialData?.reliefOfficerStaffId || '',
    reliefOfficerRank: initialData?.reliefOfficerRank || '',
    reliefOfficerDepartment: initialData?.reliefOfficerDepartment || '',

    // Supervisor (18 - 19)
    supervisorComment: initialData?.supervisorComment || '',
    supervisorName: initialData?.supervisorName || '',
    supervisorDesignation: initialData?.supervisorDesignation || '',
    supervisorSignature: initialData?.supervisorSignature || '',
    supervisorSignatureDate: initialData?.supervisorSignatureDate || '',

    // Dean / Director (20 - 21)
    deanDirectorComment: initialData?.deanDirectorComment || '',
    deanDirectorName: initialData?.deanDirectorName || '',
    deanDirectorTitle: initialData?.deanDirectorTitle || '',
    deanDirectorSignature: initialData?.deanDirectorSignature || '',
    deanDirectorSignatureDate: initialData?.deanDirectorSignatureDate || '',

    // Director HR (22 - 24)
    directorHrComment: initialData?.directorHrComment || '',
    directorHrName: initialData?.directorHrName || '',
    directorHrSignature: initialData?.directorHrSignature || '',
    directorHrSignatureDate: initialData?.directorHrSignatureDate || '',

    // Registrar (25 - 26)
    registrarComment: initialData?.registrarComment || '',
    registrarName: initialData?.registrarName || '',
    registrarSignature: initialData?.registrarSignature || '',
    registrarSignatureDate: initialData?.registrarSignatureDate || '',

    status: initialData?.status || 'DRAFT',
  });

  // Calculate resumption date automatically when leave ends
  const handleLeaveEndDateChange = (endDateStr: string) => {
    setFormData((prev) => {
      const updated = { ...prev, dateLeaveEnds: endDateStr };
      if (endDateStr) {
        const d = new Date(endDateStr);
        d.setDate(d.getDate() + 1);
        // If Sunday, move to Monday
        if (d.getDay() === 0) d.setDate(d.getDate() + 1);
        // If Saturday, move to Monday
        if (d.getDay() === 6) d.setDate(d.getDate() + 2);
        updated.dateOfResumption = d.toISOString().split('T')[0];
      }
      return updated;
    });
  };

  const handleFieldChange = (field: keyof OfficialLeaveBooklet, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isStaffFormLocked = mode !== 'STAFF_APPLY' && mode !== 'VIEW_ONLY';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formData, false);
      }}
      className="space-y-8 max-w-5xl mx-auto p-4 md:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs"
    >
      {/* Booklet Header Banner */}
      <div className="border-b border-slate-200 pb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#006533] uppercase tracking-wider">
            <ShieldCheck size={16} /> National Open University of Nigeria
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Official Statutory Leave Booklet (26-Point Schedule)
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Form NOUN/HR/LV-26 • Directorate of Human Resources
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-right">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Leave Year</span>
            <span className="text-sm font-black text-[#006533]">{formData.leaveYear}</span>
          </div>
        </div>
      </div>

      {/* ── PART A: STAFF PARTICULARS & LEAVE SCHEDULE (ITEMS 1 - 17) ── */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 md:p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-[#006533] flex items-center gap-2">
            <User size={16} /> Part A: Staff Particulars &amp; Leave Request Schedule (Items 1 – 17)
          </h3>
          <span className="text-[11px] font-bold text-slate-400">Applicant Form</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Leave Year */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">1. Leave Year *</label>
            <input
              type="number"
              required
              min={2020}
              max={2040}
              value={formData.leaveYear}
              onChange={(e) => handleFieldChange('leaveYear', parseInt(e.target.value, 10))}
              disabled={isStaffFormLocked}
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
          </div>

          {/* 2. Staff No */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">2. Staff No *</label>
            <input
              type="text"
              required
              value={formData.staffNo}
              onChange={(e) => handleFieldChange('staffNo', e.target.value)}
              disabled={isStaffFormLocked}
              placeholder="e.g. 00002 or NOUN/ACA/104"
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
          </div>

          {/* 3. Full Name: (Surname First) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">3. Full Name: (Surname First) *</label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => handleFieldChange('fullName', e.target.value)}
              disabled={isStaffFormLocked}
              placeholder="SURNAME, First Name Middle Name"
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
          </div>

          {/* 4. Designation */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">4. Designation / Rank *</label>
            <input
              type="text"
              required
              value={formData.designation}
              onChange={(e) => handleFieldChange('designation', e.target.value)}
              disabled={isStaffFormLocked}
              placeholder="e.g. Senior Lecturer / Chief Administrative Officer"
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
          </div>

          {/* 5. Salary Scale */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">5. Salary Scale *</label>
            <input
              type="text"
              required
              value={formData.salaryScale}
              onChange={(e) => handleFieldChange('salaryScale', e.target.value)}
              disabled={isStaffFormLocked}
              placeholder="e.g. CONUASS 05 Step 4 / CONTISS 13"
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
          </div>

          {/* 6. Date of Appointment */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">6. Date of Appointment *</label>
            <input
              type="date"
              required
              value={formData.dateOfAppointment}
              onChange={(e) => handleFieldChange('dateOfAppointment', e.target.value)}
              disabled={isStaffFormLocked}
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
          </div>

          {/* 7. Faculty / Department/ Study Center */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              7. Faculty / Department/ Study Center *
            </label>
            <input
              type="text"
              required
              value={formData.facultyDeptStudyCenter}
              onChange={(e) => handleFieldChange('facultyDeptStudyCenter', e.target.value)}
              disabled={isStaffFormLocked}
              placeholder="e.g. Faculty of Sciences / Department of Computer Science"
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
          </div>

          {/* 8. Location */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">8. Location / Station *</label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => handleFieldChange('location', e.target.value)}
              disabled={isStaffFormLocked}
              placeholder="e.g. Abuja HQ / Lagos Study Centre"
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
          </div>

          {/* 9. Phone No */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">9. Phone No *</label>
            <input
              type="tel"
              required
              value={formData.phoneNo}
              onChange={(e) => handleFieldChange('phoneNo', e.target.value)}
              disabled={isStaffFormLocked}
              placeholder="e.g. +234 803 000 0000"
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
          </div>

          {/* 10. Official Email */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">10. Official Email *</label>
            <input
              type="email"
              required
              value={formData.officialEmail}
              onChange={(e) => handleFieldChange('officialEmail', e.target.value)}
              disabled={isStaffFormLocked}
              placeholder="name@noun.edu.ng"
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
          </div>

          {/* 11. Date Resumed Duty from previous Leave */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              11. Date Resumed Duty from previous Leave
            </label>
            <input
              type="date"
              value={formData.dateResumedPreviousLeave}
              onChange={(e) => handleFieldChange('dateResumedPreviousLeave', e.target.value)}
              disabled={isStaffFormLocked}
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">Leave blank if first statutory leave</span>
          </div>

          {/* 12. Date Proceeding on Leave */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">12. Date Proceeding on Leave *</label>
            <input
              type="date"
              required
              value={formData.dateProceedingOnLeave}
              onChange={(e) => handleFieldChange('dateProceedingOnLeave', e.target.value)}
              disabled={isStaffFormLocked}
              className="w-full text-xs font-bold bg-emerald-50/50 border border-emerald-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
          </div>

          {/* 13. Date Leave Ends */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">13. Date Leave Ends *</label>
            <input
              type="date"
              required
              value={formData.dateLeaveEnds}
              onChange={(e) => handleLeaveEndDateChange(e.target.value)}
              disabled={isStaffFormLocked}
              className="w-full text-xs font-bold bg-emerald-50/50 border border-emerald-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
          </div>

          {/* 14. Date of Resumption of duty */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-[#006533] mb-1">
              14. Date of Resumption of duty *
            </label>
            <input
              type="date"
              required
              value={formData.dateOfResumption}
              onChange={(e) => handleFieldChange('dateOfResumption', e.target.value)}
              disabled={isStaffFormLocked}
              className="w-full text-xs font-bold bg-white border border-emerald-400 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
          </div>
        </div>

        {/* 15 - 16: Staff Signature & Date */}
        <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div>
            <SignaturePad
              label="15. Staff Signature *"
              value={formData.staffSignature}
              onChange={(sig) => handleFieldChange('staffSignature', sig)}
              signerName={formData.fullName}
              signerDesignation={formData.designation}
              disabled={isStaffFormLocked}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">16. Date of Staff Signature *</label>
            <input
              type="date"
              required
              value={formData.staffSignatureDate}
              onChange={(e) => handleFieldChange('staffSignatureDate', e.target.value)}
              disabled={isStaffFormLocked}
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#006533]"
            />
          </div>
        </div>

        {/* 17. Person responsible for duties during absence */}
        <div className="pt-4 border-t border-slate-200">
          <label className="block text-xs font-bold text-slate-700 mb-2">
            17. Person responsible for duties during absence (if applicable)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Relief Officer Full Name"
              value={formData.reliefOfficerName || ''}
              onChange={(e) => handleFieldChange('reliefOfficerName', e.target.value)}
              disabled={isStaffFormLocked}
              className="text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5"
            />
            <input
              type="text"
              placeholder="Relief Officer Staff ID"
              value={formData.reliefOfficerStaffId || ''}
              onChange={(e) => handleFieldChange('reliefOfficerStaffId', e.target.value)}
              disabled={isStaffFormLocked}
              className="text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5"
            />
            <input
              type="text"
              placeholder="Relief Officer Rank"
              value={formData.reliefOfficerRank || ''}
              onChange={(e) => handleFieldChange('reliefOfficerRank', e.target.value)}
              disabled={isStaffFormLocked}
              className="text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5"
            />
          </div>
        </div>
      </div>

      {/* ── PART B: IMMEDIATE SUPERVISOR / HOD (ITEMS 18 - 19) ── */}
      <div className={`border rounded-2xl p-5 md:p-6 space-y-4 ${mode === 'HOD_REVIEW' ? 'bg-amber-50/40 border-amber-300 ring-2 ring-amber-200' : 'bg-slate-50/50 border-slate-200'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Building size={16} className="text-[#006533]" /> Part B: Immediate Supervisor / HOD Recommendation (Items 18 – 19)
          </h3>
          <span className="text-[11px] font-bold text-slate-400">Supervisor Endorsement</span>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            18. Comment by the Immediate Supervisor (HOD in the case of Academic Staff)
          </label>
          <textarea
            rows={3}
            value={formData.supervisorComment || ''}
            onChange={(e) => handleFieldChange('supervisorComment', e.target.value)}
            disabled={mode !== 'HOD_REVIEW'}
            placeholder={mode === 'HOD_REVIEW' ? 'Enter supervisor recommendation and coverage confirmation...' : 'Pending HOD / Supervisor review'}
            className="w-full text-xs bg-white border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-[#006533]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <SignaturePad
            label="19. Supervisor Signature"
            value={formData.supervisorSignature}
            onChange={(sig) => handleFieldChange('supervisorSignature', sig)}
            signerName={formData.supervisorName || 'Immediate Supervisor / HOD'}
            signerDesignation="Head of Department"
            disabled={mode !== 'HOD_REVIEW'}
          />
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">19. Date of Supervisor Signature</label>
            <input
              type="date"
              value={formData.supervisorSignatureDate || ''}
              onChange={(e) => handleFieldChange('supervisorSignatureDate', e.target.value)}
              disabled={mode !== 'HOD_REVIEW'}
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5"
            />
          </div>
        </div>
      </div>

      {/* ── PART C: DEAN / DIRECTOR / HEAD OF UNIT (ITEMS 20 - 21) ── */}
      <div className={`border rounded-2xl p-5 md:p-6 space-y-4 ${mode === 'DEAN_REVIEW' ? 'bg-amber-50/40 border-amber-300 ring-2 ring-amber-200' : 'bg-slate-50/50 border-slate-200'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Award size={16} className="text-[#006533]" /> Part C: Dean / Director / Head of Unit Endorsement (Items 20 – 21)
          </h3>
          <span className="text-[11px] font-bold text-slate-400">Principal Officer / Dean / Director</span>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            20. Comment by Principal Officer, Dean, Director or Head of Unit
          </label>
          <textarea
            rows={3}
            value={formData.deanDirectorComment || ''}
            onChange={(e) => handleFieldChange('deanDirectorComment', e.target.value)}
            disabled={mode !== 'DEAN_REVIEW'}
            placeholder={mode === 'DEAN_REVIEW' ? 'Enter Dean / Director endorsement remarks...' : 'Pending Dean / Director review'}
            className="w-full text-xs bg-white border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-[#006533]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <SignaturePad
            label="21. Signature"
            value={formData.deanDirectorSignature}
            onChange={(sig) => handleFieldChange('deanDirectorSignature', sig)}
            signerName={formData.deanDirectorName || 'Dean / Director'}
            signerDesignation="Faculty Dean / Director"
            disabled={mode !== 'DEAN_REVIEW'}
          />
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">21. Date</label>
            <input
              type="date"
              value={formData.deanDirectorSignatureDate || ''}
              onChange={(e) => handleFieldChange('deanDirectorSignatureDate', e.target.value)}
              disabled={mode !== 'DEAN_REVIEW'}
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5"
            />
          </div>
        </div>
      </div>

      {/* ── PART D: DIRECTOR (HR) (ITEMS 22 - 24) ── */}
      <div className={`border rounded-2xl p-5 md:p-6 space-y-4 ${mode === 'HR_REVIEW' ? 'bg-emerald-50/40 border-emerald-300 ring-2 ring-emerald-200' : 'bg-slate-50/50 border-slate-200'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-sm font-black uppercase tracking-wider text-[#006533] flex items-center gap-2">
            <ShieldCheck size={16} /> Part D: Directorate of Human Resources Clearance (Items 22 – 24)
          </h3>
          <span className="text-[11px] font-bold text-slate-400">Director, Human Resources</span>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">22. Comment by the Director (HR)</label>
          <textarea
            rows={3}
            value={formData.directorHrComment || ''}
            onChange={(e) => handleFieldChange('directorHrComment', e.target.value)}
            disabled={mode !== 'HR_REVIEW'}
            placeholder={mode === 'HR_REVIEW' ? 'Enter statutory leave entitlement clearance and recommendation...' : 'Pending Directorate of HR verification'}
            className="w-full text-xs bg-white border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-[#006533]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <SignaturePad
            label="23. Signature of Director / HR"
            value={formData.directorHrSignature}
            onChange={(sig) => handleFieldChange('directorHrSignature', sig)}
            signerName={formData.directorHrName || 'Director, Human Resources'}
            signerDesignation="Director (HR)"
            disabled={mode !== 'HR_REVIEW'}
          />
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">24. Date of Director / HR Signature</label>
            <input
              type="date"
              value={formData.directorHrSignatureDate || ''}
              onChange={(e) => handleFieldChange('directorHrSignatureDate', e.target.value)}
              disabled={mode !== 'HR_REVIEW'}
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5"
            />
          </div>
        </div>
      </div>

      {/* ── PART E: THE UNIVERSITY REGISTRAR (ITEMS 25 - 26) ── */}
      <div className={`border rounded-2xl p-5 md:p-6 space-y-4 ${mode === 'REGISTRAR_REVIEW' ? 'bg-emerald-50/60 border-emerald-400 ring-2 ring-emerald-300' : 'bg-slate-50/50 border-slate-200'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-sm font-black uppercase tracking-wider text-[#006533] flex items-center gap-2">
            <Award size={16} /> Part E: The University Registrar Official Approval (Items 25 – 26)
          </h3>
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
            Final Approval Authority
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">25. Comment(s) by the Registrar</label>
          <textarea
            rows={3}
            value={formData.registrarComment || ''}
            onChange={(e) => handleFieldChange('registrarComment', e.target.value)}
            disabled={mode !== 'REGISTRAR_REVIEW'}
            placeholder={mode === 'REGISTRAR_REVIEW' ? 'Enter University Registrar final approval decision and conditions...' : 'Pending University Registrar final approval'}
            className="w-full text-xs bg-white border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-[#006533]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <SignaturePad
            label="26. Signature of Registrar / Official Seal"
            value={formData.registrarSignature}
            onChange={(sig) => handleFieldChange('registrarSignature', sig)}
            signerName={formData.registrarName || 'University Registrar'}
            signerDesignation="University Registrar"
            disabled={mode !== 'REGISTRAR_REVIEW'}
          />
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">26. Date of Registrar Signature</label>
            <input
              type="date"
              value={formData.registrarSignatureDate || ''}
              onChange={(e) => handleFieldChange('registrarSignatureDate', e.target.value)}
              disabled={mode !== 'REGISTRAR_REVIEW'}
              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5"
            />
          </div>
        </div>
      </div>

      {/* Form Bottom Submission Bar */}
      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
        )}

        <div className="flex items-center gap-3 ml-auto">
          {mode === 'STAFF_APPLY' && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onSubmit(formData, true)}
              className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
            >
              <Save size={14} /> Save Draft
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="text-xs font-black text-white bg-[#006533] hover:bg-emerald-800 px-6 py-2.5 rounded-xl transition flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Send size={15} />{' '}
                {mode === 'STAFF_APPLY'
                  ? 'Submit Official Leave Booklet'
                  : 'Endorse & Save Review'}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
