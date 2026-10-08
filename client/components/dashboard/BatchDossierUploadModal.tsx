'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Upload,
    X,
    FileText,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Trash2,
    Archive,
    Search,
    Check,
    FolderUp,
    FileSpreadsheet,
    UserCheck,
    Layers
} from 'lucide-react';
import api from '../../lib/api';

export interface BatchDossierUploadModalProps {
    onClose: () => void;
    onSuccess: () => void;
    defaultStaffId?: string; // If opened from a specific staff's dossier
    defaultStaffName?: string;
}

interface QueuedDocument {
    id: string;
    file: File;
    fileName: string;
    fileSizeFormatted: string;
    title: string;
    type: 'APPOINTMENT_LETTER' | 'CREDENTIAL' | 'PROMOTION_LETTER' | 'PAYSLIP' | 'QUERY' | 'OTHER';
    accessLevel: 'CONFIDENTIAL' | 'RESTRICTED' | 'PUBLIC';
    staffProfileId: string;
    staffDisplayName: string;
    matchedAutomatically: boolean;
    status: 'idle' | 'uploading' | 'success' | 'error';
    error?: string;
}

interface StaffOption {
    id: string;
    staffId: string;
    name: string;
    rank?: string;
    unit?: string;
}

export default function BatchDossierUploadModal({
    onClose,
    onSuccess,
    defaultStaffId,
    defaultStaffName
}: BatchDossierUploadModalProps) {
    const [queue, setQueue] = useState<QueuedDocument[]>([]);
    const [staffList, setStaffList] = useState<StaffOption[]>([]);
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [isProcessingZip, setIsProcessingZip] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [globalError, setGlobalError] = useState('');
    const [bulkType, setBulkType] = useState<string>('');
    const [bulkStaffId, setBulkStaffId] = useState<string>('');
    const [searchFilter, setSearchFilter] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch staff list for smart auto-matching
    useEffect(() => {
        const fetchStaff = async () => {
            setLoadingStaff(true);
            try {
                const { data } = await api.get('/api/staff?limit=1000');
                const staffData = (data.staff || data || []).map((s: any) => ({
                    id: s.staffProfile?.id || s.id,
                    staffId: s.staffProfile?.staffId || s.staffId || '',
                    name: s.name || `${s.staffProfile?.surname || ''} ${s.staffProfile?.otherNames || ''}`.trim(),
                    rank: s.staffProfile?.rank || '',
                    unit: s.staffProfile?.unit?.name || ''
                })).filter((s: any) => s.id && s.name);
                setStaffList(staffData);
            } catch (err) {
                console.warn('Could not preload staff directory for auto-matching:', err);
            } finally {
                setLoadingStaff(false);
            }
        };

        fetchStaff();
    }, []);

    // Helper: format bytes
    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Helper: guess document type from filename
    const guessDocType = (name: string): QueuedDocument['type'] => {
        const lower = name.toLowerCase();
        if (lower.includes('appoint') || lower.includes('assumption') || lower.includes('offer')) return 'APPOINTMENT_LETTER';
        if (lower.includes('promo') || lower.includes('advancement') || lower.includes('upgrade')) return 'PROMOTION_LETTER';
        if (lower.includes('cert') || lower.includes('degree') || lower.includes('diploma') || lower.includes('cv') || lower.includes('resume') || lower.includes('waec') || lower.includes('nysc')) return 'CREDENTIAL';
        if (lower.includes('payslip') || lower.includes('salary') || lower.includes('payroll')) return 'PAYSLIP';
        if (lower.includes('query') || lower.includes('disciplin') || lower.includes('sanction')) return 'QUERY';
        return 'OTHER';
    };

    // Helper: clean title from filename
    const formatTitle = (name: string): string => {
        const nameWithoutExt = name.substring(0, name.lastIndexOf('.')) || name;
        return nameWithoutExt
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    // Helper: try to match staff from filename
    const matchStaffFromFileName = (fileName: string, availableStaff: StaffOption[]): { profileId: string; name: string; matched: boolean } => {
        if (defaultStaffId) {
            return {
                profileId: defaultStaffId,
                name: defaultStaffName || 'Target Staff',
                matched: true
            };
        }

        const lower = fileName.toLowerCase();

        // 1. Check exact staff ID match (e.g., 00001, 00002, NOUN/2026/001)
        for (const s of availableStaff) {
            if (!s.staffId) continue;
            const normalizedStaffId = s.staffId.toLowerCase().replace(/[\/_-]/g, '');
            const normalizedFileName = lower.replace(/[\/_-]/g, '');

            if (normalizedStaffId.length >= 3 && normalizedFileName.includes(normalizedStaffId)) {
                return { profileId: s.id, name: `${s.name} (${s.staffId})`, matched: true };
            }
        }

        // 2. Check surname or full name match
        for (const s of availableStaff) {
            if (!s.name) continue;
            const parts = s.name.toLowerCase().split(/\s+/).filter(p => p.length >= 3);
            if (parts.length > 0 && parts.every(part => lower.includes(part))) {
                return { profileId: s.id, name: `${s.name} (${s.staffId || 'ID'})`, matched: true };
            }
        }

        return { profileId: '', name: '', matched: false };
    };

    // Process uploaded file list (including raw files or unpacked zip files)
    const processFiles = (rawFiles: File[]) => {
        const newQueueItems: QueuedDocument[] = [];

        for (const file of rawFiles) {
            // Ignore hidden system files like .DS_Store
            if (file.name.startsWith('.') || file.name.includes('__MACOSX')) continue;

            const match = matchStaffFromFileName(file.name, staffList);
            const docType = guessDocType(file.name);
            const cleanTitle = formatTitle(file.name);

            newQueueItems.push({
                id: Math.random().toString(36).substring(2, 11),
                file,
                fileName: file.name,
                fileSizeFormatted: formatBytes(file.size),
                title: cleanTitle,
                type: docType,
                accessLevel: 'CONFIDENTIAL',
                staffProfileId: match.profileId,
                staffDisplayName: match.name,
                matchedAutomatically: match.matched,
                status: 'idle'
            });
        }

        setQueue(prev => [...prev, ...newQueueItems]);
    };

    // Dynamically load JSZip to unpack ZIP archives on client side
    const unpackZipArchive = async (zipFile: File) => {
        setIsProcessingZip(true);
        setGlobalError('');

        try {
            let JSZip = (window as any).JSZip;
            if (!JSZip) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                    script.onload = () => resolve(true);
                    script.onerror = () => reject(new Error('Failed to load ZIP decompression library'));
                    document.head.appendChild(script);
                });
                JSZip = (window as any).JSZip;
            }

            const zip = new JSZip();
            const contents = await zip.loadAsync(zipFile);
            const extractedFiles: File[] = [];

            const entries = Object.keys(contents.files);
            for (const relPath of entries) {
                const zipEntry = contents.files[relPath];
                if (zipEntry.dir) continue;
                if (relPath.startsWith('__MACOSX') || relPath.includes('/.') || relPath.startsWith('.')) continue;

                const blob = await zipEntry.async('blob');
                const baseName = relPath.split('/').pop() || relPath;
                const file = new File([blob], baseName, { type: blob.type || 'application/octet-stream' });
                extractedFiles.push(file);
            }

            if (extractedFiles.length === 0) {
                setGlobalError('The uploaded ZIP archive contains no supported documents.');
            } else {
                processFiles(extractedFiles);
            }
        } catch (err: any) {
            console.error('ZIP extraction failed:', err);
            setGlobalError('Failed to read and unpack ZIP file: ' + (err.message || 'Corrupted archive'));
        } finally {
            setIsProcessingZip(false);
        }
    };

    // Handle File Drop or Browser Selection
    const handleFilesSelected = (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const filesArr = Array.from(files);
        const zipFile = filesArr.find(f => f.name.toLowerCase().endsWith('.zip') || f.type.includes('zip'));

        if (zipFile) {
            unpackZipArchive(zipFile);
            // Also process non-zip files if present
            const nonZips = filesArr.filter(f => f !== zipFile);
            if (nonZips.length > 0) processFiles(nonZips);
        } else {
            processFiles(filesArr);
        }
    };

    // Drag and drop handlers
    const [isDragOver, setIsDragOver] = useState(false);
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };
    const handleDragLeave = () => setIsDragOver(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFilesSelected(e.dataTransfer.files);
    };

    // Queue mutations
    const handleRemoveItem = (id: string) => {
        setQueue(prev => prev.filter(q => q.id !== id));
    };

    const handleUpdateItem = (id: string, updates: Partial<QueuedDocument>) => {
        setQueue(prev => prev.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, ...updates };
            if (updates.staffProfileId !== undefined) {
                const s = staffList.find(st => st.id === updates.staffProfileId);
                updated.staffDisplayName = s ? `${s.name} (${s.staffId || 'ID'})` : '';
                updated.matchedAutomatically = false;
            }
            return updated;
        }));
    };

    // Bulk apply actions
    const handleApplyBulkType = () => {
        if (!bulkType) return;
        setQueue(prev => prev.map(item => ({ ...item, type: bulkType as any })));
    };

    const handleApplyBulkStaff = () => {
        if (!bulkStaffId) return;
        const s = staffList.find(st => st.id === bulkStaffId);
        const dispName = s ? `${s.name} (${s.staffId || 'ID'})` : '';
        setQueue(prev => prev.map(item => ({
            ...item,
            staffProfileId: bulkStaffId,
            staffDisplayName: dispName,
            matchedAutomatically: false
        })));
    };

    // Perform Batch Upload
    const handleStartBatchUpload = async () => {
        if (queue.length === 0) {
            setGlobalError('No files queued for upload.');
            return;
        }

        // Validate that all items have an assigned staff member
        const unassigned = queue.filter(item => !item.staffProfileId);
        if (unassigned.length > 0) {
            setGlobalError(`Please assign a staff member to all documents. ${unassigned.length} items are currently unassigned.`);
            return;
        }

        setIsUploading(true);
        setGlobalError('');
        setUploadProgress(0);

        let completedCount = 0;
        const total = queue.length;

        // Process in concurrent batches of 4 for speed and resilience
        const BATCH_SIZE = 4;
        const queueCopies = [...queue];

        for (let i = 0; i < queueCopies.length; i += BATCH_SIZE) {
            const currentChunk = queueCopies.slice(i, i + BATCH_SIZE);

            await Promise.all(
                currentChunk.map(async (docItem) => {
                    if (docItem.status === 'success') {
                        completedCount++;
                        return;
                    }

                    // Set uploading status
                    setQueue(prev => prev.map(q => q.id === docItem.id ? { ...q, status: 'uploading' } : q));

                    const formData = new FormData();
                    formData.append('file', docItem.file);
                    formData.append('title', docItem.title);
                    formData.append('type', docItem.type);
                    formData.append('staffId', docItem.staffProfileId);
                    formData.append('accessLevel', docItem.accessLevel);

                    try {
                        await api.post('/api/registry/upload', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });

                        setQueue(prev => prev.map(q => q.id === docItem.id ? { ...q, status: 'success' } : q));
                    } catch (err: any) {
                        const errMsg = err.response?.data?.message || err.message || 'Upload failed';
                        setQueue(prev => prev.map(q => q.id === docItem.id ? { ...q, status: 'error', error: errMsg } : q));
                    } finally {
                        completedCount++;
                        setUploadProgress(Math.round((completedCount / total) * 100));
                    }
                })
            );
        }

        setIsUploading(false);

        // Check if all succeeded
        const remainingErrors = queue.filter(q => q.status === 'error');
        if (remainingErrors.length === 0) {
            onSuccess();
        }
    };

    const assignedCount = queue.filter(q => q.staffProfileId).length;
    const successCount = queue.filter(q => q.status === 'success').length;
    const errorCount = queue.filter(q => q.status === 'error').length;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100/80 text-blue-700 rounded-xl">
                            <FolderUp size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">
                                Batch Dossier Upload Center
                            </h2>
                            <p className="text-xs text-slate-500">
                                Multi-file &amp; ZIP archive ingestion with automatic staff matching
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Error Banner */}
                    {globalError && (
                        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex items-center gap-2">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{globalError}</span>
                        </div>
                    )}

                    {/* Drag & Drop Zone */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                            isDragOver
                                ? 'border-blue-500 bg-blue-50/60 scale-[0.99]'
                                : 'border-slate-300 hover:border-blue-400 bg-slate-50/40 hover:bg-blue-50/20'
                        }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
                            className="hidden"
                            onChange={e => handleFilesSelected(e.target.files)}
                        />
                        <div className="flex flex-col items-center justify-center gap-2">
                            <div className="p-3 bg-white border border-slate-200 rounded-full shadow-sm text-blue-600">
                                {isProcessingZip ? (
                                    <Loader2 size={24} className="animate-spin text-blue-600" />
                                ) : (
                                    <Upload size={24} />
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-700">
                                    {isProcessingZip
                                        ? 'Decompressing and unpacking ZIP archive...'
                                        : 'Drag & drop multiple documents or a .ZIP archive here'}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Supports PDF, DOC, DOCX, Images, and compressed .ZIP files up to 100MB
                                </p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 shadow-xs">
                                Browse Files from Computer
                            </span>
                        </div>
                    </div>

                    {/* Batch Actions & Queue Stats */}
                    {queue.length > 0 && (
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-700">
                                    Queued: <span className="text-blue-700 font-extrabold">{queue.length}</span>
                                </span>
                                <span className="text-xs font-bold text-slate-700">
                                    Assigned: <span className="text-emerald-700 font-extrabold">{assignedCount}/{queue.length}</span>
                                </span>
                                {successCount > 0 && (
                                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                        <CheckCircle2 size={12} /> {successCount} Uploaded
                                    </span>
                                )}
                                {errorCount > 0 && (
                                    <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                                        <AlertCircle size={12} /> {errorCount} Failed
                                    </span>
                                )}
                            </div>

                            {/* Bulk Operations */}
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 text-xs">
                                    <select
                                        value={bulkType}
                                        onChange={e => setBulkType(e.target.value)}
                                        className="bg-transparent outline-none text-slate-700 text-xs px-1"
                                    >
                                        <option value="">Select Bulk Type</option>
                                        <option value="APPOINTMENT_LETTER">Appointment Letter</option>
                                        <option value="PROMOTION_LETTER">Promotion Letter</option>
                                        <option value="CREDENTIAL">Credentials / CV</option>
                                        <option value="PAYSLIP">Payslip</option>
                                        <option value="QUERY">Query / Disciplinary</option>
                                        <option value="OTHER">Other Dossier</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleApplyBulkType}
                                        disabled={!bulkType || isUploading}
                                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-[11px] disabled:opacity-50"
                                    >
                                        Apply to All
                                    </button>
                                </div>

                                {!defaultStaffId && (
                                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 text-xs">
                                        <select
                                            value={bulkStaffId}
                                            onChange={e => setBulkStaffId(e.target.value)}
                                            className="bg-transparent outline-none text-slate-700 text-xs px-1 max-w-[150px] truncate"
                                        >
                                            <option value="">Select Bulk Staff</option>
                                            {staffList.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} ({s.staffId || 'ID'})
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleApplyBulkStaff}
                                            disabled={!bulkStaffId || isUploading}
                                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-[11px] disabled:opacity-50"
                                        >
                                            Assign All
                                        </button>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setQueue([])}
                                    disabled={isUploading}
                                    className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition disabled:opacity-50"
                                >
                                    Clear Queue
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Queued Items Table */}
                    {queue.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                            <div className="max-h-[320px] overflow-y-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
                                        <tr>
                                            <th className="py-2.5 px-3 font-bold">File</th>
                                            <th className="py-2.5 px-3 font-bold">Target Staff</th>
                                            <th className="py-2.5 px-3 font-bold">Document Title</th>
                                            <th className="py-2.5 px-3 font-bold">Type</th>
                                            <th className="py-2.5 px-3 font-bold text-center">Status</th>
                                            <th className="py-2.5 px-2 font-bold text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {queue.map((item, idx) => (
                                            <tr key={item.id} className="hover:bg-slate-50/80 transition">
                                                <td className="py-2.5 px-3">
                                                    <div className="flex items-center gap-2 max-w-[200px]">
                                                        <FileText size={16} className="text-blue-600 shrink-0" />
                                                        <div className="truncate">
                                                            <p className="font-semibold text-slate-800 truncate" title={item.fileName}>
                                                                {item.fileName}
                                                            </p>
                                                            <span className="text-[10px] text-slate-400">
                                                                {item.fileSizeFormatted}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Staff Assignment */}
                                                <td className="py-2.5 px-3 max-w-[220px]">
                                                    {defaultStaffId ? (
                                                        <span className="text-slate-800 font-semibold truncate block">
                                                            {defaultStaffName || 'Assigned'}
                                                        </span>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <select
                                                                value={item.staffProfileId}
                                                                onChange={e => handleUpdateItem(item.id, { staffProfileId: e.target.value })}
                                                                disabled={isUploading || item.status === 'success'}
                                                                className={`w-full border rounded-lg p-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 bg-white font-medium ${
                                                                    item.staffProfileId
                                                                        ? 'border-slate-200 text-slate-800'
                                                                        : 'border-amber-400 bg-amber-50 text-amber-900 font-bold'
                                                                }`}
                                                            >
                                                                <option value="">-- Assign Staff --</option>
                                                                {staffList.map(s => (
                                                                    <option key={s.id} value={s.id}>
                                                                        {s.name} ({s.staffId || 'ID'})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            {item.matchedAutomatically && item.staffProfileId && (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                                    <UserCheck size={10} /> Auto-Matched
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Title */}
                                                <td className="py-2.5 px-3">
                                                    <input
                                                        type="text"
                                                        value={item.title}
                                                        onChange={e => handleUpdateItem(item.id, { title: e.target.value })}
                                                        disabled={isUploading || item.status === 'success'}
                                                        placeholder="Document title"
                                                        className="w-full border border-slate-200 rounded-lg p-1 text-xs text-slate-800 outline-none focus:border-blue-500 font-medium"
                                                    />
                                                </td>

                                                {/* Type */}
                                                <td className="py-2.5 px-3">
                                                    <select
                                                        value={item.type}
                                                        onChange={e => handleUpdateItem(item.id, { type: e.target.value as any })}
                                                        disabled={isUploading || item.status === 'success'}
                                                        className="border border-slate-200 rounded-lg p-1 text-xs text-slate-800 outline-none focus:border-blue-500 bg-white"
                                                    >
                                                        <option value="APPOINTMENT_LETTER">Appointment Letter</option>
                                                        <option value="PROMOTION_LETTER">Promotion Letter</option>
                                                        <option value="CREDENTIAL">Credentials / CV</option>
                                                        <option value="PAYSLIP">Payslip</option>
                                                        <option value="QUERY">Query / Disciplinary</option>
                                                        <option value="OTHER">Other</option>
                                                    </select>
                                                </td>

                                                {/* Status */}
                                                <td className="py-2.5 px-3 text-center">
                                                    {item.status === 'idle' && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                                            Ready
                                                        </span>
                                                    )}
                                                    {item.status === 'uploading' && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 flex items-center justify-center gap-1">
                                                            <Loader2 size={10} className="animate-spin" /> Uploading
                                                        </span>
                                                    )}
                                                    {item.status === 'success' && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center justify-center gap-1">
                                                            <CheckCircle2 size={10} /> Saved
                                                        </span>
                                                    )}
                                                    {item.status === 'error' && (
                                                        <span
                                                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 flex items-center justify-center gap-1"
                                                            title={item.error || 'Upload error'}
                                                        >
                                                            <AlertCircle size={10} /> Error
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Remove */}
                                                <td className="py-2.5 px-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        disabled={isUploading}
                                                        className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 transition disabled:opacity-40"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Progress Bar during upload */}
                    {isUploading && (
                        <div className="space-y-1.5 p-4 bg-blue-50/70 border border-blue-200 rounded-xl">
                            <div className="flex justify-between text-xs font-bold text-blue-900">
                                <span>Batch Upload in Progress...</span>
                                <span>{uploadProgress}% ({successCount} of {queue.length})</span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isUploading}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold text-xs transition disabled:opacity-50"
                    >
                        {successCount > 0 && queue.length === successCount ? 'Close' : 'Cancel'}
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleStartBatchUpload}
                            disabled={isUploading || queue.length === 0}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 shadow-sm transition disabled:opacity-50"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Uploading Batch ({uploadProgress}%)
                                </>
                            ) : (
                                <>
                                    <FolderUp size={14} />
                                    Upload All ({queue.length} Files)
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
