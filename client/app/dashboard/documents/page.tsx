'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { FileText, Download, Trash2, Plus, Eye, Loader2 } from 'lucide-react';
import PasswordConfirmationModal from '../../../components/modals/PasswordConfirmationModal';
import { useAuth } from '../../../hooks/useAuth';
import UploadDocumentModal from '../../../components/dashboard/UploadDocumentModal';

interface Document {
    id: string;
    title: string;
    type: string;
    url: string;
    createdAt: string;
    uploadedBy: { user: { name: string } };
}

export default function MyDocumentsPage() {
    const { user } = useAuth();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);

    // Upload State
    const [showUpload, setShowUpload] = useState(false);

    // Delete State
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [downloadingZip, setDownloadingZip] = useState(false);

    const loadJSZip = async (): Promise<any> => {
        if ((window as any).JSZip) return (window as any).JSZip;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => resolve((window as any).JSZip);
            script.onerror = () => reject(new Error('Failed to load JSZip'));
            document.head.appendChild(script);
        });
    };

    const handleDownloadAll = async () => {
        if (documents.length === 0) return;
        setDownloadingZip(true);
        
        try {
            const JSZip = await loadJSZip();
            const zip = new JSZip();

            for (let i = 0; i < documents.length; i++) {
                const doc = documents[i];
                const fileUrl = `${process.env.NEXT_PUBLIC_API_URL || ''}${doc.url}`;
                const response = await api.get(fileUrl, { responseType: 'blob' });
                const ext = doc.url.split('.').pop() || 'pdf';
                const filename = `${doc.title.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
                
                zip.file(filename, response.data);
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const blobUrl = URL.createObjectURL(content);
            
            const link = window.document.createElement('a');
            link.href = blobUrl;
            link.download = `My_Digital_Dossier.zip`;
            
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (err) {
            console.error('Failed to generate ZIP archive', err);
            alert('Failed to generate ZIP archive. Please try again.');
        } finally {
            setDownloadingZip(false);
        }
    };

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
                <div className="flex gap-2">
                    {documents.length > 0 && (
                        <button
                            onClick={handleDownloadAll}
                            disabled={downloadingZip}
                            className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm shadow-sm"
                        >
                            <Download size={18} className={downloadingZip ? "animate-bounce" : ""} />
                            {downloadingZip ? 'Compressing...' : 'Download All (.zip)'}
                        </button>
                    )}
                    <button
                        onClick={() => setShowUpload(true)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-sm"
                    >
                        <Plus size={18} /> Upload Document
                    </button>
                </div>
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
                <UploadDocumentModal
                    staffId={user?.staffProfile?.id || ''}
                    onClose={() => setShowUpload(false)}
                    onSuccess={fetchDocuments}
                    endpoint="/api/documents/upload"
                />
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
