
'use client';

import { useState, useEffect } from 'react';
import api from '../../../../lib/api';
import { CheckCircle, XCircle, Clock, User } from 'lucide-react';

export default function UnitLeavesPage() {
    const [leaves, setLeaves] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPendingLeaves();
    }, []);

    const fetchPendingLeaves = async () => {
        try {
            const { data } = await api.get('/api/leaves/pending');
            setLeaves(data);
        } catch (error) {
            console.error('Failed to fetch leaves', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (leaveId: string, action: 'APPROVED' | 'REJECTED') => {
        if (!confirm(`Are you sure you want to ${action} this request?`)) return;

        try {
            await api.post('/api/leaves/status', {
                leaveId,
                status: action
            });
            // Optimistic update
            setLeaves(leaves.filter(l => l.id !== leaveId));
        } catch (error) {
            alert('Failed to update status');
        }
    };

    if (loading) return <div className="p-6">Loading requests...</div>;

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Unit Leave Approvals</h1>

            {leaves.length === 0 ? (
                <div className="bg-white p-8 rounded-lg text-center text-gray-500 shadow-sm border border-gray-200">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
                    <p className="text-lg">No pending leave requests!</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {leaves.map((leave) => (
                                <tr key={leave.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                                                <User size={20} className="text-gray-500" />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{leave.user.name}</div>
                                                <div className="text-sm text-gray-500">{leave.user.email}</div>
                                                <div className="text-xs text-blue-600 mt-1">
                                                    {leave.user.staffProfile?.cadre || 'Staff'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                            {leave.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div>
                                            {new Date(leave.startDate).toLocaleDateString()} -
                                            {new Date(leave.endDate).toLocaleDateString()}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                            <Clock size={12} />
                                            {Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24))} Days
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                        {leave.reason}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleAction(leave.id, 'APPROVED')}
                                            className="text-green-600 hover:text-green-900 mr-4 font-bold"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleAction(leave.id, 'REJECTED')}
                                            className="text-red-600 hover:text-red-900 font-bold"
                                        >
                                            Reject
                                        </button>
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
