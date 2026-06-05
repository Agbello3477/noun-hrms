'use client';

import { useEffect, useState } from 'react';
import { FileText, Eye, Lock, Trash2, Download } from 'lucide-react';
import api from '../../lib/api';
import UploadDocumentModal from './UploadDocumentModal';
import DocumentViewerModal from './DocumentViewerModal';

interface Document {
    id: string;
    title: string;
    type: string;
    url: string;
    accessLevel: string;
    createdAt: string;
    uploadedBy: {
        user: { name: string | null }
    }
}

export default function DigitalDossier({ staffId, staffName = 'Staff', readOnly = false }: { staffId: string, staffName?: string, readOnly?: boolean }) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
    const [error, setError] = useState('');

    const fetchDossier = async () => {
        try {
            const { data } = await api.get(`/api/registry/dossier/${staffId}`);
            setDocuments(data);
        } catch (err: any) {
            setError('Failed to load dossier. Access Restricted.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (staffId) fetchDossier();
    }, [staffId]);

    const handleDelete = async (docId: string) => {
        if (!confirm('Are you sure you want to permanently delete this document?')) return;

        try {
            await api.delete(`/api/registry/documents/${docId}`);
            setDocuments(prev => prev.filter(d => d.id !== docId));
        } catch (err: any) {
            alert('Failed to delete document: ' + (err.response?.data?.message || 'Unknown error'));
        }
    };

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
                const response = await api.get(doc.url, { responseType: 'blob' });
                const ext = doc.url.split('.').pop() || 'pdf';
                const filename = `${doc.title.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
                
                zip.file(filename, response.data);
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const blobUrl = URL.createObjectURL(content);
            
            const link = window.document.createElement('a');
            link.href = blobUrl;
            link.download = `${staffName.replace(/[^a-z0-9]/gi, '_')}_Dossier.zip`;
            
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

    return (
        <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <FileText size={20} /> Digital Dossier
                </h3>
                <div className="flex gap-2">
                    {documents.length > 0 && (
                        <button
                            onClick={handleDownloadAll}
                            disabled={downloadingZip}
                            className="text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold px-4 py-2 rounded-md transition-colors shadow-sm border border-blue-200 flex items-center gap-2 disabled:opacity-50"
                        >
                            <Download size={16} className={downloadingZip ? "animate-bounce" : ""} /> 
                            {downloadingZip ? 'Compressing...' : 'Download All (.zip)'}
                        </button>
                    )}
                    {!readOnly && (
                        <button
                            onClick={() => setIsUploadOpen(true)}
                            className="text-sm bg-nounGreen hover:bg-green-800 text-white font-bold px-4 py-2 rounded-md transition-colors shadow-sm"
                        >
                            + Upload Document
                        </button>
                    )}
                </div>
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            {loading ? (
                <div className="animate-pulse space-y-2">
                    <div className="h-10 bg-gray-100 rounded"></div>
                    <div className="h-10 bg-gray-100 rounded"></div>
                </div>
            ) : documents.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-gray-500 font-medium">No documents found in this file.</p>
                    <p className="text-gray-400 text-sm mt-1">Upload appointment letters, credentials, or other official records.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Document</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Uploaded By</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {documents.map(doc => (
                                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doc.title}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${doc.type === 'QUERY' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                            }`}>
                                            {doc.type.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.uploadedBy?.user?.name || 'System'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right flex items-center justify-end gap-3">
                                        <button
                                            onClick={() => setViewingDoc(doc)}
                                            className="text-gray-600 hover:text-nounGreen inline-flex items-center gap-1 font-medium transition-colors"
                                            title="View Document"
                                        >
                                            <Eye size={18} />
                                        </button>
                                        {!readOnly && (
                                            <button
                                                onClick={() => handleDelete(doc.id)}
                                                className="text-gray-400 hover:text-red-600 transition-colors"
                                                title="Delete Document"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {isUploadOpen && (
                <UploadDocumentModal
                    staffId={staffId}
                    onClose={() => setIsUploadOpen(false)}
                    onSuccess={fetchDossier}
                />
            )}

            {viewingDoc && (
                <DocumentViewerModal
                    document={viewingDoc}
                    onClose={() => setViewingDoc(null)}
                />
            )}
        </div>
    );
}
