'use client';

import { useRef } from 'react';
import { X, Printer, Download, CheckCircle2, Clock, AlertTriangle, Paperclip, ShieldCheck, Building, User, Calendar } from 'lucide-react';
import { getImageUrl } from '../../lib/api';

interface OfficialApplication {
    id: string;
    referenceNumber: string;
    applicantId: string;
    applicantName: string;
    applicantStaffId?: string | null;
    applicantRank?: string | null;
    applicantUnit?: string | null;
    applicantRole?: string | null;
    targetDirectorate: string;
    category: string;
    subject: string;
    content: string;
    urgency: string;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    status: string;
    submittedAt: string;
    acknowledgedAt?: string | null;
    registryStampNumber?: string | null;
    registryRemarks?: string | null;
    registryOfficerName?: string | null;
    registryOfficerDesignation?: string | null;
    metadata?: any;
    createdAt: string;
}

interface StampedAcknowledgmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    application: OfficialApplication | null;
}

export default function StampedAcknowledgmentModal({
    isOpen,
    onClose,
    application
}: StampedAcknowledgmentModalProps) {
    const printRef = useRef<HTMLDivElement>(null);

    if (!isOpen || !application) return null;

    const isAcknowledged = application.status === 'ACKNOWLEDGED' || !!application.registryStampNumber;

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return 'N/A';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    const formatDateTime = (dateStr: string | null | undefined) => {
        if (!dateStr) return 'N/A';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }) + ' @ ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        } catch {
            return dateStr;
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:rounded-none">
                {/* Modal Action Header (Hidden in Print) */}
                <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between print:hidden">
                    <div className="flex items-center gap-2.5">
                        <span className="bg-[#006533] text-white text-[10px] font-black px-2 py-0.5 rounded tracking-wider uppercase">
                            Official Document
                        </span>
                        <span className="text-xs text-slate-300 font-mono font-bold">
                            Ref: {application.referenceNumber}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="bg-[#006533] hover:bg-[#005028] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                        >
                            <Printer size={14} /> Print / Save PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Printable Document Container */}
                <div ref={printRef} className="p-8 sm:p-12 space-y-8 bg-white text-slate-900 font-sans text-xs sm:text-sm">
                    {/* NOUN Institutional Letterhead Header */}
                    <div className="border-b-2 border-[#006533] pb-4 text-center space-y-1">
                        <div className="flex items-center justify-center gap-3">
                            <div className="h-14 w-14 rounded-full bg-[#006533] text-white flex items-center justify-center font-black text-xl shadow-md border-2 border-emerald-300">
                                N
                            </div>
                            <div className="text-left">
                                <h1 className="text-lg sm:text-2xl font-black text-[#006533] tracking-tight uppercase">
                                    National Open University of Nigeria
                                </h1>
                                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                    Central Registry &amp; Directorate of Human Resources
                                </p>
                            </div>
                        </div>
                        <p className="text-[10px] sm:text-xs text-slate-500 pt-1 font-medium">
                            University Village, Plot 91, Cadastral Zone, Nnamdi Azikiwe Expressway, Jabi, Abuja, Nigeria • www.nou.edu.ng
                        </p>
                    </div>

                    {/* Metadata & Reference Block */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-2 border-b border-slate-100 text-xs">
                        <div className="space-y-1">
                            <div>
                                <span className="font-bold text-slate-500 uppercase">Document Ref: </span>
                                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                    {application.referenceNumber}
                                </span>
                            </div>
                            <div>
                                <span className="font-bold text-slate-500 uppercase">Category: </span>
                                <span className="font-semibold text-slate-800">{application.category.replace(/_/g, ' ')}</span>
                            </div>
                            <div>
                                <span className="font-bold text-slate-500 uppercase">Priority: </span>
                                <span className={`font-bold ${application.urgency === 'HIGH_PRIORITY' ? 'text-rose-700' : application.urgency === 'URGENT' ? 'text-amber-700' : 'text-slate-700'}`}>
                                    {application.urgency}
                                </span>
                            </div>
                        </div>

                        <div className="sm:text-right space-y-1">
                            <div>
                                <span className="font-bold text-slate-500 uppercase">Date Submitted: </span>
                                <span className="font-bold text-slate-900">{formatDate(application.submittedAt || application.createdAt)}</span>
                            </div>
                            <div>
                                <span className="font-bold text-slate-500 uppercase">Registry Status: </span>
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    isAcknowledged ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}>
                                    {isAcknowledged ? 'ACKNOWLEDGED & STAMPED' : 'PENDING REGISTRY ACKNOWLEDGMENT'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Sender & Addressee */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 text-xs">
                        <div>
                            <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block mb-1">
                                From (Applicant / Directorate):
                            </span>
                            <div className="font-bold text-slate-900 text-sm">{application.applicantName}</div>
                            <div className="text-slate-600 font-medium">{application.applicantRank || 'Staff'}</div>
                            <div className="text-emerald-800 font-bold">{application.applicantUnit || 'Unit / Directorate'}</div>
                            {application.applicantStaffId && (
                                <div className="text-slate-500 text-[11px] font-mono mt-0.5">Staff ID: {application.applicantStaffId}</div>
                            )}
                        </div>

                        <div>
                            <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block mb-1">
                                To (Recipient):
                            </span>
                            <div className="font-bold text-slate-900 text-sm">The Registrar</div>
                            <div className="text-slate-600 font-medium">Directorate of Human Resources &amp; Central Registry</div>
                            <div className="text-slate-700 font-bold">National Open University of Nigeria, Abuja</div>
                        </div>
                    </div>

                    {/* Subject Line */}
                    <div className="space-y-1">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Subject:</div>
                        <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase underline decoration-2 decoration-emerald-700 underline-offset-4">
                            {application.subject}
                        </h2>
                    </div>

                    {/* Formal Letter Body */}
                    <div className="whitespace-pre-wrap font-serif text-slate-800 leading-relaxed text-sm sm:text-base border-l-2 border-slate-200 pl-4 py-2">
                        {application.content}
                    </div>

                    {/* Attachment Info (If any) */}
                    {application.attachmentUrl && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <Paperclip size={15} className="text-emerald-700" />
                                <span className="font-bold text-slate-800">Attached Supporting Document:</span>
                                <span className="text-slate-600">{application.attachmentName || 'Supporting Attachment'}</span>
                            </div>
                            <a
                                href={getImageUrl(application.attachmentUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-[#006533] hover:bg-[#005028] text-white px-2.5 py-1 rounded text-xs font-bold transition print:hidden"
                            >
                                View File
                            </a>
                        </div>
                    )}

                    {/* THE OFFICIAL NOUN REGISTRY ELECTRONIC STAMP SECTION */}
                    <div className="pt-6 border-t-2 border-dashed border-slate-200">
                        {isAcknowledged ? (
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-2xl bg-gradient-to-br from-emerald-50/60 to-slate-50 border-2 border-emerald-600/30">
                                {/* Left: Official Details */}
                                <div className="space-y-2 text-xs flex-1">
                                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                                        <ShieldCheck size={20} className="text-emerald-700" />
                                        Official Central Registry Acknowledgment Copy
                                    </div>
                                    <p className="text-slate-600">
                                        This document has been officially received, authenticated, and logged into the Central Registry electronic docket.
                                    </p>
                                    <div className="pt-1 text-slate-700 space-y-1">
                                        <div>
                                            <span className="font-bold">Receiving Officer:</span> {application.registryOfficerName || 'Registry Officer'}
                                        </div>
                                        <div>
                                            <span className="font-bold">Designation:</span> {application.registryOfficerDesignation || 'Central Registry Receiving Desk'}
                                        </div>
                                        {application.registryRemarks && (
                                            <div className="pt-1 bg-white p-2.5 rounded-lg border border-emerald-200 text-emerald-950 font-medium">
                                                <span className="font-bold text-emerald-900 block text-[11px]">Registry Remarks:</span>
                                                {application.registryRemarks}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Authentic Circular / Boxed NOUN Registry Stamp */}
                                <div className="flex-shrink-0">
                                    <div className="w-56 border-4 border-double border-[#006533] p-3 rounded-2xl text-center bg-white shadow-md transform rotate-1 print:rotate-0 print:shadow-none">
                                        <div className="text-[10px] font-black text-[#006533] uppercase tracking-wider border-b border-[#006533]/40 pb-1">
                                            National Open University of Nigeria
                                        </div>
                                        <div className="py-2 text-[#006533] space-y-0.5">
                                            <div className="text-[11px] font-black tracking-widest uppercase bg-[#006533] text-white py-0.5 px-1 rounded-sm">
                                                ★ RECEIVED &amp; ACKNOWLEDGED ★
                                            </div>
                                            <div className="text-[10px] font-mono font-bold text-slate-800 pt-1">
                                                {formatDateTime(application.acknowledgedAt)}
                                            </div>
                                            <div className="text-[10px] font-mono font-black text-emerald-900 bg-emerald-50 border border-emerald-200 py-0.5 px-1 rounded">
                                                SERIAL: {application.registryStampNumber || 'REG-ACK-2026-0000'}
                                            </div>
                                        </div>
                                        <div className="text-[9px] font-bold text-[#006533] uppercase tracking-wider border-t border-[#006533]/40 pt-1">
                                            Central Registry • Directorate of HR
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-2">
                                <div className="inline-flex p-2 bg-amber-100 rounded-full text-amber-800 mb-1">
                                    <Clock size={24} />
                                </div>
                                <h3 className="font-bold text-amber-900 text-sm">Awaiting Registry Acknowledgment</h3>
                                <p className="text-xs text-amber-700 max-w-md mx-auto">
                                    This application has been submitted to Central Registry and is queued for verification, stamping, and official acknowledgment.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer Verification Notice */}
                    <div className="pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400 font-mono">
                        Generated by NOUN Unified Human Resource Management System (HRMS) • Electronic Document Verification ID: {application.referenceNumber}
                    </div>
                </div>
            </div>
        </div>
    );
}
