'use client';

import { useState } from 'react';
import { Upload, X, Trash2, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../lib/api';

interface UploadDocumentModalProps {
    staffId: string;
    onClose: () => void;
    onSuccess: () => void;
    endpoint?: string; // Optional custom endpoint
}

interface BatchFile {
    id: string;
    file: File;
    title: string;
    type: string;
    status: 'idle' | 'uploading' | 'success' | 'error';
    error?: string;
}

export default function UploadDocumentModal({ staffId, onClose, onSuccess, endpoint }: UploadDocumentModalProps) {
    const [files, setFiles] = useState<BatchFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [globalError, setGlobalError] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles: BatchFile[] = Array.from(e.target.files).map((f) => {
                const nameWithoutExt = f.name.substring(0, f.name.lastIndexOf('.')) || f.name;
                return {
                    id: Math.random().toString(36).substring(2, 9),
                    file: f,
                    title: nameWithoutExt,
                    type: 'OTHER',
                    status: 'idle',
                };
            });
            setFiles((prev) => [...prev, ...newFiles]);
            e.target.value = ''; // Reset file input
        }
    };

    const handleRemoveFile = (id: string) => {
        setFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const handleUpdateTitle = (id: string, newTitle: string) => {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, title: newTitle } : f)));
    };

    const handleUpdateType = (id: string, newType: string) => {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, type: newType } : f)));
    };

    const handleUploadBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (files.length === 0) {
            setGlobalError('Please select at least one file to upload.');
            return;
        }

        setUploading(true);
        setGlobalError('');

        const targetEndpoint = endpoint || '/api/registry/upload';
        let hasFailures = false;

        for (let i = 0; i < files.length; i++) {
            const batchFile = files[i];
            if (batchFile.status === 'success') continue;

            setFiles((prev) =>
                prev.map((f) => (f.id === batchFile.id ? { ...f, status: 'uploading' } : f))
            );

            const formData = new FormData();
            formData.append('file', batchFile.file);
            formData.append('title', batchFile.title);
            formData.append('type', batchFile.type);
            if (staffId) {
                formData.append('staffId', staffId);
            }
            formData.append('accessLevel', 'CONFIDENTIAL');

            try {
                await api.post(targetEndpoint, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });

                setFiles((prev) =>
                    prev.map((f) => (f.id === batchFile.id ? { ...f, status: 'success' } : f))
                );
            } catch (err: any) {
                hasFailures = true;
                const msg = err.response?.data?.message || 'Upload failed';
                setFiles((prev) =>
                    prev.map((f) => (f.id === batchFile.id ? { ...f, status: 'error', error: msg } : f))
                );
            }
        }

        setUploading(false);

        if (!hasFailures) {
            onSuccess();
            onClose();
        } else {
            setGlobalError('Some file uploads failed. Please review errors and retry.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-scaleUp">
                
                <div className="px-6 py-4 flex items-center justify-between border-b flex-shrink-0 bg-gray-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Upload to Dossier</h3>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">Add one or multiple documents to the digital file</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        disabled={uploading}
                        className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {globalError && (
                    <div className="mx-6 mt-4 rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs font-semibold text-red-700 flex items-center gap-2">
                        <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                        <span>{globalError}</span>
                    </div>
                )}

                <form onSubmit={handleUploadBatch} className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
                    
                    <div className="flex-shrink-0">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50/40 hover:bg-gray-50 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="h-10 w-10 text-gray-400 mb-2" />
                                <p className="text-xs font-bold text-gray-700">Click to select files (Supports PDF, PNG, JPG)</p>
                                <p className="text-[10px] text-gray-400 font-medium mt-1">Select multiple files for batch upload</p>
                            </div>
                            <input 
                                type="file" 
                                className="hidden" 
                                onChange={handleFileChange} 
                                multiple 
                                accept=".pdf,.png,.jpg,.jpeg" 
                                disabled={uploading}
                            />
                        </label>
                    </div>

                    {files.length > 0 && (
                        <div className="flex-1 space-y-3.5 min-h-[150px]">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Queue ({files.length} file{files.length > 1 ? 's' : ''})</h4>
                            
                            <div className="space-y-3">
                                {files.map((bf) => (
                                    <div 
                                        key={bf.id} 
                                        className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                            bf.status === 'success' ? 'bg-green-50/40 border-green-200' :
                                            bf.status === 'error' ? 'bg-red-50/40 border-red-200' :
                                            'bg-white border-gray-200 shadow-sm'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className={`p-2 rounded-lg ${bf.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-blue-55 text-blue-600'} flex-shrink-0`}>
                                                <FileText size={18} />
                                            </div>
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <span className="text-xs font-bold text-gray-900 truncate block">{bf.file.name}</span>
                                                <span className="text-[10px] text-gray-400 block">{(bf.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                                {bf.error && (
                                                    <span className="text-[10px] text-red-600 font-bold block">{bf.error}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3">
                                            {bf.status === 'idle' || bf.status === 'error' ? (
                                                <>
                                                    <input 
                                                        type="text" 
                                                        required
                                                        placeholder="Document Title"
                                                        value={bf.title}
                                                        onChange={(e) => handleUpdateTitle(bf.id, e.target.value)}
                                                        className="border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 w-36 font-semibold"
                                                        disabled={uploading}
                                                    />
                                                    <select
                                                        value={bf.type}
                                                        onChange={(e) => handleUpdateType(bf.id, e.target.value)}
                                                        className="border rounded-lg px-2.5 py-1.5 text-xs outline-none bg-white font-medium text-gray-700 w-32"
                                                        disabled={uploading}
                                                    >
                                                        <option value="APPOINTMENT_LETTER">Appointment Letter</option>
                                                        <option value="CREDENTIAL">Credential/Certificate</option>
                                                        <option value="PROMOTION_LETTER">Promotion Letter</option>
                                                        <option value="QUERY">Query/Discipline</option>
                                                        <option value="OTHER">Other</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFile(bf.id)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                                                        disabled={uploading}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            ) : bf.status === 'uploading' ? (
                                                <span className="text-xs font-bold text-blue-600 flex items-center gap-1.5 bg-blue-50 px-3 py-1 rounded-full">
                                                    <Loader2 className="animate-spin" size={13} />
                                                    Uploading...
                                                </span>
                                            ) : (
                                                <span className="text-xs font-bold text-green-700 flex items-center gap-1 bg-green-100 px-3 py-1 rounded-full">
                                                    <CheckCircle size={13} />
                                                    Success
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-4 sticky bottom-0 bg-white border-t -mx-6 -mb-6 p-6 flex-shrink-0">
                        <button
                            type="submit"
                            disabled={uploading || files.filter(f => f.status !== 'success').length === 0}
                            className="w-full rounded-xl bg-blue-900 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors shadow-md shadow-blue-900/10 hover:shadow-lg flex items-center justify-center gap-2"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Uploading Batch...
                                </>
                            ) : (
                                `Upload ${files.filter(f => f.status !== 'success').length} Document${files.filter(f => f.status !== 'success').length === 1 ? '' : 's'} to Dossier`
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
