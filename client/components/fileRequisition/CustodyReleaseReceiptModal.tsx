'use client';

import React, { useRef } from 'react';
import {
  X,
  Printer,
  ShieldCheck,
  FileText,
  Clock,
  Building2,
  UserCheck,
  QrCode,
  Download,
  ExternalLink,
} from 'lucide-react';

interface CustodyReleaseReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  requisition: any;
  onViewDigital?: () => void;
}

export const CustodyReleaseReceiptModal: React.FC<CustodyReleaseReceiptModalProps> = ({
  isOpen,
  onClose,
  requisition,
  onViewDigital,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !requisition) return null;

  const handlePrint = () => {
    window.print();
  };

  const subject = requisition.staffProfile;
  const subjectUser = subject?.user;
  const requester = requisition.requester;
  const hasDigitalFormat =
    requisition.requestedFileFormat === 'DIGITAL_TRANSCRIPT' ||
    requisition.requestedFileFormat === 'BOTH';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-title"
    >
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header Action Bar (Hidden in Print) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Official Custody Gatepass
            </span>
            <span className="text-xs font-mono font-medium text-slate-500">
              {requisition.dispatchReceiptNumber || requisition.requisitionNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasDigitalFormat && onViewDigital && (
              <button
                type="button"
                onClick={onViewDigital}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-200"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View Digital Dossier
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print Gatepass
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Certificate Content */}
        <div ref={printRef} className="p-8 space-y-6 print:p-0 print:space-y-4 text-slate-800">
          {/* Institutional Crest & Header */}
          <div className="border-b-2 border-[#006533] pb-5 text-center">
            <div className="flex justify-center mb-3">
              <img
                src="/noun_logo.png"
                alt="National Open University of Nigeria"
                className="h-16 w-16 object-contain"
              />
            </div>
            <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
              National Open University of Nigeria
            </h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Directorate of Registry & Personnel Records Management
            </p>
            <p className="text-[11px] text-slate-500">
              Plot 91, Cadastral Zone, Nnamdi Azikiwe Expressway, Jabi, Abuja, Nigeria
            </p>
            <div className="mt-3 inline-block bg-slate-900 text-white text-[11px] font-bold uppercase tracking-widest px-4 py-1 rounded-sm">
              Official Personnel File Custody Release Certificate & Dispatch Gatepass
            </div>
          </div>

          {/* Reference Folio Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Dispatch Receipt No
              </span>
              <span className="font-mono font-bold text-slate-900 text-xs">
                {requisition.dispatchReceiptNumber || 'PENDING DISPATCH'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Requisition Reference
              </span>
              <span className="font-mono font-bold text-slate-900 text-xs">
                {requisition.requisitionNumber}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Vault Folio Reference
              </span>
              <span className="font-mono font-bold text-emerald-800 text-xs">
                {requisition.registryFolioReference || 'NOUN/FOLIO/VAULT'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Date Dispatched
              </span>
              <span className="font-medium text-slate-900 text-xs">
                {requisition.dispatchedAt
                  ? new Date(requisition.dispatchedAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'N/A'}
              </span>
            </div>
          </div>

          {/* Subject Personnel Details */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <FileText className="w-3.5 h-3.5 text-emerald-700" /> Subject Personnel Record
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Staff Full Name</span>
                <span className="font-bold text-slate-900">{subjectUser?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Staff Identity Number</span>
                <span className="font-mono font-bold text-emerald-800">{subject?.staffId || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Designation / Rank</span>
                <span className="font-medium text-slate-800">{subject?.rank || 'Staff'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Department / Directorate</span>
                <span className="font-medium text-slate-800">{subject?.department || 'Registry'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Salary Scale / Level</span>
                <span className="font-medium text-slate-800">
                  {subject?.level ? `${subject.level} (Step ${subject?.step || '1'})` : 'CONTISS'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Employment Category</span>
                <span className="font-medium text-slate-800">{subject?.employmentCategory || 'PERMANENT'}</span>
              </div>
            </div>
          </div>

          {/* Requisition & Custody Scope */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Building2 className="w-3.5 h-3.5 text-emerald-700" /> Requisition Authorization Scope
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Requisitioning Officer</span>
                <span className="font-semibold text-slate-900">{requester?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Requesting Department</span>
                <span className="font-semibold text-slate-900">{requisition.requesterDepartment}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Urgency Classification</span>
                <span className="inline-flex items-center rounded-sm bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                  {requisition.urgencyLevel}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">File Medium / Format</span>
                <span className="font-semibold text-slate-900">{requisition.requestedFileFormat}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Expected Vault Return Date</span>
                <span className="font-medium text-slate-800">
                  {requisition.expectedReturnDate
                    ? new Date(requisition.expectedReturnDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Statutory Duration (14 Days)'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Custody Status</span>
                <span className="font-bold text-emerald-800">{requisition.status}</span>
              </div>
            </div>

            <div className="pt-2 text-xs">
              <span className="text-slate-500 block text-[10px] uppercase">Statutory Purpose of Release</span>
              <p className="mt-1 rounded-md bg-slate-50 p-2.5 text-slate-700 text-xs italic border border-slate-100">
                &ldquo;{requisition.purposeOfRequest}&rdquo;
              </p>
            </div>
          </div>

          {/* Dual-Control Signatures & Statutory Verification */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <UserCheck className="w-3.5 h-3.5 text-emerald-700" /> Executive Dual-Control & Chain of Custody
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-lg bg-emerald-50/50 p-3 border border-emerald-100 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block">
                  Registrar Executive Clearance
                </span>
                <p className="font-semibold text-slate-900">
                  {requisition.authorizedBy?.name || 'University Registrar'}
                </p>
                <p className="text-[11px] text-slate-600 italic">
                  &ldquo;{requisition.registrarRemarks || 'Release authorized under NOUN statutory custody rules.'}&rdquo;
                </p>
                <p className="text-[10px] text-slate-500 pt-1">
                  Timestamp:{' '}
                  {requisition.authorizedAt
                    ? new Date(requisition.authorizedAt).toLocaleString('en-GB')
                    : 'N/A'}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
                  Registry Vault Dispatch Officer
                </span>
                <p className="font-semibold text-slate-900">
                  {requisition.dispatchedBy?.name || requisition.acknowledgedBy?.name || 'Records Custodian'}
                </p>
                <p className="text-[11px] text-slate-600">
                  Notes: {requisition.trackingNotes || 'Handover verified and recorded in Registry Master Ledger.'}
                </p>
                <p className="text-[10px] text-slate-500 pt-1">
                  Folio Tag: {requisition.registryFolioReference || 'Vault Verified'}
                </p>
              </div>
            </div>
          </div>

          {/* Security Gatepass & Legal Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-[10px] text-slate-500">
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-700">
                OFFICIAL SECURITY GATEPASS NOTICE:
              </p>
              <p>
                This gatepass authorizes physical carriage or secure single-session inspection of confidential NOUN personnel records.
              </p>
              <p>
                Unauthorized copying, alteration, or delayed vault return constitutes an institutional security violation.
              </p>
            </div>
            <div className="flex items-center gap-2 border border-slate-300 rounded-lg p-2 bg-slate-50">
              <QrCode className="w-10 h-10 text-slate-800" />
              <div className="text-[9px] font-mono leading-tight">
                <div>VERIFIED</div>
                <div>NOUN-VAULT</div>
                <div>SECURE</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
