'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';

interface DirectorOption {
  id: string;
  name: string;
  email: string;
  unit?: string;
  department?: string;
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

export default function NewApplicationModal({ isOpen, onClose, onSuccess }: Props) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [directorId, setDirectorId] = useState('');
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
    }
  }, [isOpen]);

  const loadDirectors = async () => {
    try {
      setLoadingDirectors(true);
      const res = await api.get('/api/v1/applications/eligible-directors');
      if (res.data?.success) {
        setDirectors(res.data.directors || []);
        if (res.data.directors?.length > 0) {
          setDirectorId(res.data.directors[0].id);
        }
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

    if (!subject.trim() || !content.trim()) {
      setError('Please provide both a subject and application content.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        subject: subject.trim(),
        category,
        content: content.trim(),
        attachmentUrls
      };

      if (directorId) {
        payload.directorId = directorId;
      }

      const res = await api.post('/api/v1/applications/submit', payload);

      if (res.data?.success) {
        // Reset form
        setSubject('');
        setContent('');
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
              Initiate statutory routing: Staff → Designated Director → Registry Inward Desk → Registrar
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

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Application Category *
            </label>
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Through Director (Designated Unit Head)
            </label>
            <select
              value={directorId}
              onChange={(e) => setDirectorId(e.target.value)}
              disabled={loadingDirectors}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">-- Auto-detect from my Department/Unit --</option>
              {directors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.unit ? `(${d.unit})` : d.department ? `(${d.department})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              If left blank, the system will route to your designated Unit/Department Head automatically.
            </p>
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
