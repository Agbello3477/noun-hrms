'use client';

import { useState, useEffect } from 'react';
import { RefreshCcw, MapPin } from 'lucide-react';
import api from '../../../lib/api';

export default function TransferHistoryTab({ staffId }: { staffId: string }) {
    const [transfers, setTransfers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTransfers = async () => {
            try {
                // If there's no staff-specific transfer endpoint, we can use the global one and filter,
                // or assume backend will handle it. We will use /api/registry/transfers?staffId=X 
                // However, current getTransferHistory in transfer.controller.ts might not filter by staffId.
                // We'll pass it anyway, backend should ideally support it.
                const { data } = await api.get(`/api/registry/transfers`);
                // Client-side filter as fallback
                const filtered = data.filter((t: any) => t.staff?.staffProfile?.staffId === staffId || t.staffId === staffId || t.staff?.id === staffId);
                setTransfers(filtered);
            } catch (error) {
                console.error("Error fetching transfers", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTransfers();
    }, [staffId]);

    if (loading) return <div className="p-8 text-center animate-pulse">Loading posting history...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <RefreshCcw size={20} className="text-nounGreen" /> Posting & Transfer History
                </h3>
            </div>

            {transfers.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <MapPin className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-gray-500 font-medium">No previous postings or transfers recorded.</p>
                </div>
            ) : (
                <div className="relative border-l border-gray-200 ml-4 space-y-8 pb-4">
                    {transfers.map((transfer, idx) => (
                        <div key={transfer.id} className="relative pl-6">
                            {/* Timeline dot */}
                            <span className="absolute -left-1.5 top-1.5 w-3 h-3 bg-nounGreen rounded-full ring-4 ring-white"></span>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                                <h4 className="text-sm font-bold text-gray-900">
                                    Transferred to {transfer.newCenterId || 'New Location'}
                                </h4>
                                <span className="text-xs font-medium text-gray-500 mt-1 sm:mt-0 bg-gray-100 px-2 py-1 rounded">
                                    {new Date(transfer.effectiveDate).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">From: {transfer.oldCenterId || 'Unknown Location'}</p>
                            {transfer.reason && (
                                <p className="text-sm text-gray-500 mt-2 bg-gray-50 p-2 rounded italic">
                                    Reason: {transfer.reason}
                                </p>
                            )}
                            <p className="text-xs text-gray-400 mt-2">Initiated by {transfer.initiatedBy?.name || 'System'}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
