'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  CheckSquare,
  Square,
  Sparkles,
  Building2,
  Users,
  Check,
} from 'lucide-react';

interface StaffOption {
  id: string;
  staffId?: string;
  rank?: string;
  title?: string;
  surname?: string;
  otherNames?: string;
  department?: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
    role?: string;
  };
  unit?: {
    id: string;
    name: string;
    type?: string;
  };
  studyCenter?: {
    id: string;
    name: string;
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
  const [loadingContext, setLoadingContext] = useState(false);
  const [eligibleStaff, setEligibleStaff] = useState<StaffOption[]>([]);
  const [selectedStaffList, setSelectedStaffList] = useState<StaffOption[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [requesterDepartment, setRequesterDepartment] = useState(defaultDepartment);
  const [detectedDepartment, setDetectedDepartment] = useState('');
  const [purposeOfRequest, setPurposeOfRequest] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState<
    'ROUTINE' | 'URGENT' | 'STATUTORY_AUDIT' | 'LEGAL_SUBPOENA'
  >('ROUTINE');
  const [requestedFileFormat, setRequestedFileFormat] = useState<
    'PHYSICAL_HARDCOPY' | 'DIGITAL_TRANSCRIPT' | 'BOTH'
  >('PHYSICAL_HARDCOPY');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch unit scope staff and auto-detected department when modal opens
  useEffect(() => {
    if (isOpen) {
      loadContextAndStaff();
    } else {
      // Reset state on close
      setSelectedStaffList([]);
      setStaffSearch('');
      setIsDropdownOpen(false);
      setErrorMsg('');
    }
  }, [isOpen]);

  const loadContextAndStaff = async () => {
    setLoadingContext(true);
    setErrorMsg('');
    try {
      const res = await api.get('/api/v1/registry/file-requests/eligible-staff');
      if (res.data?.success) {
        const staff: StaffOption[] = res.data.staff || [];
        setEligibleStaff(staff);
        if (res.data.requestingDepartment) {
          setRequesterDepartment(res.data.requestingDepartment);
          setDetectedDepartment(res.data.requestingDepartment);
        }
      }
    } catch (err: any) {
      console.error('Failed to load eligible unit staff:', err);
      // Fallback search load if needed
      try {
        const fallbackRes = await api.get('/api/staff?limit=100');
        const items = fallbackRes.data?.data || fallbackRes.data?.staff || fallbackRes.data || [];
        setEligibleStaff(Array.isArray(items) ? items : []);
      } catch {}
    } finally {
      setLoadingContext(false);
    }
  };

  // Filtered staff in dropdown
  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return eligibleStaff;
    const q = staffSearch.toLowerCase();
    return eligibleStaff.filter((s) => {
      const name = s.user?.name?.toLowerCase() || '';
      const staffId = s.staffId?.toLowerCase() || '';
      const rank = s.rank?.toLowerCase() || '';
      const email = s.user?.email?.toLowerCase() || '';
      const unit = s.unit?.name?.toLowerCase() || '';
      return (
        name.includes(q) ||
        staffId.includes(q) ||
        rank.includes(q) ||
        email.includes(q) ||
        unit.includes(q)
      );
    });
  }, [eligibleStaff, staffSearch]);

  const toggleStaffSelection = (staff: StaffOption) => {
    setSelectedStaffList((prev) => {
      const exists = prev.some((s) => s.id === staff.id);
      if (exists) {
        return prev.filter((s) => s.id !== staff.id);
      } else {
        return [...prev, staff];
      }
    });
  };

  const removeStaff = (staffId: string) => {
    setSelectedStaffList((prev) => prev.filter((s) => s.id !== staffId));
  };

  const handleSelectAllFiltered = () => {
    const newItems = [...selectedStaffList];
    filteredStaff.forEach((s) => {
      if (!newItems.some((item) => item.id === s.id)) {
        newItems.push(s);
      }
    });
    setSelectedStaffList(newItems);
  };

  const handleDeselectAll = () => {
    setSelectedStaffList([]);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (selectedStaffList.length === 0) {
      setErrorMsg('Please select at least one Subject Personnel Record from the dropdown.');
      return;
    }
    if (!requesterDepartment.trim()) {
      setErrorMsg('Please enter your requesting department or directorate.');
      return;
    }
    if (!purposeOfRequest.trim() || purposeOfRequest.trim().length < 15) {
      setErrorMsg(
        'Please provide a substantive official purpose for this file requisition (min 15 characters).'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/api/v1/registry/file-requests/lodge', {
        staffProfileIds: selectedStaffList.map((s) => s.id),
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
        setSelectedStaffList([]);
        setPurposeOfRequest('');
        setExpectedReturnDate('');
      } else {
        setErrorMsg(res.data?.error || 'Failed to submit file requisition.');
      }
    } catch (err: any) {
      console.error('Error lodging requisition:', err);
      setErrorMsg(
        err.response?.data?.error || 'Failed to submit file requisition. Please try again.'
      );
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
                Registry &amp; Records Directorate • Physical &amp; Digital Vault Custody
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

          {/* Auto-Detected Requesting Department Banner */}
          {detectedDepartment && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <div>
                  <span className="font-bold text-emerald-900">
                    Requesting Department Auto-Detected:
                  </span>{' '}
                  <span className="text-emerald-800 font-semibold">{detectedDepartment}</span>
                </div>
              </div>
              <span className="bg-emerald-200 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                Automatic
              </span>
            </div>
          )}

          {/* Subject Personnel Record Field (Multi-Select & Single-Select Dropdown) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-700" />
                Subject Personnel Record(s) <span className="text-rose-500">*</span>
              </label>
              {selectedStaffList.length > 0 && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {selectedStaffList.length} Staff Selected
                </span>
              )}
            </div>

            {/* Selected Staff Pills */}
            {selectedStaffList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl max-h-28 overflow-y-auto">
                {selectedStaffList.map((staff) => (
                  <span
                    key={staff.id}
                    className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 text-emerald-900 px-2.5 py-1 rounded-lg text-xs font-medium"
                  >
                    <span>
                      {staff.user?.name || staff.surname || 'Staff'} ({staff.staffId || 'ID N/A'})
                    </span>
                    <button
                      type="button"
                      onClick={() => removeStaff(staff.id)}
                      className="text-emerald-700 hover:text-rose-600 rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Dropdown Container */}
            <div className="relative">
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs bg-white cursor-pointer flex items-center justify-between hover:border-emerald-600 transition-colors"
              >
                <div className="flex items-center gap-2 text-slate-600 truncate">
                  <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>
                    {selectedStaffList.length === 0
                      ? 'Select staff from unit/study center dropdown (one or multiple)...'
                      : `Selected: ${selectedStaffList.length} staff member(s) - Click to modify selection`}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  {loadingContext && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    {eligibleStaff.length} in Unit
                  </span>
                </div>
              </div>

              {/* Dropdown Options Popup */}
              {isDropdownOpen && (
                <div className="absolute z-30 mt-1.5 w-full rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in-50 duration-150">
                  {/* Search inside dropdown */}
                  <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={staffSearch}
                        onChange={(e) => setStaffSearch(e.target.value)}
                        placeholder="Search unit staff by name, staff ID, rank..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white"
                        autoFocus
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 hover:bg-emerald-200 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Select All
                    </button>
                    {selectedStaffList.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="px-2 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* List of Staff Options */}
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {loadingContext ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-1" />
                        Loading unit staff records...
                      </div>
                    ) : filteredStaff.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No staff records found matching &quot;{staffSearch}&quot;
                      </div>
                    ) : (
                      filteredStaff.map((staff) => {
                        const isSelected = selectedStaffList.some((s) => s.id === staff.id);
                        return (
                          <div
                            key={staff.id}
                            onClick={() => toggleStaffSelection(staff)}
                            className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected ? 'bg-emerald-50/80' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-700 border-emerald-700 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3" />}
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {staff.user?.name || `${staff.surname || ''} ${staff.otherNames || ''}`.trim() || 'Staff'}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  <span className="font-mono font-medium text-slate-700">
                                    {staff.staffId || 'ID: N/A'}
                                  </span>{' '}
                                  • {staff.rank || 'Staff'} •{' '}
                                  {staff.unit?.name || staff.studyCenter?.name || staff.department || 'NOUN'}
                                </p>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                Selected
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="p-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {selectedStaffList.length} of {eligibleStaff.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(false)}
                      className="text-xs font-bold text-emerald-800 hover:text-emerald-950"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Select one or multiple personnel records in your unit, directorate, faculty, or study centre.
            </p>
          </div>

          {/* Department & Urgency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                Requesting Department / Unit <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={requesterDepartment}
                onChange={(e) => setRequesterDepartment(e.target.value)}
                placeholder="e.g. Directorate of Academic Planning"
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-slate-50/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
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
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
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
              placeholder="State the detailed institutional purpose for requesting confidential personnel file(s) (e.g., Annual APER verification, NUC Accreditation, Disciplinary Review, Transfer Consideration)..."
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
              disabled={isSubmitting || selectedStaffList.length === 0}
              aria-busy={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Lodging{' '}
                  {selectedStaffList.length > 1
                    ? `(${selectedStaffList.length} Files)...`
                    : 'Requisition...'}
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Submit to Registry Intake{' '}
                  {selectedStaffList.length > 1 ? `(${selectedStaffList.length} Files)` : ''}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
