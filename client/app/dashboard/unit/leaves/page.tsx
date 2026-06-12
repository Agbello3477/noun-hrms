'use client';

import { useState, useEffect } from 'react';
import api from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';
import { CheckCircle, XCircle, Clock, User, ArrowRight, Eye } from 'lucide-react';

export default function UnitLeavesPage() {
    const [leaves, setLeaves] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { user: currentUser } = useAuth();

    // Modal state for leave request review
    const [selectedLeave, setSelectedLeave] = useState<any | null>(null);
    const [approvedDays, setApprovedDays] = useState<number>(0);
    const [rejectionReason, setRejectionReason] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);

    // Check if the current manager is an HOD (Head of Department)
    const isHOD = currentUser?.role === 'UNIT_HEAD' && currentUser?.staffProfile?.unit?.type === 'DEPARTMENT';
    const isDean = currentUser?.role === 'UNIT_HEAD' && currentUser?.staffProfile?.unit?.type === 'FACULTY';

    useEffect(() => {
        fetchPendingLeaves();
    }, []);

    useEffect(() => {
        if (selectedLeave) {
            const duration = selectedLeave.durationDays || Math.ceil((new Date(selectedLeave.endDate).getTime() - new Date(selectedLeave.startDate).getTime()) / (1000 * 60 * 60 * 24)) || 1;
            setApprovedDays(duration);
            setRejectionReason('');
        }
    }, [selectedLeave]);

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

    const handleActionSubmit = async (action: 'APPROVED' | 'REJECTED' | 'RECOMMENDED') => {
        if (action === 'REJECTED' && !rejectionReason.trim()) {
            alert('Please state a reason for rejecting the leave request.');
            return;
        }

        const actionDisplay = action === 'RECOMMENDED' ? 'recommend' : action === 'APPROVED' ? 'approve' : 'reject';
        if (!confirm(`Are you sure you want to ${actionDisplay} this request?`)) return;

        setSubmitting(true);
        try {
            await api.post('/api/leaves/status', {
                leaveId: selectedLeave.id,
                status: action,
                comment: action === 'REJECTED' ? rejectionReason : undefined,
                approvedDays: action === 'APPROVED' ? approvedDays : undefined
            });
            alert(`Leave request successfully ${action.toLowerCase()}d.`);
            setLeaves(leaves.filter(l => l.id !== selectedLeave.id));
            setSelectedLeave(null);
        } catch (error) {
            console.error('Failed to update leave status', error);
            alert('Failed to update status');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-6">Loading requests...</div>;

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Unit Leave Approvals</h1>
                <p className="text-sm text-gray-500">
                    {isHOD ? 'Recommend department staff requests for Dean approval' : 
                     isDean ? 'Review recommended department requests for final Faculty approval' : 
                     'Review and approve unit or study center staff requests'}
                </p>
            </div>

            {leaves.length === 0 ? (
                <div className="bg-white p-8 rounded-lg text-center text-gray-500 shadow-sm border border-gray-200">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
                    <p className="text-lg font-semibold text-gray-700">No pending leave requests!</p>
                    <p className="text-sm text-gray-400 mt-1">All leave files in your unit have been processed.</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {leaves.map((leave) => {
                                const staffUser = leave.staff?.user || leave.user || {};
                                const staffProfile = leave.staff || leave.user?.staffProfile || {};
                                const duration = leave.durationDays || Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)) || 1;

                                return (
                                    <tr key={leave.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center font-bold text-indigo-600 shadow-sm border border-indigo-100">
                                                    {staffUser.name?.charAt(0) || 'U'}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-semibold text-gray-900">{staffUser.name || 'Staff Member'}</div>
                                                    <div className="text-xs text-gray-500">{staffUser.email || ''}</div>
                                                    <div className="text-[10px] uppercase font-bold text-indigo-500 mt-1">
                                                        {staffProfile.cadre || 'Staff'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                                                {leave.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="font-semibold text-gray-700">
                                                {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                <Clock size={12} />
                                                {duration} Days
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={(leave.reason || '').replace(/<[^>]*>/g, '')}>
                                            {(leave.reason || '').replace(/<[^>]*>/g, '') || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => setSelectedLeave(leave)}
                                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
                                            >
                                                <Eye size={14} />
                                                <span>Review Request</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

        {/* Review Modal */}
        {selectedLeave && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
                <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                    {/* Modal Header */}
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-800">
                            Review Leave Request
                        </h2>
                        <button
                            onClick={() => setSelectedLeave(null)}
                            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <XCircle size={20} />
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                        {/* Staff Profile Details */}
                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-3">
                            <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider">Staff Details</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-gray-400 block text-xs">Name</span>
                                    <span className="font-semibold text-gray-800">{selectedLeave.staff?.user?.name || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block text-xs">Email</span>
                                    <span className="font-semibold text-gray-800">{selectedLeave.staff?.user?.email || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block text-xs">Level / Cadre</span>
                                    <span className="font-semibold text-gray-800">
                                        {selectedLeave.staff?.level ? `Level ${selectedLeave.staff.level}` : 'N/A'} 
                                        {selectedLeave.staff?.cadre ? ` (${selectedLeave.staff.cadre})` : ''}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block text-xs">Placement</span>
                                    <span className="font-semibold text-gray-800">
                                        {selectedLeave.staff?.studyCenter?.name || selectedLeave.staff?.unit?.name || 'Main Registry'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Leave Details */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Application Details</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 border border-gray-150 rounded-xl p-4">
                                <div>
                                    <span className="text-gray-400 block text-xs">Leave Type</span>
                                    <span className="font-semibold text-gray-800 uppercase tracking-wide">{selectedLeave.type}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block text-xs">Applied Duration</span>
                                    <span className="font-semibold text-gray-850">
                                        {selectedLeave.durationDays || Math.ceil((new Date(selectedLeave.endDate).getTime() - new Date(selectedLeave.startDate).getTime()) / (1000 * 60 * 60 * 24)) || 1} Days
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-gray-400 block text-xs font-medium">Applied Period</span>
                                    <span className="font-semibold text-gray-800">
                                        {new Date(selectedLeave.startDate).toLocaleDateString()} to {new Date(selectedLeave.endDate).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="col-span-2 border-t pt-2 border-gray-200">
                                    <span className="text-gray-400 block text-xs">Reason</span>
                                    <div 
                                        dangerouslySetInnerHTML={{ __html: selectedLeave.reason || 'No reason provided' }} 
                                        className="text-gray-700 text-xs mt-1 prose max-w-none leading-relaxed" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Decision & Corrections Form */}
                        <div className="space-y-4 pt-2 border-t">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Manager Decision</h3>
                            
                            {!isHOD && (
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider" htmlFor="approvedDays">
                                        Days to Approve
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="number"
                                            id="approvedDays"
                                            min="1"
                                            max={selectedLeave.durationDays || 30}
                                            className="w-24 border rounded-xl px-3 py-2 text-center font-semibold text-gray-700 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-100"
                                            value={approvedDays}
                                            onChange={(e) => setApprovedDays(Math.max(1, parseInt(e.target.value) || 1))}
                                        />
                                        <span className="text-xs text-gray-400">
                                            Applied for {selectedLeave.durationDays} days. You can reduce this number of days if needed.
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider" htmlFor="rejectionReason">
                                    Rejection Reason <span className="text-red-500 font-normal">(Required only if rejecting)</span>
                                </label>
                                <textarea
                                    id="rejectionReason"
                                    rows={3}
                                    className="w-full border rounded-xl p-3 text-xs text-gray-755 placeholder-gray-400 bg-gray-55/30 focus:bg-white outline-none focus:ring-2 focus:ring-blue-100"
                                    placeholder="Provide reason here if you decide to reject the leave..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-4 border-t border-gray-250 bg-gray-50 flex flex-col sm:flex-row gap-3 sm:justify-end">
                        <button
                            onClick={() => setSelectedLeave(null)}
                            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-750 hover:bg-gray-100 rounded-xl text-xs font-bold shadow-sm transition-colors"
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleActionSubmit('REJECTED')}
                            className="px-5 py-2.5 bg-red-650 hover:bg-red-755 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                            disabled={submitting}
                        >
                            Reject
                        </button>
                        {isHOD ? (
                            <button
                                onClick={() => handleActionSubmit('RECOMMENDED')}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1"
                                disabled={submitting}
                            >
                                <span>Recommend</span>
                                <ArrowRight size={12} />
                            </button>
                        ) : (
                            <button
                                onClick={() => handleActionSubmit('APPROVED')}
                                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                                disabled={submitting}
                            >
                                Approve Days
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
);
}
