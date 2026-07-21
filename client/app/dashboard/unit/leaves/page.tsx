'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';
import { CheckCircle, XCircle, Clock, User, ArrowRight, Eye, Calendar, Search, Filter, ShieldCheck, MapPin, Building, Award, UserCheck } from 'lucide-react';
import DocumentViewerModal from '../../../../components/dashboard/DocumentViewerModal';
import Pagination from '../../../../components/ui/Pagination';

export default function UnitLeavesPage() {
    const searchParams = useSearchParams();
    const defaultTab = searchParams.get('tab') === 'active' ? 'active' : 'pending';
    const [activeTab, setActiveTab] = useState<'pending' | 'active'>(defaultTab);

    // Pending Leaves state
    const [leaves, setLeaves] = useState<any[]>([]);
    const [loadingPending, setLoadingPending] = useState(true);
    const { user: currentUser } = useAuth();
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Active Leaves Directory state
    const [activeLeaves, setActiveLeaves] = useState<any[]>([]);
    const [loadingActive, setLoadingActive] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [leaveTypeFilter, setLeaveTypeFilter] = useState('ALL');
    const [activeCurrentPage, setActiveCurrentPage] = useState(1);

    // Modal state for leave request review
    const [selectedLeave, setSelectedLeave] = useState<any | null>(null);
    const [approvedDays, setApprovedDays] = useState<number>(0);
    const [rejectionReason, setRejectionReason] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [viewingAttachment, setViewingAttachment] = useState<any | null>(null);

    // Check permissions
    const isHOD = currentUser?.role === 'UNIT_HEAD' && currentUser?.staffProfile?.unit?.type === 'DEPARTMENT';
    const isDean = currentUser?.role === 'UNIT_HEAD' && currentUser?.staffProfile?.unit?.type === 'FACULTY';
    const canApprove = ['UNIT_HEAD', 'STUDY_CENTER_MANAGER', 'HR_ADMIN', 'ADMIN', 'SUPER_USER', 'VICE_CHANCELLOR'].includes(currentUser?.role || '');

    useEffect(() => {
        if (canApprove) fetchPendingLeaves();
        fetchActiveLeaves();
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
            console.error('Failed to fetch pending leaves', error);
        } finally {
            setLoadingPending(false);
        }
    };

    const fetchActiveLeaves = async () => {
        try {
            const { data } = await api.get('/api/leaves/active');
            setActiveLeaves(data);
        } catch (error) {
            console.error('Failed to fetch active leaves directory', error);
        } finally {
            setLoadingActive(false);
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
            fetchActiveLeaves();
        } catch (error) {
            console.error('Failed to update leave status', error);
            alert('Failed to update status');
        } finally {
            setSubmitting(false);
        }
    };

    // Filter Active Leaves Directory
    const filteredActiveLeaves = useMemo(() => {
        return activeLeaves.filter(leave => {
            const matchesQuery = 
                !searchQuery.trim() ||
                leave.staff?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                leave.staff?.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                leave.type?.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesType = leaveTypeFilter === 'ALL' || leave.type === leaveTypeFilter;

            return matchesQuery && matchesType;
        });
    }, [activeLeaves, searchQuery, leaveTypeFilter]);

    const paginatedLeaves = useMemo(() => {
        return leaves.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    }, [leaves, currentPage, pageSize]);

    const paginatedActiveLeaves = useMemo(() => {
        return filteredActiveLeaves.slice((activeCurrentPage - 1) * pageSize, activeCurrentPage * pageSize);
    }, [filteredActiveLeaves, activeCurrentPage, pageSize]);

    const totalPagesPending = Math.max(1, Math.ceil(leaves.length / pageSize));
    const totalPagesActive = Math.max(1, Math.ceil(filteredActiveLeaves.length / pageSize));

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-300">
                            Enterprise Absence Hub
                        </span>
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Leave &amp; Absence Directory</h1>
                    <p className="text-xs text-gray-500 mt-1">
                        International standard leave workflow, approval matrix, and real-time university active absence directory.
                    </p>
                </div>

                {/* Tab Controls */}
                <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 self-start md:self-auto">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'active'
                                ? 'bg-white text-emerald-900 shadow-sm border border-gray-200'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <Calendar size={15} className="text-emerald-700" />
                        <span>Active Leaves Directory ({activeLeaves.length})</span>
                    </button>

                    {canApprove && (
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                activeTab === 'pending'
                                    ? 'bg-white text-emerald-900 shadow-sm border border-gray-200'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Clock size={15} className="text-amber-600" />
                            <span>Pending Approvals ({leaves.length})</span>
                        </button>
                    )}
                </div>
            </div>

            {/* TAB 1: ACTIVE LEAVES DIRECTORY */}
            {activeTab === 'active' && (
                <div className="space-y-6">
                    {/* Search & Filter Bar */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search staff name, unit, or location..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white text-gray-900"
                            />
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <Filter size={15} className="text-gray-400" />
                            <select
                                value={leaveTypeFilter}
                                onChange={e => setLeaveTypeFilter(e.target.value)}
                                className="p-2.5 border border-gray-300 rounded-xl bg-white text-xs text-gray-800 font-semibold focus:outline-none focus:border-emerald-600"
                            >
                                <option value="ALL">All Leave Types</option>
                                <option value="ANNUAL">Annual Leave</option>
                                <option value="SABBATICAL">Sabbatical Leave</option>
                                <option value="STUDY">Study Leave</option>
                                <option value="MATERNITY">Maternity Leave</option>
                                <option value="SICK">Sick Leave</option>
                                <option value="CASUAL">Casual Leave</option>
                            </select>

                            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-2 rounded-xl border border-gray-200">
                                {filteredActiveLeaves.length} Staff Currently On Leave
                            </span>
                        </div>
                    </div>

                    {/* Directory Table Card */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div style={{ backgroundColor: '#006533', color: '#ffffff' }} className="px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="p-2 bg-white/20 rounded-lg"><UserCheck size={18} /></span>
                                <div>
                                    <h2 className="font-bold text-sm tracking-tight">Active Absence &amp; Leave Registry</h2>
                                    <p className="text-[11px] text-emerald-100">Live roster of university academic and non-academic staff currently on approved leave.</p>
                                </div>
                            </div>
                        </div>

                        {loadingActive ? (
                            <div className="p-12 text-center text-gray-500 text-sm">
                                Loading Active Leaves Directory...
                            </div>
                        ) : filteredActiveLeaves.length === 0 ? (
                            <div className="p-16 text-center text-gray-400 text-sm space-y-2">
                                <Calendar size={36} className="mx-auto text-gray-300" />
                                <p className="font-bold text-gray-600">No active staff leave records found</p>
                                <p className="text-xs text-gray-400">There are currently no staff members matching the search parameters on active leave.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                                            <th className="py-3.5 px-6">Staff Member</th>
                                            <th className="py-3.5 px-6">Leave Type</th>
                                            <th className="py-3.5 px-6">Unit / Location</th>
                                            <th className="py-3.5 px-6">Resumption Date</th>
                                            <th className="py-3.5 px-6 text-center">Countdown</th>
                                            <th className="py-3.5 px-6 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedActiveLeaves.map(leave => (
                                            <tr key={leave.id} className="hover:bg-emerald-50/30 transition">
                                                <td className="py-4 px-6 font-bold text-gray-900">
                                                    <div>{leave.staff?.name}</div>
                                                    <div className="text-[10px] font-normal text-gray-500">{leave.staff?.cadre} • {leave.staff?.staffId}</div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase border border-emerald-300">
                                                        {leave.type?.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-gray-600 font-semibold">{leave.staff?.location}</td>
                                                <td className="py-4 px-6 text-gray-600 font-medium">
                                                    {new Date(leave.startDate).toLocaleDateString()} → <span className="font-bold text-gray-900">{new Date(leave.endDate).toLocaleDateString()}</span>
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    <TableCountdownBadge endDate={leave.endDate} />
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white font-bold text-[10px] uppercase shadow-sm">
                                                        ON LEAVE
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {filteredActiveLeaves.length > 0 && (
                            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                                <Pagination
                                    currentPage={activeCurrentPage}
                                    totalPages={totalPagesActive}
                                    totalItems={filteredActiveLeaves.length}
                                    pageSize={pageSize}
                                    onPageChange={setActiveCurrentPage}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: PENDING APPROVALS */}
            {activeTab === 'pending' && canApprove && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-200 bg-amber-50/50 flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Pending Unit Leave Approvals</h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {isHOD ? 'Recommend department staff requests for Dean approval' : 
                                 isDean ? 'Review recommended department requests for final Faculty approval' : 
                                 'Review and approve unit or study center staff requests'}
                            </p>
                        </div>
                        <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-full">
                            {leaves.length} Action Required
                        </span>
                    </div>

                    {loadingPending ? (
                        <div className="p-12 text-center text-gray-500 text-sm">Loading pending leave applications...</div>
                    ) : leaves.length === 0 ? (
                        <div className="p-16 text-center text-gray-400 text-sm italic">
                            No pending leave requests requiring action.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                                        <th className="py-3.5 px-6">Staff Member</th>
                                        <th className="py-3.5 px-6">Leave Type</th>
                                        <th className="py-3.5 px-6">Requested Dates</th>
                                        <th className="py-3.5 px-6">Duration</th>
                                        <th className="py-3.5 px-6 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedLeaves.map(leave => (
                                        <tr key={leave.id} className="hover:bg-gray-50 transition">
                                            <td className="py-4 px-6 font-bold text-gray-900">
                                                {leave.staff ? `${leave.staff.title || ''} ${leave.staff.surname} ${leave.staff.otherNames}` : 'Staff Member'}
                                            </td>
                                            <td className="py-4 px-6 font-semibold text-emerald-800">{leave.type.replace(/_/g, ' ')}</td>
                                            <td className="py-4 px-6 text-gray-600">
                                                {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                                            </td>
                                            <td className="py-4 px-6 font-bold text-gray-900">{leave.durationDays || '—'} Days</td>
                                            <td className="py-4 px-6 text-right">
                                                <button
                                                    onClick={() => setSelectedLeave(leave)}
                                                    style={{ backgroundColor: '#006533', color: '#ffffff' }}
                                                    className="px-4 py-1.5 text-xs font-bold rounded-lg transition shadow-sm hover:opacity-90"
                                                >
                                                    Review Request
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Leave Review Modal */}
            {selectedLeave && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl border border-gray-200">
                        <div className="border-b border-gray-100 pb-4">
                            <h2 className="text-xl font-bold text-gray-900">Review Leave Application</h2>
                            <p className="text-xs text-gray-500 mt-1">
                                Applied by <span className="font-bold text-gray-800">{selectedLeave.staff ? `${selectedLeave.staff.surname} ${selectedLeave.staff.otherNames}` : 'Staff'}</span>
                            </p>
                        </div>

                        <div className="space-y-3 text-xs bg-gray-50 p-4 rounded-2xl border border-gray-200">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Leave Type:</span>
                                <span className="font-bold text-gray-900">{selectedLeave.type.replace(/_/g, ' ')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Requested Duration:</span>
                                <span className="font-bold text-gray-900">{selectedLeave.durationDays} Days</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Start / Resumption Date:</span>
                                <span className="font-semibold text-gray-800">
                                    {new Date(selectedLeave.startDate).toLocaleDateString()} to {new Date(selectedLeave.endDate).toLocaleDateString()}
                                </span>
                            </div>
                            {selectedLeave.reason && (
                                <div>
                                    <span className="text-gray-500 block mb-1">Reason:</span>
                                    <p className="bg-white p-2.5 rounded-xl border border-gray-200 text-gray-700 italic">{selectedLeave.reason}</p>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setSelectedLeave(null)}
                                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => handleActionSubmit('REJECTED')}
                                disabled={submitting}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                            >
                                Reject
                            </button>
                            <button
                                type="button"
                                onClick={() => handleActionSubmit(isHOD ? 'RECOMMENDED' : 'APPROVED')}
                                disabled={submitting}
                                style={{ backgroundColor: '#006533', color: '#ffffff' }}
                                className="px-5 py-2 text-xs font-bold rounded-xl shadow-sm hover:opacity-90 transition disabled:opacity-50"
                            >
                                {isHOD ? 'Recommend for Approval' : 'Approve Leave'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TableCountdownBadge({ endDate }: { endDate: string }) {
    const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; isResumed: boolean }>({
        days: 0, hours: 0, minutes: 0, isResumed: false
    });

    useEffect(() => {
        const calculateTime = () => {
            const end = new Date(endDate).getTime();
            const now = new Date().getTime();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, isResumed: true });
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            setTimeLeft({ days, hours, minutes, isResumed: false });
        };

        calculateTime();
        const interval = setInterval(calculateTime, 1000);
        return () => clearInterval(interval);
    }, [endDate]);

    if (timeLeft.isResumed) {
        return (
            <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 font-bold text-[10px] uppercase border border-gray-200">
                Duty Resumed
            </span>
        );
    }

    return (
        <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-white font-mono text-[10px] font-bold border border-emerald-700 shadow-sm inline-flex items-center gap-1">
            <Clock size={11} className="text-emerald-400 animate-spin" />
            {timeLeft.days}d {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m
        </span>
    );
}
