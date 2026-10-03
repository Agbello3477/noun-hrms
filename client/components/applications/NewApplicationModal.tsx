'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, ShieldCheck, Lock, Info, CheckCircle2 } from 'lucide-react';

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
  { value: 'ADMINISTRATIVE_APPEAL', label: 'Administrative Appeal' }
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
  const [newAttachment, setNewAttachment] = useState('');
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
      const res = await api.get('/api/v1/applications/eligible-directors');
      const directorList: DirectorOption[] = res.data?.directors || res.data?.data || [];
      setDirectors(directorList);

      if (res.data?.designatedDirector) {
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

  const handleAddAttachment = () => {
    if (newAttachment.trim()) {
      setAttachmentUrls((prev) => [...prev, newAttachment.trim()]);
      setNewAttachment('');
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachmentUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const effectiveCategory = isLeadership ? category : (customCategory.trim() || 'General Application');

    if (!subject.trim() || !content.trim()) {
      setError('Please provide both a subject and application content.');
      return;
    }

    if (!isLeadership && !customCategory.trim()) {
      setError('Please write your application category.');
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

      const res = await api.post('/api/v1/applications/submit', payload);

      if (res.data?.success) {
        setSubject('');
        setContent('');
        setCustomCategory('');
        setAttachmentUrls([]);
        onSuccess();
        onClose();
      } else {
        setError(res.data?.error || 'Failed to submit application.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Submission failed');
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
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Supporting Document Links / Storage URLs
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://... (link to scanned letter, admission notice, etc.)"
                value={newAttachment}
                onChange={(e) => setNewAttachment(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddAttachment}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Add URL
              </button>
            </div>
            {attachmentUrls.length > 0 && (
              <ul className="mt-2 space-y-1">
                {attachmentUrls.map((url, i) => (
                  <li key={i} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="truncate max-w-md text-blue-600">{url}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(i)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
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
