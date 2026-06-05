'use client';

import { useState, useEffect } from 'react';
import { X, Download, Printer, Loader2 } from 'lucide-react';
import api from '../../lib/api';

interface DocumentViewerModalProps {
    document: { id: string; title: string; url: string; type: string };
    onClose: () => void;
}

export default function DocumentViewerModal({ document, onClose }: DocumentViewerModalProps) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchFile = async () => {
            try {
                // Fetch as blob using the authenticated API instance
                const response = await api.get(document.url, { responseType: 'blob' });
                
                // Determine mime type from extension or fallback
                let mimeType = 'application/pdf'; // Default assumption
                if (document.url.match(/\.(jpg|jpeg|png)$/i)) {
                    mimeType = 'image/jpeg';
                }
                
                const blob = new Blob([response.data], { type: mimeType });
                const objUrl = URL.createObjectURL(blob);
                setBlobUrl(objUrl);
            } catch (err) {
                console.error("Failed to fetch document", err);
                setError('Failed to load document. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchFile();

        // Cleanup
        return () => {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [document.url]);

    const handleDownload = () => {
        if (!blobUrl) return;
        const link = window.document.createElement('a');
        link.href = blobUrl;
        
        // Extract extension from url or fallback to pdf
        const ext = document.url.split('.').pop() || 'pdf';
        link.download = `${document.title.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
        
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
    };

    const handlePrint = () => {
        if (!blobUrl) return;
        
        // For images, we can open a new window to print. For PDFs, the object viewer usually has a print button.
        // But to explicitly force print via JS:
        const printWindow = window.open(blobUrl, '_blank');
        if (printWindow) {
            printWindow.onload = () => {
                printWindow.print();
            };
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-2 md:p-6 backdrop-blur-sm">
            <div className="bg-white shadow-2xl w-full max-w-7xl h-full md:h-full rounded-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg line-clamp-1">{document.title}</h3>
                        <p className="text-xs text-gray-500 uppercase">{document.type.replace(/_/g, ' ')}</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handlePrint}
                            disabled={loading || !!error}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                            <Printer size={16} /> Print
                        </button>
                        <button 
                            onClick={handleDownload}
                            disabled={loading || !!error}
                            className="flex items-center gap-2 px-3 py-1.5 bg-nounGreen text-white rounded hover:bg-green-800 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                            <Download size={16} /> Download
                        </button>
                        <div className="w-px h-6 bg-gray-300 mx-1"></div>
                        <button 
                            onClick={onClose} 
                            className="text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 p-2 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Viewer Body */}
                <div className="flex-1 bg-gray-900 relative flex items-center justify-center p-0 min-h-0">
                    {loading && (
                        <div className="flex flex-col items-center text-gray-300">
                            <Loader2 size={40} className="animate-spin mb-4" />
                            <p className="font-medium text-sm">Securely loading document...</p>
                        </div>
                    )}
                    
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 text-center">
                            <p className="font-bold mb-1">Error</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    )}
                    
                    {!loading && !error && blobUrl && (
                        document.url.match(/\.(jpg|jpeg|png)$/i) ? (
                            <img src={blobUrl} alt={document.title} className="w-full h-full object-contain" />
                        ) : (
                            <object data={blobUrl} type="application/pdf" className="w-full h-full">
                                <div className="flex flex-col items-center justify-center h-full text-gray-300">
                                    <p>Your browser does not support inline PDFs.</p>
                                    <button onClick={handleDownload} className="mt-4 text-nounGreen underline font-bold bg-white px-4 py-2 rounded">Download PDF instead</button>
                                </div>
                            </object>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
