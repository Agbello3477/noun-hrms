'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';
import api from '../../../lib/api';

export default function LeaveHistoryTab({ staffId }: { staffId: string }) {
    const [leaves, setLeaves] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaves = async () => {
            try {
                const { data } = await api.get(`/api/leaves?staffId=${staffId}`);
                setLeaves(data);
            } catch (error) {
                console.error("Error fetching leaves", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaves();
    }, [staffId]);

    if (loading) return <div className="p-8 text-center animate-pulse">Loading leave history...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Calendar size={20} className="text-nounGreen" /> Leave Records
                </h3>
            </div>

            {leaves.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <Clock className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-gray-500 font-medium">No leave records found.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Duration</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Reason</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {leaves.map((leave) => (
                                <tr key={leave.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{leave.type.replace(/_/g, ' ')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}<br/>
                                        <span className="text-xs text-gray-400">({leave.durationDays} days)</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={leave.reason}>{leave.reason}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                            ${leave.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
                                              leave.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 
                                              leave.status === 'RECOMMENDED' ? 'bg-blue-100 text-blue-800' : 
                                              'bg-yellow-100 text-yellow-800'}`}>
                                            {leave.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
