'use client';

import { useState, useEffect } from 'react';
import api from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';
import { ArrowRight, Calendar, User, History, Plus, FileInput } from 'lucide-react';
import TransferStaffModal from '../../../../components/dashboard/TransferStaffModal';

export default function TransferHistoryPage() {
    const { user } = useAuth();
    const [transfers, setTransfers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const fetchHistory = async () => {
        try {
            const { data } = await api.get('/api/registry/transfers');
            setTransfers(data);
        } catch (error) {
            console.error('Failed to fetch transfers', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading transfer history...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <History size={24} className="text-blue-600" />
                        Transfer History
                    </h1>
                    <p className="text-sm text-gray-500">Log of all staff movements and postings.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 shadow-sm"
                    >
                        <Plus size={18} />
                        New Transfer
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Movement</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Initiated By</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {transfers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    No transfer records found.
                                </td>
                            </tr>
                        ) : (
                            transfers.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} />
                                            {new Date(log.effectiveDate).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs mr-3">
                                                {log.staff?.name?.charAt(0) || 'S'}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{log.staff?.name || 'Unknown'}</div>
                                                <div className="text-xs text-gray-500">{log.staff?.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-sm text-gray-900">
                                            <span className="bg-gray-100 text-gray-600 py-1 px-2 rounded text-xs">{log.oldCenterId || 'Unassigned'}</span>
                                            <ArrowRight size={14} className="text-gray-400" />
                                            <span className="bg-green-100 text-green-700 py-1 px-2 rounded text-xs truncate max-w-[150px]">{log.newCenterId}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                        {log.reason}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {log.initiatedBy?.name || 'System'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <TransferStaffModal
                    onClose={() => setShowModal(false)}
                    onSuccess={fetchHistory}
                />
            )}
        </div>
    );
}
