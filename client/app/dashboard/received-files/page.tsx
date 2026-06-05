'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { FolderOpen, Eye, CheckCircle2, ArrowLeftRight, FileText, ChevronRight, X } from 'lucide-react';
import DigitalDossier from '../../../components/dashboard/DigitalDossier';

interface FileRequest {
    id: string;
    reason?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
    createdAt: string;
    requester: {
        name: string;
        staffProfile?: {
            unit?: { name: string };
            studyCenter?: { name: string };
        };
    };
    approvedBy?: { name: string };
    transferredBy?: { name: string };
    staff: {
        id: string;
        surname: string;
        otherNames: string;
        staffId: string;
    };
}

export default function ReceivedFilesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [receivedFiles, setReceivedFiles] = useState<FileRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewingRequest, setViewingRequest] = useState<FileRequest | null>(null);
    const [returningId, setReturningId] = useState<string | null>(null);

    const fetchReceivedFiles = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/file-requests?type=received');
            setReceivedFiles(res.data);
        } catch (error) {
            console.error('Failed to fetch received files', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && user.role === 'STAFF') {
            router.push('/dashboard');
        } else {
            fetchReceivedFiles();
        }
    }, [user, router]);

    if (user && user.role === 'STAFF') {
        return null;
    }

    const handleReturn = async (requestId: string) => {
        setReturningId(requestId);
        try {
            await api.put(`/api/file-requests/${requestId}/return`);
            setViewingRequest(null);
            alert('File returned to HR successfully.');
            fetchReceivedFiles();
        } catch (error) {
            console.error('Failed to return file', error);
            alert('Failed to return file. Please try again.');
        } finally {
            setReturningId(null);
        }
    };

    return (
        <div className="space-y-8 p-6 min-h-screen bg-gray-55/30">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FolderOpen className="text-blue-600" size={28} />
                    Received Files
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Access and view official staff digital files authorized by Registry.
                </p>
            </div>

            {/* List of Files */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : receivedFiles.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <FolderOpen className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                    <h3 className="text-lg font-bold text-gray-800">No active received files</h3>
                    <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
                        When HR approves your file requests, they will show up here for you to view, print, or download.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {receivedFiles.map((req) => {
                        const place = req.requester?.staffProfile?.studyCenter?.name || req.requester?.staffProfile?.unit?.name || 'Main Registry';
                        const approverName = req.approvedBy?.name || 'HR Admin';
                        const transferrerName = req.transferredBy?.name || 'HR Admin';
                        const transferStatus = `This file has been transferred to ${place}, approved by ${approverName} and transferred by ${transferrerName}`;

                        return (
                            <div
                                key={req.id}
                                className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                            >
                                <div className="space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                                <FileText size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-800 text-lg">
                                                    {req.staff.surname} {req.staff.otherNames}
                                                </h3>
                                                <span className="text-xs text-gray-400 font-mono font-semibold">
                                                    Staff ID: {req.staff.staffId}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                                            <CheckCircle2 size={12} className="mr-1" /> Active
                                        </span>
                                    </div>

                                    {/* Transfer Status Information */}
                                    <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-650 border border-gray-100 leading-relaxed">
                                        <div className="font-semibold text-gray-500 uppercase tracking-wider mb-1 text-[9px]">
                                            Transfer Details
                                        </div>
                                        {transferStatus}
                                    </div>

                                    {/* Digital Receipt Stamp */}
                                    <div className="flex justify-center pt-2">
                                        <div className="border-4 border-double border-red-500 text-red-500 rounded-xl px-4 py-2 font-mono font-bold text-center uppercase tracking-widest text-[12px] rotate-[-2deg] shadow-sm select-none">
                                            <div className="text-[10px] opacity-75">★ NOUN REGISTRY ★</div>
                                            <div className="text-sm font-black tracking-normal">ACKNOWLEDGED & RECEIVED</div>
                                            <div className="text-[10px] opacity-75">DATE: {new Date(req.createdAt).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                                    <div className="text-xs text-gray-400">
                                        Received: {new Date(req.createdAt).toLocaleDateString()}
                                    </div>
                                    <button
                                        onClick={() => setViewingRequest(req)}
                                        className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
                                    >
                                        <Eye size={16} /> View Digital dossier
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Viewer Modal */}
            {viewingRequest && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
                    <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-250">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-55/30 flex items-center justify-between">
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-gray-800">
                                    Viewing Staff Dossier: {viewingRequest.staff.surname} {viewingRequest.staff.otherNames}
                                </h2>
                                <p className="text-xs text-gray-400 font-mono mt-0.5">
                                    Staff ID: {viewingRequest.staff.staffId}
                                </p>
                            </div>

                            {/* Digital Stamp in Modal Header */}
                            <div className="mr-6 border-2 border-double border-red-500 text-red-500 rounded-lg px-3 py-1 font-mono font-bold text-center uppercase tracking-wider text-[9px] rotate-[-1deg] select-none scale-90 sm:scale-100">
                                <div className="text-[7px] leading-none opacity-75">★ NOUN REGISTRY ★</div>
                                <div className="font-extrabold text-[10px] leading-tight">ACKNOWLEDGED & RECEIVED</div>
                                <div className="text-[7px] leading-none opacity-75">{new Date(viewingRequest.createdAt).toLocaleDateString()}</div>
                            </div>

                            <button
                                onClick={() => setViewingRequest(null)}
                                className="text-gray-400 hover:text-gray-650 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body (Dossier component) */}
                        <div className="flex-1 overflow-y-auto px-6 pb-6">
                            <DigitalDossier
                                staffId={viewingRequest.staff.id}
                                staffName={`${viewingRequest.staff.surname} ${viewingRequest.staff.otherNames}`}
                                readOnly={true}
                            />
                        </div>

                        {/* Modal Footer (Action Buttons) */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row gap-3 sm:justify-end">
                            <button
                                onClick={() => setViewingRequest(null)}
                                className="px-6 py-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-bold shadow-sm transition-colors"
                            >
                                Done
                            </button>
                            <button
                                onClick={() => handleReturn(viewingRequest.id)}
                                disabled={returningId !== null}
                                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <ArrowLeftRight size={16} />
                                {returningId ? 'Returning...' : 'Done and Return'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
