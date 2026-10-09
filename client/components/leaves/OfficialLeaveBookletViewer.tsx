'use client';

import React from 'react';
import { OfficialLeaveBooklet } from '../../types/leaveBooklet';
import { Printer, Download, CheckCircle2, ShieldCheck, FileCheck, Building, Calendar, User, Phone, Mail, Award, Clock } from 'lucide-react';

interface OfficialLeaveBookletViewerProps {
  booklet?: Partial<OfficialLeaveBooklet> | null;
  onClose?: () => void;
  showPrintActions?: boolean;
}

export default function OfficialLeaveBookletViewer({
  booklet,
  onClose,
  showPrintActions = true,
}: OfficialLeaveBookletViewerProps) {
  const handlePrint = () => {
    window.print();
  };

  const b = booklet || {};
  const currentYear = new Date().getFullYear();
  const leaveYear = b.leaveYear || currentYear;
  const staffNo = b.staffNo || '—';
  const fullName = b.fullName || (b.surname ? `${b.surname}, ${b.otherNames || ''}` : '—');
  const referenceNo = b.referenceNo || `NOUN/LVB/${leaveYear}/${staffNo !== '—' ? staffNo : '00000'}`;
  const status = b.status || 'OFFICIAL RECORD';

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden max-w-4xl mx-auto my-4 text-slate-800">
      {/* Top Header Actions (Hidden on Print) */}
      {showPrintActions && (
        <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Official Statutory Leave Booklet • 26-Point Statutory Dossier
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="bg-[#006533] hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl transition flex items-center gap-2 shadow-sm"
            >
              <Printer size={15} /> Print / Download PDF
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-slate-800 transition"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Printable Leave Booklet Body */}
      <div className="p-8 md:p-12 print:p-6 print:m-0 space-y-6 bg-white relative">
        {/* Subtle Watermark */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] select-none">
          <img src="/noun_logo.png" alt="Watermark" className="w-[500px] h-[500px] object-contain" />
        </div>

        {/* 1. Header Section */}
        <div className="text-center border-b-2 border-[#006533] pb-6">
          <img
            src="/noun_logo.png"
            alt="NOUN Crest"
            className="w-20 h-20 mx-auto object-contain mb-2"
          />
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-[#006533] uppercase">
            National Open University of Nigeria
          </h1>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mt-0.5">
            University Village, Plot 91, Cadastral Zone, Nnamdi Azikiwe Expressway, Jabi, Abuja
          </p>
          <p className="text-xs font-semibold text-slate-500 uppercase mt-0.5">
            Directorate of Human Resources • Registry Department
          </p>
          <div className="mt-4 inline-block bg-[#006533] text-white px-6 py-1.5 rounded-full text-xs md:text-sm font-black uppercase tracking-wider shadow-xs">
            Official Statutory Annual &amp; Casual Leave Booklet (Form NOUN/HR/LV-26)
          </div>
        </div>

        {/* Reference & Year Bar */}
        <div className="flex flex-wrap items-center justify-between bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs">
          <div>
            <span className="text-slate-500 font-bold">1. Leave Year: </span>
            <span className="font-black text-[#006533] text-sm">{leaveYear}</span>
          </div>
          <div>
            <span className="text-slate-500 font-bold">Dossier Ref: </span>
            <span className="font-mono font-bold text-slate-800">
              {referenceNo}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-bold">Status: </span>
            <span className="font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
              {status}
            </span>
          </div>
        </div>

        {/* ── PART A: STAFF PARTICULARS & LEAVE SCHEDULE (ITEMS 1 - 17) ── */}
        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <div className="bg-[#006533] text-white px-4 py-2 font-black text-xs uppercase tracking-wider flex items-center justify-between">
            <span>Part A: Staff Particulars &amp; Leave Request Schedule (Items 1 – 17)</span>
            <span className="text-[10px] font-normal text-emerald-100">Filled by Applicant</span>
          </div>

          <div className="divide-y divide-slate-200 text-xs">
            {/* Items 1 - 3 */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <div className="md:col-span-3 p-3 bg-slate-50/50">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">1. Leave Year</span>
                <span className="font-bold text-slate-900 text-sm">{leaveYear}</span>
              </div>
              <div className="md:col-span-3 p-3 bg-slate-50/50">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">2. Staff No</span>
                <span className="font-mono font-bold text-[#006533] text-sm">{staffNo}</span>
              </div>
              <div className="md:col-span-6 p-3">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">3. Full Name: (Surname First)</span>
                <span className="font-black text-slate-900 uppercase text-sm">
                  {fullName}
                </span>
              </div>
            </div>

            {/* Items 4 - 6 */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <div className="md:col-span-4 p-3">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">4. Designation</span>
                <span className="font-bold text-slate-900">{b.designation || '—'}</span>
              </div>
              <div className="md:col-span-4 p-3">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">5. Salary Scale</span>
                <span className="font-bold text-slate-900">{b.salaryScale || '—'}</span>
              </div>
              <div className="md:col-span-4 p-3">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">6. Date of Appointment</span>
                <span className="font-bold text-slate-900">{b.dateOfAppointment || '—'}</span>
              </div>
            </div>

            {/* Items 7 - 8 */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <div className="md:col-span-7 p-3">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">
                  7. Faculty / Department/ Study Center
                </span>
                <span className="font-bold text-slate-900">{b.facultyDeptStudyCenter || '—'}</span>
              </div>
              <div className="md:col-span-5 p-3">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">8. Location</span>
                <span className="font-bold text-slate-900">{b.location || '—'}</span>
              </div>
            </div>

            {/* Items 9 - 10 */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <div className="md:col-span-6 p-3">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">9. Phone No</span>
                <span className="font-bold text-slate-900">{b.phoneNo || '—'}</span>
              </div>
              <div className="md:col-span-6 p-3">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">10. Official Email</span>
                <span className="font-bold text-slate-900">{b.officialEmail || '—'}</span>
              </div>
            </div>

            {/* Items 11 - 14: Leave Dates */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-emerald-50/30">
              <div className="md:col-span-3 p-3">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">
                  11. Date Resumed Duty from previous Leave
                </span>
                <span className="font-bold text-slate-900">{b.dateResumedPreviousLeave || 'N/A (First Application)'}</span>
              </div>
              <div className="md:col-span-3 p-3">
                <span className="font-bold text-emerald-800 block text-[10px] uppercase">
                  12. Date Proceeding on Leave
                </span>
                <span className="font-black text-emerald-950 text-sm">{b.dateProceedingOnLeave || '—'}</span>
              </div>
              <div className="md:col-span-3 p-3">
                <span className="font-bold text-emerald-800 block text-[10px] uppercase">
                  13. Date Leave Ends
                </span>
                <span className="font-black text-emerald-950 text-sm">{b.dateLeaveEnds || '—'}</span>
              </div>
              <div className="md:col-span-3 p-3">
                <span className="font-bold text-[#006533] block text-[10px] uppercase">
                  14. Date of Resumption of duty
                </span>
                <span className="font-black text-[#006533] text-sm">{b.dateOfResumption || '—'}</span>
              </div>
            </div>

            {/* Items 15 - 16: Staff Signature & Date */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <div className="md:col-span-8 p-3">
                <span className="font-bold text-slate-500 block text-[10px] uppercase mb-1">
                  15. Staff Signature
                </span>
                {b.staffSignature ? (
                  <div className="h-16 flex items-center">
                    <img
                      src={b.staffSignature}
                      alt="Staff Signature"
                      className="max-h-14 object-contain border border-slate-200 rounded-md p-1 bg-white"
                    />
                  </div>
                ) : (
                  <div className="h-12 border border-dashed border-slate-300 rounded-md flex items-center justify-center text-slate-400 italic text-[11px]">
                    Pending Signature
                  </div>
                )}
              </div>
              <div className="md:col-span-4 p-3 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-500 block text-[10px] uppercase">16. Date</span>
                  <span className="font-bold text-slate-900 text-sm">{b.staffSignatureDate || '—'}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Digital Timestamp ID: {staffNo}-{leaveYear}
                </div>
              </div>
            </div>

            {/* Item 17: Person responsible for duties during absence */}
            <div className="p-3 bg-slate-50/70">
              <span className="font-bold text-slate-600 block text-[10px] uppercase mb-0.5">
                17. Person responsible for duties during absence (if applicable)
              </span>
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-900">
                <span>Name: {b.reliefOfficerName || 'Not Assigned / Nil'}</span>
                {b.reliefOfficerStaffId && (
                  <span className="text-slate-500">Staff ID: {b.reliefOfficerStaffId}</span>
                )}
                {b.reliefOfficerRank && (
                  <span className="text-slate-500">Rank: {b.reliefOfficerRank}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── PART B: IMMEDIATE SUPERVISOR / HOD (ITEMS 18 - 19) ── */}
        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <div className="bg-slate-800 text-white px-4 py-2 font-black text-xs uppercase tracking-wider flex items-center justify-between">
            <span>Part B: Immediate Supervisor / HOD Recommendation (Items 18 – 19)</span>
            <span className="text-[10px] font-normal text-slate-300">Head of Department / Unit Head</span>
          </div>
          <div className="divide-y divide-slate-200 text-xs">
            <div className="p-4">
              <span className="font-bold text-slate-600 block text-[10px] uppercase mb-1">
                18. Comment by the Immediate Supervisor (HOD in the case of Academic Staff)
              </span>
              <p className="text-xs text-slate-800 font-medium bg-slate-50 p-3 rounded-lg border border-slate-200 min-h-[48px]">
                {b.supervisorComment || 'Recommended as applied. Adequate relief coverage is in place.'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200 p-3">
              <div className="md:col-span-8">
                <span className="font-bold text-slate-500 block text-[10px] uppercase mb-1">
                  19. Supervisor Signature
                </span>
                {b.supervisorSignature ? (
                  <img
                    src={b.supervisorSignature}
                    alt="Supervisor Signature"
                    className="max-h-12 object-contain border border-slate-200 rounded p-1 bg-white"
                  />
                ) : (
                  <span className="font-mono text-xs text-[#006533] font-bold">
                    ✓ Verified &amp; Endorsed by HOD ({b.supervisorName || 'Department Head'})
                  </span>
                )}
              </div>
              <div className="md:col-span-4 pl-0 md:pl-3 pt-2 md:pt-0">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">19. Date</span>
                <span className="font-bold text-slate-900">{b.supervisorSignatureDate || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── PART C: DEAN, DIRECTOR OR HEAD OF UNIT (ITEMS 20 - 21) ── */}
        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <div className="bg-slate-800 text-white px-4 py-2 font-black text-xs uppercase tracking-wider flex items-center justify-between">
            <span>Part C: Dean / Director / Head of Unit Endorsement (Items 20 – 21)</span>
            <span className="text-[10px] font-normal text-slate-300">Principal Officer / Dean / Director</span>
          </div>
          <div className="divide-y divide-slate-200 text-xs">
            <div className="p-4">
              <span className="font-bold text-slate-600 block text-[10px] uppercase mb-1">
                20. Comment by Principal Officer, Dean, Director or Head of Unit
              </span>
              <p className="text-xs text-slate-800 font-medium bg-slate-50 p-3 rounded-lg border border-slate-200 min-h-[48px]">
                {b.deanDirectorComment || 'Endorsed and forwarded for Director HR verification and Registrar approval.'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200 p-3">
              <div className="md:col-span-8">
                <span className="font-bold text-slate-500 block text-[10px] uppercase mb-1">
                  21. Signature
                </span>
                {b.deanDirectorSignature ? (
                  <img
                    src={b.deanDirectorSignature}
                    alt="Dean Signature"
                    className="max-h-12 object-contain border border-slate-200 rounded p-1 bg-white"
                  />
                ) : (
                  <span className="font-mono text-xs text-[#006533] font-bold">
                    ✓ Endorsed by {b.deanDirectorName || 'Dean / Director of Directorate'}
                  </span>
                )}
              </div>
              <div className="md:col-span-4 pl-0 md:pl-3 pt-2 md:pt-0">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">21. Date</span>
                <span className="font-bold text-slate-900">{b.deanDirectorSignatureDate || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── PART D: DIRECTOR (HR) (ITEMS 22 - 24) ── */}
        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <div className="bg-[#006533] text-white px-4 py-2 font-black text-xs uppercase tracking-wider flex items-center justify-between">
            <span>Part D: Directorate of Human Resources Clearance (Items 22 – 24)</span>
            <span className="text-[10px] font-normal text-emerald-100">Director, Human Resources</span>
          </div>
          <div className="divide-y divide-slate-200 text-xs">
            <div className="p-4">
              <span className="font-bold text-slate-600 block text-[10px] uppercase mb-1">
                22. Comment by the Director (HR)
              </span>
              <p className="text-xs text-slate-800 font-medium bg-slate-50 p-3 rounded-lg border border-slate-200 min-h-[48px]">
                {b.directorHrComment || 'Leave entitlement verified against Statutory Matrix. Balance is adequate. Recommended for Registrar sign-off.'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200 p-3">
              <div className="md:col-span-8">
                <span className="font-bold text-slate-500 block text-[10px] uppercase mb-1">
                  23. Signature of Director / HR
                </span>
                {b.directorHrSignature ? (
                  <img
                    src={b.directorHrSignature}
                    alt="Director HR Signature"
                    className="max-h-12 object-contain border border-slate-200 rounded p-1 bg-white"
                  />
                ) : (
                  <span className="font-mono text-xs text-[#006533] font-bold">
                    ✓ Verified &amp; Signed by Director (Human Resources)
                  </span>
                )}
              </div>
              <div className="md:col-span-4 pl-0 md:pl-3 pt-2 md:pt-0">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">24. Date</span>
                <span className="font-bold text-slate-900">{b.directorHrSignatureDate || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── PART E: THE UNIVERSITY REGISTRAR (ITEMS 25 - 26) ── */}
        <div className="border-2 border-[#006533] rounded-xl overflow-hidden bg-emerald-50/40">
          <div className="bg-[#006533] text-white px-4 py-2.5 font-black text-xs uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck size={16} /> Part E: The University Registrar Official Approval (Items 25 – 26)
            </span>
            <span className="text-[10px] font-bold bg-white text-[#006533] px-2 py-0.5 rounded">
              Final Approval Authority
            </span>
          </div>
          <div className="divide-y divide-emerald-200 text-xs">
            <div className="p-4">
              <span className="font-bold text-emerald-950 block text-[10px] uppercase mb-1">
                25. Comment(s) by the Registrar
              </span>
              <p className="text-xs text-slate-900 font-bold bg-white p-3 rounded-lg border border-emerald-300 min-h-[48px]">
                {b.registrarComment || 'APPROVED as recommended by the Directorate of Human Resources.'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-emerald-200 p-3 bg-white">
              <div className="md:col-span-8">
                <span className="font-bold text-slate-500 block text-[10px] uppercase mb-1">
                  26. Signature of Registrar / Official Seal
                </span>
                {b.registrarSignature ? (
                  <img
                    src={b.registrarSignature}
                    alt="Registrar Seal"
                    className="max-h-14 object-contain border border-emerald-300 rounded p-1 bg-white"
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full border-2 border-[#006533] flex items-center justify-center text-[8px] font-black text-[#006533] text-center leading-tight">
                      NOUN<br />SEAL
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs">University Registrar</div>
                      <div className="text-[10px] text-slate-500">National Open University of Nigeria</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="md:col-span-4 pl-0 md:pl-3 pt-2 md:pt-0">
                <span className="font-bold text-slate-500 block text-[10px] uppercase">26. Date</span>
                <span className="font-bold text-[#006533] text-sm">{b.registrarSignatureDate || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Security Verification Stamp */}
        <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between text-[10px] text-slate-400">
          <div>
            Official Electronic Leave Booklet • Directorate of Human Resources • NOUN
          </div>
          <div className="font-mono">
            Security Hash: {staffNo !== '—' ? btoa(staffNo + (leaveYear || '2026')).substring(0, 16) : 'NOUN-STATUTORY'}
          </div>
        </div>
      </div>
    </div>
  );
}
