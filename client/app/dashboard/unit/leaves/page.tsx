'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';
import {
    CheckCircle,
    XCircle,
    Clock,
    User,
    ArrowRight,
    Eye,
    Calendar,
    Search,
    Filter,
    ShieldCheck,
    MapPin,
    Building,
    Award,
    UserCheck,
    FileText,
    AlertTriangle,
    Check
} from 'lucide-react';
import DocumentViewerModal from '../../../../components/dashboard/DocumentViewerModal';
import Pagination from '../../../../components/ui/Pagination';
import { Button } from '../../../../components/ui/Button';

const STATUTORY_LEAVE_TYPES = [
    { value: 'ALL', label: 'All Leave Categories' },
    { value: 'ANNUAL', label: 'Annual Leave' },
    { value: 'TERMINAL', label: 'Terminal Leave' },
    { value: 'RESEARCH', label: 'Research Leave' },
    { value: 'STUDY', label: 'Study Leave' },
    { value: 'TRAINING', label: 'Training Leave' },
    { value: 'CASUAL', label: 'Casual Leave' },
    { value: 'EXAMINATION', label: 'Examination Leave' },
    { value: 'EXTERNAL_ACADEMIC_AWARD', label: 'External Academic Award' },
    { value: 'SABBATICAL', label: 'Sabbatical Leave' },
    { value: 'MATERNITY', label: 'Maternity Leave' },
    { value: 'PATERNITY', label: 'Paternity Leave' },
    { value: 'SICK', label: 'Sick Leave' },
    { value: 'LEAVE_OF_ABSENCE_WITHOUT_PAY', label: 'Leave of Absence (Without Pay)' }
];

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

    // Filters for Pending Leaves
    const [pendingSearchQuery, setPendingSearchQuery] = useState('');
    const [pendingTypeFilter, setPendingTypeFilter] = useState('ALL');
    const [pendingScaleFilter, setPendingScaleFilter] = useState('ALL');
    const [pendingStatusFilter, setPendingStatusFilter] = useState('ALL');

    // Active Leaves Directory state
    const [activeLeaves, setActiveLeaves] = useState<any[]>([]);
    const [loadingActive, setLoadingActive] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [leaveTypeFilter, setLeaveTypeFilter] = useState('ALL');
    const [activeCurrentPage, setActiveCurrentPage] = useState(1);

    // Modal state for leave request review
    const [selectedLeave, setSelectedLeave] = useState<any | null>(null);
    const [reviewRemarks, setReviewRemarks] = useState<string>('');
    const [submittingAction, setSubmittingAction] = useState<string | null>(null);
    const [viewingAttachment, setViewingAttachment] = useState<any | null>(null);

    // Check roles and permissions
    const userRole = currentUser?.role || '';
    const isRegistryOrExecutive = [
        'HR_ADMIN',
        'REGISTRY_ADMIN',
        'REGISTRAR',
        'DEPUTY_REGISTRAR',
        'SUPER_USER',
        'VICE_CHANCELLOR',
        'ADMIN'
    ].includes(userRole);

    const isHOD = userRole === 'UNIT_HEAD' && currentUser?.staffProfile?.unit?.type === 'DEPARTMENT';
    const isDean = userRole === 'UNIT_HEAD' && currentUser?.staffProfile?.unit?.type === 'FACULTY';
    const canApprove = [
        'UNIT_HEAD',
        'UNIT_ADMIN',
        'STUDY_CENTER_MANAGER',
        'CLINIC_HEAD',
        'SECURITY_HEAD',
        'BURSARY',
        'AUDIT',
        'HR_ADMIN',
        'REGISTRY_ADMIN',
        'REGISTRAR',
        'DEPUTY_REGISTRAR',
        'ADMIN',
        'SUPER_USER',
        'VICE_CHANCELLOR'
    ].includes(userRole);

    useEffect(() => {
        if (canApprove) fetchPendingLeaves();
        fetchActiveLeaves();
    }, [canApprove]);

    useEffect(() => {
        if (selectedLeave) {
            setReviewRemarks('');
        }
    }, [selectedLeave]);

    const fetchPendingLeaves = async () => {
        setLoadingPending(true);
        try {
            // First attempt to call the upgraded statutory API v1 endpoint
            const { data } = await api.get('/api/v1/leave/applications/pending');
            setLeaves(Array.isArray(data) ? data : []);
        } catch (error) {
            console.warn('Failed to fetch from /api/v1/leave/applications/pending, falling back to /api/leaves/pending', error);
            try {
                const { data } = await api.get('/api/leaves/pending');
                setLeaves(Array.isArray(data) ? data : []);
            } catch (fallbackError) {
                console.error('Failed to fetch pending leaves fallback', fallbackError);
            }
        } finally {
            setLoadingPending(false);
        }
    };

    const fetchActiveLeaves = async () => {
        setLoadingActive(true);
        try {
            const { data } = await api.get('/api/leaves/active');
            setActiveLeaves(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch active leaves directory', error);
        } finally {
            setLoadingActive(false);
        }
    };

    // Level 1: HOD Endorsement
    const handleEndorseHod = async () => {
        if (!selectedLeave) return;
        setSubmittingAction('endorse');
        try {
            await api.put(`/api/v1/leave/${selectedLeave.id}/endorse-hod`, {
                remarks: reviewRemarks.trim() || 'Endorsed by Unit Head / HOD for administrative clearance.'
            });
            alert('Leave application endorsed successfully and forwarded to Registry (Level 2).');
            setSelectedLeave(null);
            fetchPendingLeaves();
        } catch (error: any) {
            console.warn('Failed on /endorse-hod, attempting legacy status update', error);
            try {
                await api.post('/api/leaves/status', {
                    leaveId: selectedLeave.id,
                    status: 'RECOMMENDED',
                    comment: reviewRemarks.trim() || undefined
                });
                alert('Leave request recommended successfully.');
                setSelectedLeave(null);
                fetchPendingLeaves();
            } catch (legacyError: any) {
                alert(legacyError.response?.data?.message || error.response?.data?.message || 'Failed to endorse leave application.');
            }
        } finally {
            setSubmittingAction(null);
        }
    };

    // Level 2: Registry Authorization (Final Clearance & Ledger Mutation)
    const handleAuthorizeRegistry = async () => {
        if (!selectedLeave) return;
        setSubmittingAction('authorize');
        try {
            await api.put(`/api/v1/leave/${selectedLeave.id}/authorize-registry`, {
                remarks: reviewRemarks.trim() || 'Authorized by Registry / HR for statutory leave.'
            });
            alert('Leave application officially authorized and leave balance deducted from statutory quota.');
            setSelectedLeave(null);
            fetchPendingLeaves();
            fetchActiveLeaves();
        } catch (error: any) {
            console.warn('Failed on /authorize-registry, attempting legacy status update', error);
            try {
                await api.post('/api/leaves/status', {
                    leaveId: selectedLeave.id,
                    status: 'APPROVED',
                    comment: reviewRemarks.trim() || undefined,
                    approvedDays: selectedLeave.workingDaysCount || selectedLeave.durationDays
                });
                alert('Leave request approved successfully.');
                setSelectedLeave(null);
                fetchPendingLeaves();
                fetchActiveLeaves();
            } catch (legacyError: any) {
                alert(legacyError.response?.data?.message || error.response?.data?.message || 'Failed to authorize leave application.');
            }
        } finally {
            setSubmittingAction(null);
        }
    };

    // Rejection Handler (Any Stage)
    const handleRejectLeave = async () => {
        if (!selectedLeave) return;
        if (!reviewRemarks.trim()) {
            alert('Please provide a specific administrative reason or remark for rejection.');
            return;
        }

        if (!confirm('Are you sure you want to reject this leave application?')) return;

        setSubmittingAction('reject');
        try {
            await api.put(`/api/v1/leave/${selectedLeave.id}/reject`, {
                remarks: reviewRemarks.trim()
            });
            alert('Leave application has been rejected.');
            setSelectedLeave(null);
            fetchPendingLeaves();
        } catch (error: any) {
            console.warn('Failed on /reject, attempting legacy status update', error);
            try {
                await api.post('/api/leaves/status', {
                    leaveId: selectedLeave.id,
                    status: 'REJECTED',
                    comment: reviewRemarks.trim()
                });
                alert('Leave application rejected.');
                setSelectedLeave(null);
                fetchPendingLeaves();
            } catch (legacyError: any) {
                alert(legacyError.response?.data?.message || error.response?.data?.message || 'Failed to reject leave application.');
            }
        } finally {
            setSubmittingAction(null);
        }
    };

    // Filter Active Leaves Directory
    const filteredActiveLeaves = useMemo(() => {
        return activeLeaves.filter(leave => {
            const matchesQuery =
                !searchQuery.trim() ||
                leave.staff?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                leave.staff?.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (leave.type || leave.leaveType || '').toLowerCase().includes(searchQuery.toLowerCase());

            const leaveType = leave.type || leave.leaveType;
            const matchesType = leaveTypeFilter === 'ALL' || leaveType === leaveTypeFilter;

            return matchesQuery && matchesType;
        });
    }, [activeLeaves, searchQuery, leaveTypeFilter]);

    // Filter Pending Leaves
    const filteredPendingLeaves = useMemo(() => {
        return leaves.filter(leave => {
            const staffName = leave.staff?.user?.name || leave.staff?.name || `${leave.staff?.surname || ''} ${leave.staff?.otherNames || ''}`;
            const staffId = leave.staff?.staffId || '';
            const unitName = leave.staff?.unit?.name || leave.staff?.location || '';
            const query = pendingSearchQuery.toLowerCase().trim();

            const matchesQuery =
                !query ||
                staffName.toLowerCase().includes(query) ||
                staffId.toLowerCase().includes(query) ||
                unitName.toLowerCase().includes(query);

            const leaveType = leave.leaveType || leave.type;
            const matchesType = pendingTypeFilter === 'ALL' || leaveType === pendingTypeFilter;

            const scale = (leave.staff?.salaryScale || leave.staff?.cadre || '').toUpperCase();
            const matchesScale =
                pendingScaleFilter === 'ALL' ||
                (pendingScaleFilter === 'CONUASS' && scale.includes('CONUASS')) ||
                (pendingScaleFilter === 'CONTISS' && scale.includes('CONTISS'));

            const status = leave.status;
            const matchesStatus =
                pendingStatusFilter === 'ALL' ||
                (pendingStatusFilter === 'PENDING_HOD' && (status === 'PENDING_HOD' || status === 'PENDING')) ||
                (pendingStatusFilter === 'PENDING_REGISTRY' && status === 'PENDING_REGISTRY') ||
                status === pendingStatusFilter;

            return matchesQuery && matchesType && matchesScale && matchesStatus;
        });
    }, [leaves, pendingSearchQuery, pendingTypeFilter, pendingScaleFilter, pendingStatusFilter]);

    const paginatedLeaves = useMemo(() => {
        return filteredPendingLeaves.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    }, [filteredPendingLeaves, currentPage, pageSize]);

    const paginatedActiveLeaves = useMemo(() => {
        return filteredActiveLeaves.slice((activeCurrentPage - 1) * pageSize, activeCurrentPage * pageSize);
    }, [filteredActiveLeaves, activeCurrentPage, pageSize]);

    const totalPagesPending = Math.max(1, Math.ceil(filteredPendingLeaves.length / pageSize));
    const totalPagesActive = Math.max(1, Math.ceil(filteredActiveLeaves.length / pageSize));

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-300">
                            Dual-Control Statutory Absence Hub
                        </span>
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-slate-300">
                            13 Categories • CONUASS / CONTISS Matrix
                        </span>
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Leave &amp; Absence Directory</h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Dual-level governance (HOD Endorsement &rarr; Registry Clearance), statutory entitlement calculation, and live campus absence registry.
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
                                {STATUTORY_LEAVE_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
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
                                                    <div>{leave.staff?.name || (leave.staff?.surname ? `${leave.staff.surname} ${leave.staff.otherNames || ''}` : 'Staff Member')}</div>
                                                    <div className="text-[10px] font-normal text-gray-500">{leave.staff?.cadre || leave.staff?.rank || 'Staff'} • {leave.staff?.staffId}</div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase border border-emerald-300">
                                                        {(leave.type || leave.leaveType || '').replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-gray-600 font-semibold">{leave.staff?.location || leave.staff?.unit?.name || 'Main Campus'}</td>
                                                <td className="py-4 px-6 text-gray-600 font-medium">
                                                    {new Date(leave.startDate).toLocaleDateString()} &rarr; <span className="font-bold text-gray-900">{new Date(leave.endDate).toLocaleDateString()}</span>
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
                <div className="space-y-6">
                    {/* Search & Advanced Filters */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
                        <div className="relative w-full lg:w-80">
                            <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search by staff name, ID, or unit..."
                                value={pendingSearchQuery}
                                onChange={e => setPendingSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white text-gray-900"
                            />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full lg:w-auto">
                            {/* Salary Scale Filter */}
                            <select
                                value={pendingScaleFilter}
                                onChange={e => setPendingScaleFilter(e.target.value)}
                                className="p-2.5 border border-gray-300 rounded-xl bg-white text-xs text-gray-800 font-semibold focus:outline-none focus:border-emerald-600"
                            >
                                <option value="ALL">All Scales (CONUASS &amp; CONTISS)</option>
                                <option value="CONUASS">CONUASS (Academic)</option>
                                <option value="CONTISS">CONTISS (Non-Academic)</option>
                            </select>

                            {/* Leave Type Filter */}
                            <select
                                value={pendingTypeFilter}
                                onChange={e => setPendingTypeFilter(e.target.value)}
                                className="p-2.5 border border-gray-300 rounded-xl bg-white text-xs text-gray-800 font-semibold focus:outline-none focus:border-emerald-600"
                            >
                                {STATUTORY_LEAVE_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>

                            {/* Workflow Status Filter */}
                            <select
                                value={pendingStatusFilter}
                                onChange={e => setPendingStatusFilter(e.target.value)}
                                className="p-2.5 border border-gray-300 rounded-xl bg-white text-xs text-gray-800 font-semibold focus:outline-none focus:border-emerald-600"
                            >
                                <option value="ALL">All Pending Stages</option>
                                <option value="PENDING_HOD">Level 1: Pending HOD</option>
                                <option value="PENDING_REGISTRY">Level 2: Pending Registry</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-200 bg-amber-50/50 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Pending Leave Applications</h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {isRegistryOrExecutive
                                        ? 'Dual-control Registry Clearance & Ledger Deduction Console'
                                        : isHOD
                                        ? 'Level 1: Department Staff Applications Pending HOD Endorsement'
                                        : isDean
                                        ? 'Level 1: Faculty Staff Applications Pending Dean Review'
                                        : 'Review and endorse staff applications within your unit/center'}
                                </p>
                            </div>
                            <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-full">
                                {filteredPendingLeaves.length} Action Required
                            </span>
                        </div>

                        {loadingPending ? (
                            <div className="p-12 text-center text-gray-500 text-sm">Loading pending leave applications...</div>
                        ) : filteredPendingLeaves.length === 0 ? (
                            <div className="p-16 text-center text-gray-400 text-sm italic">
                                No pending leave requests matching current filters.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                                            <th className="py-3.5 px-6">Staff Member</th>
                                            <th className="py-3.5 px-6">Leave Category</th>
                                            <th className="py-3.5 px-6">Requested Span</th>
                                            <th className="py-3.5 px-6">Working Days</th>
                                            <th className="py-3.5 px-6">Approval Stage</th>
                                            <th className="py-3.5 px-6 text-center">Docs</th>
                                            <th className="py-3.5 px-6 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedLeaves.map(leave => {
                                            const applicantName =
                                                leave.staff?.user?.name ||
                                                leave.staff?.name ||
                                                (leave.staff ? `${leave.staff.title || ''} ${leave.staff.surname} ${leave.staff.otherNames}` : 'Staff Member');
                                            const leaveType = leave.leaveType || leave.type;
                                            const workingDays = leave.workingDaysCount || leave.durationDays || '—';
                                            const isPendingHod = leave.status === 'PENDING_HOD' || leave.status === 'PENDING';
                                            const isPendingRegistry = leave.status === 'PENDING_REGISTRY';

                                            return (
                                                <tr key={leave.id} className="hover:bg-gray-50 transition">
                                                    <td className="py-4 px-6 font-bold text-gray-900">
                                                        <div>{applicantName}</div>
                                                        <div className="text-[10px] font-normal text-gray-500">
                                                            {leave.staff?.rank || leave.staff?.cadre || 'Staff'} • {leave.staff?.unit?.name || leave.staff?.location || 'Unit'}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-bold text-[10px] uppercase border border-slate-200">
                                                            {leaveType.replace(/_/g, ' ')}
                                                        </span>
                                                        {leave.payrollSuspensionFlag && (
                                                            <div className="mt-1">
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                                    Unpaid / Payroll Stop
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-gray-600">
                                                        <div>{new Date(leave.startDate).toLocaleDateString()} &rarr; {new Date(leave.endDate).toLocaleDateString()}</div>
                                                    </td>
                                                    <td className="py-4 px-6 font-bold text-emerald-900">
                                                        {workingDays} Working Days
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        {isPendingHod ? (
                                                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-300 inline-flex items-center gap-1">
                                                                <Clock size={11} /> Level 1: HOD Endorsement
                                                            </span>
                                                        ) : isPendingRegistry ? (
                                                            <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] border border-blue-300 inline-flex items-center gap-1">
                                                                <ShieldCheck size={11} /> Level 2: Registry Clearance
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-bold text-[10px]">
                                                                {leave.status}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        {leave.supportingDocumentUrl ? (
                                                            <a
                                                                href={leave.supportingDocumentUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-0.5 font-semibold text-[11px]"
                                                                title="View Supporting Attachment"
                                                            >
                                                                <FileText size={14} /> View
                                                            </a>
                                                        ) : (
                                                            <span className="text-gray-400 text-[10px]">None</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        <Button
                                                            size="xs"
                                                            variant="emerald"
                                                            onClick={() => setSelectedLeave(leave)}
                                                        >
                                                            Review &amp; Action
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {filteredPendingLeaves.length > 0 && (
                            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPagesPending}
                                    totalItems={filteredPendingLeaves.length}
                                    pageSize={pageSize}
                                    onPageChange={setCurrentPage}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Leave Review & Dual-Control Approval Modal */}
            {selectedLeave && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-8 max-w-xl w-full space-y-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
                        <div className="border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase border border-emerald-300">
                                    Dual-Control Maker-Checker Review
                                </span>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">Review Leave Application</h2>
                            <p className="text-xs text-gray-500 mt-1">
                                Applied by{' '}
                                <span className="font-bold text-gray-800">
                                    {selectedLeave.staff?.user?.name ||
                                        (selectedLeave.staff
                                            ? `${selectedLeave.staff.surname} ${selectedLeave.staff.otherNames}`
                                            : 'Staff Member')}
                                </span>
                            </p>
                        </div>

                        {/* Unpaid Leave Alert */}
                        {(selectedLeave.leaveType === 'LEAVE_OF_ABSENCE_WITHOUT_PAY' ||
                            selectedLeave.type === 'LEAVE_OF_ABSENCE_WITHOUT_PAY' ||
                            selectedLeave.payrollSuspensionFlag ||
                            selectedLeave.isPaidLeave === false) && (
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3">
                                <AlertTriangle className="text-amber-600 mt-0.5 flex-shrink-0" size={18} />
                                <div className="text-xs text-amber-900">
                                    <p className="font-bold">Statutory Unpaid Leave Notification</p>
                                    <p className="text-[11px] text-amber-800 mt-0.5">
                                        Authorizing this leave application will automatically flag the applicant for payroll suspension for the duration of the absence.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Application Summary */}
                        <div className="space-y-3 text-xs bg-gray-50 p-5 rounded-2xl border border-gray-200">
                            <div className="flex justify-between items-center py-1 border-b border-gray-200">
                                <span className="text-gray-500">Leave Category:</span>
                                <span className="font-bold text-gray-900 uppercase">
                                    {(selectedLeave.leaveType || selectedLeave.type).replace(/_/g, ' ')}
                                </span>
                            </div>

                            <div className="flex justify-between items-center py-1 border-b border-gray-200">
                                <span className="text-gray-500">Working Days (Calculated):</span>
                                <span className="font-bold text-emerald-900">
                                    {selectedLeave.workingDaysCount || selectedLeave.durationDays} Days (Excludes Weekends &amp; Holidays)
                                </span>
                            </div>

                            <div className="flex justify-between items-center py-1 border-b border-gray-200">
                                <span className="text-gray-500">Date Span:</span>
                                <span className="font-semibold text-gray-800">
                                    {new Date(selectedLeave.startDate).toLocaleDateString()} &rarr; {new Date(selectedLeave.endDate).toLocaleDateString()}
                                </span>
                            </div>

                            {selectedLeave.staff?.unit && (
                                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                                    <span className="text-gray-500">Unit / Department:</span>
                                    <span className="font-semibold text-gray-800">
                                        {selectedLeave.staff.unit.name} ({selectedLeave.staff.unit.code})
                                    </span>
                                </div>
                            )}

                            {selectedLeave.reliefStaff && (
                                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                                    <span className="text-gray-500">Nominated Relief Officer:</span>
                                    <span className="font-semibold text-gray-800">
                                        {selectedLeave.reliefStaff.user?.name || `${selectedLeave.reliefStaff.surname} ${selectedLeave.reliefStaff.otherNames}`}
                                    </span>
                                </div>
                            )}

                            {selectedLeave.supportingDocumentUrl && (
                                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                                    <span className="text-gray-500">Supporting Document:</span>
                                    <a
                                        href={selectedLeave.supportingDocumentUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
                                    >
                                        <FileText size={13} /> View Attached Evidence
                                    </a>
                                </div>
                            )}

                            {selectedLeave.reason && (
                                <div className="pt-1">
                                    <span className="text-gray-500 block mb-1">Reason / Justification:</span>
                                    <p className="bg-white p-3 rounded-xl border border-gray-200 text-gray-700 italic">
                                        &ldquo;{selectedLeave.reason}&rdquo;
                                    </p>
                                </div>
                            )}

                            {selectedLeave.hodApprovedBy && (
                                <div className="pt-2 text-[11px] text-gray-600 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200">
                                    <span className="font-bold text-emerald-900 block">Level 1 Endorsement on Record:</span>
                                    <span>Endorsed by {selectedLeave.hodApprovedBy.name || 'HOD'} ({selectedLeave.hodApprovedBy.role})</span>
                                    {selectedLeave.hodApprovalRemarks && (
                                        <p className="italic text-gray-700 mt-1">&ldquo;{selectedLeave.hodApprovalRemarks}&rdquo;</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Review Remarks Field */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-700">
                                Approver Remarks / Comments
                            </label>
                            <textarea
                                value={reviewRemarks}
                                onChange={e => setReviewRemarks(e.target.value)}
                                rows={3}
                                placeholder="Enter administrative endorsement or clearance remarks (Required for rejection)..."
                                className="w-full p-3 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white text-gray-900"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-4 border-t border-gray-100">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedLeave(null)}
                                disabled={submittingAction !== null}
                            >
                                Cancel
                            </Button>

                            <Button
                                variant="danger"
                                size="sm"
                                onClick={handleRejectLeave}
                                isLoading={submittingAction === 'reject'}
                                loadingText="Rejecting..."
                                disabled={submittingAction !== null}
                            >
                                Reject Application
                            </Button>

                            {/* Dual-Control Level 1 vs Level 2 Action Buttons */}
                            {selectedLeave.status === 'PENDING_HOD' || selectedLeave.status === 'PENDING' ? (
                                <Button
                                    variant="emerald"
                                    size="sm"
                                    onClick={handleEndorseHod}
                                    isLoading={submittingAction === 'endorse'}
                                    loadingText="Endorsing..."
                                    disabled={submittingAction !== null}
                                >
                                    Endorse (Level 1)
                                </Button>
                            ) : null}

                            {/* Level 2 Registry Clearance Button */}
                            {isRegistryOrExecutive && (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleAuthorizeRegistry}
                                    isLoading={submittingAction === 'authorize'}
                                    loadingText="Authorizing..."
                                    disabled={submittingAction !== null}
                                >
                                    Authorize (Level 2)
                                </Button>
                            )}
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
