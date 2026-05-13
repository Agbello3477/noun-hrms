'use client';

import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import api from '../../lib/api';

interface UploadDocumentModalProps {
    staffId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function UploadDocumentModal({ staffId, onClose, onSuccess }: UploadDocumentModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [type, setType] = useState('OTHER');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !title) {
            setError('Please provide a file and a title.');
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('type', type);
        formData.append('staffId', staffId);
        formData.append('accessLevel', 'CONFIDENTIAL');

        try {
            await api.post('/api/registry/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                }
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to upload document');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900">Upload to Dossier</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Document Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2"
                            placeholder="e.g. Appointment Letter"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Document Type</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2"
                        >
                            <option value="APPOINTMENT_LETTER">Appointment Letter</option>
                            <option value="CREDENTIAL">Credential/Certificate</option>
                            <option value="PROMOTION_LETTER">Promotion Letter</option>
                            <option value="QUERY">Query/Discipline</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">File (PDF/Image)</label>
                        <div className="mt-1 flex justify-center rounded-md border-2 border-dashed border-gray-300 px-6 pt-5 pb-6">
                            <div className="space-y-1 text-center">
                                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                <div className="flex text-sm text-gray-600">
                                    <label className="relative cursor-pointer rounded-md bg-white font-medium text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:text-blue-500">
                                        <span>Upload a file</span>
                                        <input type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" />
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500">{file ? file.name : 'PDF, PNG, JPG up to 10MB'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-md bg-blue-600 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Uploading...' : 'Save to Dossier'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
