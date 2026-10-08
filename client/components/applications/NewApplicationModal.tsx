'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, ShieldCheck, Lock, Info, CheckCircle2, Paperclip, Upload, FileText, Trash2, Loader2, Link2 } from 'lucide-react';

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
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
  { value: 'NORMAL', label: 'Normal / Routine (Standard Processing)' },
  { value: 'URGENT', label: 'Urgent (24-48 Hours Vetting)' },
  { value: 'HIGH_PRIORITY', label: 'High Priority / Immediate Action' }
];

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

export default function NewApplicationModal({ isOpen, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const isLeadership = Boolean(user && LEADERSHIP_ROLES.includes(user.role as string));

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState(isLeadership ? CATEGORIES[0].value : '');
  const [customCategory, setCustomCategory] = useState('');
  const [urgency, setUrgency] = useState('NORMAL');
  const [directorId, setDirectorId] = useState('');
  const [designatedDirector, setDesignatedDirector] = useState<DesignatedDirectorInfo | null>(null);
  const [content, setContent] = useState('');
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<{ name: string; size: number; url: string }[]>([]);
  const [newAttachment, setNewAttachment] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [directors, setDirectors] = useState<DirectorOption[]>([]);
  const [loadingDirectors, setLoadingDirectors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDirectors();
      setError(null);
      if (!isLeadership) {
        setUrgency('NORMAL');
      }
    }
  }, [isOpen, isLeadership]);

  const loadDirectors = async () => {
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

      if (res?.data?.designatedDirector) {
        setDesignatedDirector(res.data.designatedDirector);
        setDirectorId(res.data.designatedDirector.id);
      } else if (directorList.length > 0 && !directorId) {
        setDirectorId(directorList[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load eligible directors:', err);
    } finally {
      setLoadingDirectors(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    setError(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        let res: any;
        try {
          res = await api.post('/api/v1/applications/upload-attachment', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch {
          res = await api.post('/api/v1/applications/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }

        if (res.data?.url) {
          const fileUrl = res.data.url;
          setAttachmentUrls((prev) => [...prev, fileUrl]);
          setAttachmentFiles((prev) => [
            ...prev,
            { name: file.name, size: file.size, url: fileUrl },
          ]);
        }
      } catch (uploadErr: any) {
        console.error('Attachment upload failed:', uploadErr);
        setError(`Failed to upload ${file.name}. Please ensure it is under 50MB and in PDF/Word/Image format.`);
      }
    }

    setUploadingFiles(false);
    e.target.value = '';
  };

  const handleAddAttachment = () => {
    if (newAttachment.trim()) {
      const url = newAttachment.trim();
      setAttachmentUrls((prev) => [...prev, url]);
      setAttachmentFiles((prev) => [
        ...prev,
        { name: url.split('/').pop() || 'External Document', size: 0, url },
      ]);
      setNewAttachment('');
      setShowUrlInput(false);
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachmentUrls((prev) => prev.filter((_, i) => i !== idx));
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

    if (!subject.trim() || !content.trim()) {
      setError('Please provide both a subject and application content.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        subject: subject.trim(),
        category: effectiveCategory,
        urgency: isLeadership ? urgency : 'NORMAL',
        content: content.trim(),
        attachmentUrls
      };

      if (directorId) {
        payload.directorId = directorId;
      }

      let res: any;
      try {
        res = await api.post('/api/v1/applications/submit', payload);
      } catch (firstErr) {
        try {
          res = await api.post('/api/applications/submit', payload);
        } catch (fallbackErr: any) {
          throw fallbackErr?.response ? fallbackErr : firstErr;
        }
      }

      if (res.data?.success) {
        setSubject('');
        setContent('');
        setCustomCategory('');
        setAttachmentUrls([]);
        onSuccess();
        onClose();
      } else {
        setError(res.data?.error || res.data?.message || 'Failed to submit application.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.message || err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Institutional Application</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Statutory Routing: Staff &rarr; Designated Directorate Head &rarr; Registry Inward Desk &rarr; Registrar
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Auto-Detected Unit Head / Director Notification Card */}
          {designatedDirector && (
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
          )}

          {/* Designated Unit Head / Director Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1 flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-700" />
              Through Director (Designated Unit Head) *
            </label>
            <select
              value={directorId}
              onChange={(e) => setDirectorId(e.target.value)}
              disabled={loadingDirectors}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            >
              {designatedDirector && (
                <option value={designatedDirector.id}>
                  ✨ {designatedDirector.name} - {designatedDirector.unit || 'Designated Head'} (Auto-Detected)
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
            <p className="text-[11px] text-gray-500 mt-1">
              The system automatically pre-selects your Directorate / Unit Head for statutory vetting.
            </p>
          </div>

          {/* Category & Urgency Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category Field */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Application Category *
              </label>
              {isLeadership ? (
                /* Dropdown for Leadership */
                <div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  {category === 'OTHER' && (
                    <div className="mt-2.5">
                      <label className="block text-xs font-semibold text-emerald-800 mb-1">
                        Specify Official Application Category *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Special Duty Allowance, Facility Reallocation, Overtime Clearance..."
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50/40 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-slate-900"
                      />
                      <p className="text-[10px] text-emerald-700 mt-1">
                        Clearly specify the statutory purpose or category for this official application.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Free Text for Regular Staff */
                <div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sabbatical Leave, Office Transfer, Study Fellowship..."
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-200 bg-blue-50/40 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                  />
                  <p className="text-[10px] text-blue-600 mt-1">
                    Write your official category or purpose freely.
                  </p>
                </div>
              )}
            </div>

            {/* Priority / Urgency Field */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1 flex items-center justify-between">
                <span>Priority / Urgency</span>
                {!isLeadership && (
                  <span className="text-[10px] text-gray-400 font-normal flex items-center gap-0.5">
                    <Lock size={10} /> Leadership Only
                  </span>
                )}
              </label>
              {isLeadership ? (
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {URGENCIES.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div>
                  <input
                    type="text"
                    disabled
                    value="Routine / Normal (Standard Processing)"
                    className="w-full px-3 py-2 border border-gray-200 bg-gray-100 text-gray-500 rounded-lg text-sm cursor-not-allowed"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Standard statutory timeline. Priority escalation is managed by Unit Heads & Deans.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Subject / Title of Application *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Application for Study Fellowship (2026/2027 Session)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Formal Memorandum / Body Text *
            </label>
            <textarea
              required
              rows={6}
              placeholder="State your formal justification, dates, institutional details, and statutory references..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-sans"
            />
          </div>

          {/* Attachments Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700 uppercase flex items-center gap-1.5">
                <Paperclip size={13} className="text-blue-600" />
                Supporting Documents / Attachments (Optional)
              </label>
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Link2 size={12} />
                {showUrlInput ? 'Hide URL link' : '+ Add external link'}
              </button>
            </div>

            {/* File Upload Area */}
            <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-4 bg-slate-50/50 transition-colors">
              <label className="flex flex-col items-center justify-center cursor-pointer">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1">
                  {uploadingFiles ? (
                    <>
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      <span>Uploading documents...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span>Choose file(s) or drag & drop</span>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 text-center">
                  PDF, Word (.doc, .docx), PNG, JPG up to 50MB (scanned letters, admission slips, certificates)
                </p>
                <input
                  type="file"
                  multiple
                  disabled={uploadingFiles || submitting}
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="hidden"
                />
              </label>
            </div>

            {/* Optional URL input toggle */}
            {showUrlInput && (
              <div className="flex gap-2 animate-in fade-in duration-150">
                <input
                  type="url"
                  placeholder="https://... (direct link to scanned document)"
                  value={newAttachment}
                  onChange={(e) => setNewAttachment(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors"
                >
                  Add
                </button>
              </div>
            )}

            {/* Attached files list */}
            {attachmentFiles.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {attachmentFiles.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                    <div className="flex items-center gap-2 truncate max-w-md">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-semibold text-slate-800 truncate">{item.name}</span>
                      {item.size > 0 && (
                        <span className="text-[10px] text-slate-400 font-mono">({Math.round(item.size / 1024)} KB)</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(i)}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                      title="Remove attachment"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Routing Application...
                </>
              ) : (
                'Submit Application "Through Director"'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
