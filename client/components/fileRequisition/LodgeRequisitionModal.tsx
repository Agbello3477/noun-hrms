'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  X,
  Send,
  Loader2,
  FolderPlus,
  AlertCircle,
  Search,
  User,
  Clock,
  FileCheck,
} from 'lucide-react';

interface StaffOption {
  id: string;
  staffId?: string;
  rank?: string;
  department?: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
}

interface LodgeRequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (requisition: any) => void;
  defaultDepartment?: string;
}

export const LodgeRequisitionModal: React.FC<LodgeRequisitionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultDepartment = '',
}) => {
  const [staffSearch, setStaffSearch] = useState('');
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffOption | null>(null);
  const [isSearchingStaff, setIsSearchingStaff] = useState(false);

  const [requesterDepartment, setRequesterDepartment] = useState(defaultDepartment);
  const [purposeOfRequest, setPurposeOfRequest] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState<'ROUTINE' | 'URGENT' | 'STATUTORY_AUDIT' | 'LEGAL_SUBPOENA'>('ROUTINE');
  const [requestedFileFormat, setRequestedFileFormat] = useState<'PHYSICAL_HARDCOPY' | 'DIGITAL_TRANSCRIPT' | 'BOTH'>('PHYSICAL_HARDCOPY');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (defaultDepartment && !requesterDepartment) {
      setRequesterDepartment(defaultDepartment);
    }
  }, [defaultDepartment, requesterDepartment]);

  // Debounced search for staff
  useEffect(() => {
    if (!staffSearch || staffSearch.trim().length < 2) {
      setStaffList([]);
      return;
    }

    const handler = setTimeout(async () => {
      setIsSearchingStaff(true);
      try {
        const res = await api.get(`/api/staff?search=${encodeURIComponent(staffSearch.trim())}&limit=10`);
        const items = res.data?.data || res.data?.staff || res.data || [];
        setStaffList(Array.isArray(items) ? items : []);
      } catch (err) {
        console.error('Failed to search staff:', err);
      } finally {
        setIsSearchingStaff(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [staffSearch]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedStaff?.id) {
      setErrorMsg('Please select a target staff member whose file is being requested.');
      return;
    }
    if (!requesterDepartment.trim()) {
      setErrorMsg('Please enter your department or directorate.');
      return;
    }
    if (!purposeOfRequest.trim() || purposeOfRequest.trim().length < 15) {
      setErrorMsg('Please provide a substantive official purpose for this file requisition (min 15 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/api/v1/registry/file-requests/lodge', {
        staffProfileId: selectedStaff.id,
        requesterDepartment: requesterDepartment.trim(),
        purposeOfRequest: purposeOfRequest.trim(),
        urgencyLevel,
        requestedFileFormat,
        expectedReturnDate: expectedReturnDate || undefined,
      });

      if (res.data?.success) {
        onSuccess(res.data.data);
        onClose();
        // Reset form
        setSelectedStaff(null);
        setStaffSearch('');
        setPurposeOfRequest('');
        setExpectedReturnDate('');
      } else {
        setErrorMsg(res.data?.error || 'Failed to submit file requisition.');
      }
    } catch (err: any) {
      console.error('Error lodging requisition:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to submit file requisition. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-emerald-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-800 text-emerald-200">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-base font-bold leading-tight">
                Lodge Personnel File Requisition
              </h2>
              <p className="text-xs text-emerald-200">
                Registry & Records Directorate • Physical & Digital Vault Custody
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-emerald-200 hover:bg-emerald-800 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start gap-3 rounded-xl bg-rose-50 p-3.5 text-xs text-rose-800 border border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Target Staff Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Subject Personnel Record <span className="text-rose-500">*</span>
            </label>
            {selectedStaff ? (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50/70 p-3 border border-emerald-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                    {selectedStaff.user?.name?.slice(0, 2).toUpperCase() || 'ST'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{selectedStaff.user?.name}</p>
                    <p className="text-[11px] text-slate-600">
                      ID: <span className="font-mono font-medium">{selectedStaff.staffId || 'N/A'}</span> • {selectedStaff.rank || 'Staff'} • {selectedStaff.department || 'NOUN'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStaff(null)}
                  className="text-xs font-semibold text-rose-600 hover:underline px-2 py-1"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    placeholder="Search staff by full name, staff ID, or email..."
                    className="w-full rounded-xl border border-slate-300 pl-9 pr-4 py-2.5 text-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                  {isSearchingStaff && (
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-3 top-3" />
                  )}
                </div>

                {staffList.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-xl divide-y divide-slate-100">
                    {staffList.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedStaff(s);
                          setStaffSearch('');
                          setStaffList([]);
                        }}
                        className="w-full text-left p-2.5 hover:bg-emerald-50/70 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900">{s.user?.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {s.staffId ? `ID: ${s.staffId}` : ''} • {s.department || 'NOUN'}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm">
                          Select
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Department & Urgency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Requesting Department / Unit <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={requesterDepartment}
                onChange={(e) => setRequesterDepartment(e.target.value)}
                placeholder="e.g. Directorate of Academic Planning"
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Urgency Classification <span className="text-rose-500">*</span>
              </label>
              <select
                value={urgencyLevel}
                onChange={(e: any) => setUrgencyLevel(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
              >
                <option value="ROUTINE">ROUTINE (Standard Institutional Review)</option>
                <option value="URGENT">URGENT (Time-Critical Committee/Board)</option>
                <option value="STATUTORY_AUDIT">STATUTORY AUDIT (External/NUC/Council)</option>
                <option value="LEGAL_SUBPOENA">LEGAL SUBPOENA (Court/Legal Process)</option>
              </select>
            </div>
          </div>

          {/* Format & Return Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Requested File Format <span className="text-rose-500">*</span>
              </label>
              <select
                value={requestedFileFormat}
                onChange={(e: any) => setRequestedFileFormat(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
              >
                <option value="PHYSICAL_HARDCOPY">PHYSICAL HARDCOPY (Vault Dossier Handover)</option>
                <option value="DIGITAL_TRANSCRIPT">DIGITAL TRANSCRIPT (Secure Single-Session View)</option>
                <option value="BOTH">BOTH (Physical Handover + Digital Transcript)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Expected Return Date (Vault SLA)
              </label>
              <input
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Purpose of Request */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Statutory Purpose of Requisition <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={purposeOfRequest}
              onChange={(e) => setPurposeOfRequest(e.target.value)}
              placeholder="State the detailed institutional purpose for requesting this confidential personnel file (e.g., Annual APER verification, NUC Accreditation, Disciplinary Review, Transfer Consideration)..."
              required
              className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 resize-none"
            />
            <p className="text-[10px] text-slate-400">
              Note: Under university governance statutes, personnel files require Registry vault intake and Registrar executive authorization prior to release.
            </p>
          </div>

          {/* Action Buttons with double-click protection */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedStaff}
              aria-busy={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Lodging Requisition...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Submit to Registry Intake
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
