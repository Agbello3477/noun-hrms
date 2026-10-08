'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, MapPin, CheckCircle2, Clock, Download, ShieldCheck, UserCheck } from 'lucide-react';
import api from '../../../lib/api';

export default function TransferHistoryTab({ staffId }: { staffId: string }) {
    const [transfers, setTransfers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    useEffect(() => {
        const fetchTransfers = async () => {
            try {
                const { data } = await api.get(`/api/registry/transfers?staffId=${encodeURIComponent(staffId)}`);
                // Ensure data is array
                const items = Array.isArray(data) ? data : [];
                setTransfers(items);
            } catch (error) {
                console.error("Error fetching transfers", error);
            } finally {
                setLoading(false);
            }
        };
        if (staffId) {
            fetchTransfers();
        }
    }, [staffId]);

    const handleDownloadLetter = async (transferId: string, staffName: string) => {
        setDownloadingId(transferId);
        try {
            const response = await api.get(`/api/registry/transfers/${transferId}/letter`, {
                responseType: 'blob'
            });
            const blobUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `Posting-Order-${(staffName || 'Staff').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (err: any) {
            alert('Failed to download posting order letter: ' + (err.response?.data?.message || err.message));
        } finally {
            setDownloadingId(null);
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-slate-400">
                <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    <span>Loading posting &amp; transfer history...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <ArrowRight size={20} className="text-indigo-600" />
                        <span>Official Posting &amp; Transfer Record</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Chronological audit trail of institutional redeployments and transfers.
                    </p>
                </div>
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-full">
                    {transfers.length} {transfers.length === 1 ? 'Record' : 'Records'}
                </span>
            </div>

            {transfers.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <MapPin className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No transfer or redeployment records found</p>
                    <p className="text-xs text-slate-400 mt-1">This staff member has remained in their primary duty station.</p>
                </div>
            ) : (
                <div className="relative border-l-2 border-indigo-100 ml-4 space-y-6 pb-2">
                    {transfers.map((transfer) => {
                        const isApproved = transfer.status === 'APPROVED' || transfer.status === 'AUTHORIZED' || transfer.isEffective;
                        const oldLoc = transfer.oldLocation || transfer.oldUnit?.name || transfer.oldCenterId || 'Previous Duty Station';
                        const newLoc = transfer.newLocation || transfer.newUnit?.name || transfer.newCenterId || 'Target Station';

                        return (
                            <div key={transfer.id} className="relative pl-6">
                                {/* Timeline dot */}
                                <span className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full ring-4 ring-white flex items-center justify-center ${
                                    isApproved ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}>
                                    {isApproved ? <CheckCircle2 size={10} className="text-white" /> : <Clock size={10} className="text-white" />}
                                </span>

                                <div className="bg-slate-50/80 rounded-xl border border-slate-100 p-4 hover:shadow-md transition-shadow">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-sm text-slate-900">{oldLoc}</span>
                                            <ArrowRight size={14} className="text-indigo-500" />
                                            <span className="font-bold text-sm text-indigo-700">{newLoc}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                            }`}>
                                                {isApproved ? 'Authorized / Effective' : (transfer.status || 'Pending Authorization')}
                                            </span>
                                            <span className="text-xs font-medium text-slate-500">
                                                {new Date(transfer.effectiveDate || transfer.createdAt).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                                            </span>
                                        </div>
                                    </div>

                                    {transfer.reason && (
                                        <div className="text-xs text-slate-600 mt-2.5 bg-white p-2.5 rounded-lg border border-slate-100">
                                            <span className="font-semibold text-slate-700">Official Directive / Reason: </span>
                                            {transfer.reason}
                                        </div>
                                    )}

                                    <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            {transfer.authorizedBy?.name && (
                                                <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                                                    <ShieldCheck size={14} className="text-emerald-600" />
                                                    Authorized by {transfer.authorizedBy.name}
                                                </span>
                                            )}
                                            {transfer.initiatedBy?.name && (
                                                <span className="inline-flex items-center gap-1 text-slate-500">
                                                    <UserCheck size={14} className="text-slate-400" />
                                                    Initiated by {transfer.initiatedBy.name}
                                                </span>
                                            )}
                                            {transfer.digitalSignatureRef && (
                                                <span className="font-mono text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                                    Seal: {transfer.digitalSignatureRef}
                                                </span>
                                            )}
                                        </div>

                                        {isApproved && (
                                            <button
                                                onClick={() => handleDownloadLetter(transfer.id, transfer.staff?.name)}
                                                disabled={downloadingId === transfer.id}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors disabled:opacity-50"
                                            >
                                                <Download size={12} />
                                                <span>{downloadingId === transfer.id ? 'Generating...' : 'Posting Order PDF'}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
