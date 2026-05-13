'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { FileText, Download, Trash2, Plus, Eye, Loader2 } from 'lucide-react';
import PasswordConfirmationModal from '../../../components/modals/PasswordConfirmationModal';

interface Document {
    id: string;
    title: string;
    type: string;
    url: string;
    createdAt: string;
    uploadedBy: { user: { name: string } };
}

export default function MyDocumentsPage() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Upload State
    const [showUpload, setShowUpload] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [docTitle, setDocTitle] = useState('');
    const [docType, setDocType] = useState('OTHER');

    // Delete State
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const fetchDocuments = async () => {
        try {
            const res = await api.get('/api/documents/my');
            setDocuments(res.data);
        } catch (error) {
            console.error('Error fetching docs', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, []);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !docTitle) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', docTitle);
        formData.append('type', docType);

        try {
            const me = await api.get('/api/auth/me');
            const myId = me.data.staffProfile?.id;

            if (!myId) {
                alert('Profile not found. Cannot upload.');
                setUploading(false);
                return;
            }

            formData.append('staffId', myId);

            await api.post('/api/documents/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setShowUpload(false);
            setFile(null);
            setDocTitle('');
            fetchDocuments();
        } catch (error) {
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await api.delete(`/api/documents/${deleteId}`);
            setDocuments(docs => docs.filter(d => d.id !== deleteId));
            setDeleteId(null);
        } catch (error) {
            alert('Delete failed. Ensure you have permission (HR Admin only).');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">My Digital Dossier</h1>
                <button
                    onClick={() => setShowUpload(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                    <Plus size={18} /> Upload Document
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded By</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {documents.map(doc => (
                                <tr key={doc.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <FileText className="text-gray-400 mr-2" size={20} />
                                            <span className="text-sm font-medium text-gray-900">{doc.title}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.uploadedBy?.user?.name || 'Unknown'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(doc.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <a href={`${process.env.NEXT_PUBLIC_API_URL}${doc.url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900 mr-4 inline-flex items-center">
                                            <Eye size={16} className="mr-1" /> View
                                        </a>
                                        <button
                                            onClick={() => setDeleteId(doc.id)}
                                            className="text-red-600 hover:text-red-900 inline-flex items-center"
                                        >
                                            <Trash2 size={16} className="mr-1" /> Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {documents.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                                        No documents found in your dossier.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Upload Modal */}
            {showUpload && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Upload Document</h3>
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Document Title</label>
                                <input
                                    type="text" required
                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                    value={docTitle}
                                    onChange={e => setDocTitle(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Category</label>
                                <select
                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                    value={docType}
                                    onChange={e => setDocType(e.target.value)}
                                >
                                    <option value="APPOINTMENT_LETTER">Appointment Letter</option>
                                    <option value="CREDENTIAL">Credential</option>
                                    <option value="PROMOTION_LETTER">Promotion Letter</option>
                                    <option value="QUERY">Query</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">File</label>
                                <input
                                    type="file" required
                                    className="mt-1 block w-full"
                                    onChange={e => setFile(e.target.files?.[0] || null)}
                                />
                            </div>
                            <div className="flex gap-2 pt-4">
                                <button type="button" onClick={() => setShowUpload(false)} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                                <button type="submit" disabled={uploading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                                    {uploading ? 'Uploading...' : 'Upload'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <PasswordConfirmationModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Delete Document"
                description="Are you sure you want to permanently delete this document? This action cannot be undone."
                actionLabel="Delete Document"
            />
        </div>
    );
}
