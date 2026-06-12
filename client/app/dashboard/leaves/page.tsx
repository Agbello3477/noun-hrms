'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';
import Link from 'next/link';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Plus, FileText } from 'lucide-react';

export default function LeavesPage() {
    const [leaves, setLeaves] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMyLeaves();
    }, []);

    const fetchMyLeaves = async () => {
        try {
            const { data } = await api.get('/api/leaves/me');
            setLeaves(data);
        } catch (error) {
            console.error('Failed to fetch my leaves', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return (
                    <span className="px-2.5 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-md bg-green-50 text-green-700 border border-green-100">
                        <CheckCircle size={12} />
                        Approved
                    </span>
                );
            case 'REJECTED':
                return (
                    <span className="px-2.5 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-md bg-red-50 text-red-700 border border-red-100">
                        <XCircle size={12} />
                        Rejected
                    </span>
                );
            case 'RECOMMENDED':
                return (
                    <span className="px-2.5 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                        <AlertCircle size={12} />
                        Recommended
                    </span>
                );
            default:
                return (
                    <span className="px-2.5 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-md bg-yellow-50 text-yellow-700 border border-yellow-100">
                        <Clock size={12} />
                        Pending
                    </span>
                );
        }
    };

    // Scored Stats counts
    const totalRequests = leaves.length;
    const pendingCount = leaves.filter(l => l.status === 'PENDING').length;
    const approvedCount = leaves.filter(l => l.status === 'APPROVED').length;
    const rejectedCount = leaves.filter(l => l.status === 'REJECTED').length;

    if (loading) {
        return (
            <div className="p-6 max-w-6xl mx-auto flex items-center justify-center min-h-[50vh]">
                <div className="text-gray-500 font-medium">Loading your leaves...</div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Leave Applications</h1>
                    <p className="text-sm text-gray-500 mt-1">Track and manage your leave requests and sabbatical applications</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Link
                        href="/dashboard/leaves/sabbatical"
                        className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-gray-750 text-xs font-bold transition-all shadow-sm"
                    >
                        <FileText size={14} />
                        <span>Sabbatical Apply</span>
                    </Link>
                    <Link
                        href="/dashboard/leaves/apply"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
                    >
                        <Plus size={14} />
                        <span>Apply for Leave</span>
                    </Link>
                </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm space-y-2">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">Total Applied</span>
                    <span className="text-2xl font-black text-gray-800 block">{totalRequests}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm space-y-2">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">Pending</span>
                    <span className="text-2xl font-black text-yellow-600 block">{pendingCount}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm space-y-2">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">Approved</span>
                    <span className="text-2xl font-black text-green-600 block">{approvedCount}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm space-y-2">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">Rejected</span>
                    <span className="text-2xl font-black text-red-600 block">{rejectedCount}</span>
                </div>
            </div>

            {/* Main Leaves List */}
            {leaves.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-xl mx-auto shadow-sm space-y-4">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                        <Calendar size={28} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-bold text-gray-800 text-lg">No leave applications yet</h3>
                        <p className="text-sm text-gray-500">When you submit a leave request, it will appear here with its approval details.</p>
                    </div>
                    <div className="pt-2">
                        <Link
                            href="/dashboard/leaves/apply"
                            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
                        >
                            <Plus size={14} />
                            <span>Apply Now</span>
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Leave Type</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dates</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason for Apply</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {leaves.map((leave) => {
                                    const duration = leave.durationDays || Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)) || 1;
                                    return (
                                        <tr key={leave.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-bold text-gray-800 text-sm">{leave.type}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-gray-700 font-semibold text-sm">{duration} Days</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="font-medium text-gray-700">
                                                    {new Date(leave.startDate).toLocaleDateString()}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-0.5">
                                                    to {new Date(leave.endDate).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs text-sm text-gray-600 truncate" title={(leave.reason || '').replace(/<[^>]*>/g, '')}>
                                                {(leave.reason || '').replace(/<[^>]*>/g, '') || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-1.5 items-start">
                                                    {getStatusBadge(leave.status)}
                                                    {leave.status === 'REJECTED' && leave.rejectionReason && (
                                                        <span className="text-[11px] text-red-500 max-w-[200px] whitespace-normal leading-tight italic">
                                                            "{leave.rejectionReason}"
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
