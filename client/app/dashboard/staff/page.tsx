'use client';

import { useEffect, useState } from 'react';
import { 
    Plus, 
    Search, 
    Grid, 
    List, 
    Users, 
    BookOpen, 
    Briefcase, 
    Filter, 
    Sparkles, 
    ChevronRight, 
    Phone, 
    Mail, 
    Building, 
    GraduationCap,
    Loader2
} from 'lucide-react';
import api from '../../../lib/api';
import AddStaffModal from '../../../components/dashboard/AddStaffModal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';

interface Staff {
    id: string;
    name: string;
    email: string;
    role: string;
    staffProfile?: {
        staffId?: string;
        department?: string;
        rank?: string;
        phone?: string;
        level?: string;
        step?: string;
        cadre?: string;
        unitId?: string;
        centerId?: string;
        status?: string;
        unit?: { name: string; type: string };
        studyCenter?: { name: string; code: string };
    };
}

interface OrganizationData {
    centers: { id: string; name: string; code: string }[];
    units: { id: string; name: string; type: string; code: string }[];
}

export default function StaffPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [orgData, setOrgData] = useState<OrganizationData>({ centers: [], units: [] });
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (user && !['HR_ADMIN', 'ADMIN', 'SUPER_USER', 'VICE_CHANCELLOR'].includes(user.role)) {
            router.push('/dashboard/access-denied');
        }
    }, [user, router]);
    
    // View state & filters
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [cadreFilter, setCadreFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState(''); // unitId or centerId
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['ACTIVE']);
    
    // Pagination state
    const [page, setPage] = useState(1);
    const [pageSize] = useState(12);

    const fetchStaffAndOrg = async () => {
        try {
            setLoading(true);
            const statusParam = selectedStatuses.length > 0 ? selectedStatuses.join(',') : 'ACTIVE';
            const [staffRes, orgRes] = await Promise.all([
                api.get(`/api/staff?status=${statusParam}`),
                api.get('/api/org/structure')
            ]);
            setStaffList(staffRes.data || []);
            setOrgData(orgRes.data || { centers: [], units: [] });
        } catch (error) {
            console.error('Failed to fetch data', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaffAndOrg();
    }, [selectedStatuses]);

    // Statistics helpers based on fetched list
    const totalCount = staffList.length;
    const academicCount = staffList.filter(s => s.staffProfile?.cadre === 'ACADEMIC').length;
    const nonAcademicCount = totalCount - academicCount;

    // Filters logic
    const filteredStaff = staffList.filter((staff) => {
        const matchesSearch = 
            staff.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            staff.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            staff.staffProfile?.staffId?.toLowerCase().includes(searchTerm.toLowerCase());

        // Check matching Roles/Titles (Director, Dean, etc. mapped to UNIT_HEAD or UNIT_ADMIN in db)
        let matchesRole = true;
        if (roleFilter) {
            if (roleFilter === 'DIRECTOR') {
                matchesRole = staff.role === 'UNIT_HEAD' && staff.staffProfile?.rank?.toLowerCase() === 'director';
            } else if (roleFilter === 'DEAN') {
                matchesRole = staff.role === 'UNIT_HEAD' && staff.staffProfile?.rank?.toLowerCase() === 'dean';
            } else if (roleFilter === 'UNIT_HEAD') {
                matchesRole = staff.role === 'UNIT_HEAD' && !['director', 'dean'].includes(staff.staffProfile?.rank?.toLowerCase() || '');
            } else if (roleFilter === 'UNIT_ADMIN') {
                matchesRole = staff.role === 'UNIT_ADMIN';
            } else {
                matchesRole = staff.role === roleFilter;
            }
        }

        const matchesCadre = !cadreFilter || staff.staffProfile?.cadre === cadreFilter;

        const matchesLocation = !locationFilter || 
            staff.staffProfile?.unitId === locationFilter || 
            staff.staffProfile?.centerId === locationFilter;

        return matchesSearch && matchesRole && matchesCadre && matchesLocation;
    });

    const totalPages = Math.ceil(filteredStaff.length / pageSize);
    const paginatedStaff = filteredStaff.slice((page - 1) * pageSize, page * pageSize);

    useEffect(() => {
        if (page > totalPages && totalPages > 0) {
            setPage(totalPages);
        }
    }, [filteredStaff, totalPages, page]);

    const getStatusBadgeStyle = (status: string) => {
        const s = (status || 'ACTIVE').toUpperCase();
        if (s === 'RETIRED') return 'bg-amber-50 text-amber-700 border-amber-200';
        if (s === 'DECEASED') return 'bg-gray-50 text-gray-700 border-gray-200';
        if (s === 'RESIGNED') return 'bg-blue-50 text-blue-700 border-blue-200';
        if (s === 'FIRED') return 'bg-red-50 text-red-700 border-red-200';
        if (s === 'ON_LEAVE') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        if (s === 'SUSPENDED') return 'bg-rose-50 text-rose-700 border-rose-200';
        return 'bg-green-50 text-green-700 border-green-200';
    };

    // Avatar Gradient Generator
    const getAvatarGradient = (name: string) => {
        const colors = [
            'from-blue-500 to-indigo-600',
            'from-emerald-500 to-teal-600',
            'from-purple-500 to-pink-600',
            'from-amber-500 to-orange-600',
            'from-rose-500 to-red-600',
            'from-cyan-500 to-blue-600'
        ];
        const index = name ? name.charCodeAt(0) % colors.length : 0;
        return colors[index];
    };

    // Role styling utility
    const getRoleBadgeStyle = (staff: Staff) => {
        const r = staff.role;
        const rank = staff.staffProfile?.rank?.toLowerCase() || '';

        if (r === 'SUPER_USER') return 'bg-red-50 text-red-700 border-red-100';
        if (r === 'HR_ADMIN') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
        if (r === 'UNIT_HEAD') {
            if (rank === 'director') return 'bg-rose-50 text-rose-700 border-rose-100';
            if (rank === 'dean') return 'bg-cyan-50 text-cyan-700 border-cyan-100';
            return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        }
        if (r === 'UNIT_ADMIN') return 'bg-purple-50 text-purple-700 border-purple-100';
        if (r === 'STUDY_CENTER_MANAGER') return 'bg-amber-50 text-amber-700 border-amber-100';
        if (r === 'BURSARY') return 'bg-blue-50 text-blue-700 border-blue-100';
        if (r === 'AUDIT') return 'bg-teal-50 text-teal-700 border-teal-100';
        return 'bg-gray-50 text-gray-700 border-gray-150';
    };

    const getRoleDisplayName = (staff: Staff) => {
        const r = staff.role;
        const rank = staff.staffProfile?.rank || '';

        if (r === 'UNIT_HEAD') {
            if (rank.toLowerCase() === 'director') return 'Director';
            if (rank.toLowerCase() === 'dean') return 'Dean';
            return rank || 'Head of Unit';
        }
        if (r === 'UNIT_ADMIN') {
            if (rank.toLowerCase() === 'head of admin') return 'Head of Admin';
            return rank || 'Unit Administrator';
        }
        return r.replace(/_/g, ' ');
    };

    return (
        <div className="space-y-6">
            {/* Top Premium Banner */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl gap-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-0"></div>
                <div className="relative z-10 space-y-2">
                    <div className="inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-300 border border-blue-400/20 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                        <Sparkles size={12} className="animate-pulse" /> Enterprise Directory
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Staff Management</h1>
                    <p className="text-slate-300 text-sm max-w-xl">
                        Monitor university staff service records, assign structural hierarchy roles, and manage center files.
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="relative z-10 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg transition active:scale-95 duration-100 self-stretch sm:self-auto text-center justify-center"
                >
                    <Plus size={20} />
                    <span>Add New Staff</span>
                </button>
            </div>

            {/* Statistics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Staff</p>
                        <h3 className="text-2xl font-bold text-gray-800">{loading ? '...' : totalCount}</h3>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <GraduationCap size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Academic Staff</p>
                        <h3 className="text-2xl font-bold text-gray-800">{loading ? '...' : academicCount}</h3>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                        <Briefcase size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Non-Academic Staff</p>
                        <h3 className="text-2xl font-bold text-gray-800">{loading ? '...' : nonAcademicCount}</h3>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search Field */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name, email, or staff ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-50/50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                        />
                    </div>

                    {/* View Switcher Controls */}
                    <div className="flex gap-2 bg-gray-100 p-1 rounded-xl self-start">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            <Grid size={14} /> Grid
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            <List size={14} /> List
                        </button>
                    </div>
                </div>

                {/* Filters Dropdown Panel */}
                <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-gray-100 text-sm">
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-400" />
                        <span className="font-semibold text-gray-600">Filters:</span>
                    </div>

                    {/* Role Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-semibold">Position/Role</span>
                        <select
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-medium text-gray-700 bg-white"
                        >
                            <option value="">All Roles</option>
                            <option value="DIRECTOR">Director</option>
                            <option value="DEAN">Dean</option>
                            <option value="UNIT_HEAD">Head of Unit</option>
                            <option value="UNIT_ADMIN">Head of Admin</option>
                            <option value="STUDY_CENTER_MANAGER">Study Center Manager</option>
                            <option value="HR_ADMIN">HR Admin</option>
                            <option value="BURSARY">Bursary</option>
                            <option value="AUDIT">Audit</option>
                            <option value="STAFF">Regular Staff</option>
                        </select>
                    </div>

                    {/* Cadre Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-semibold">Cadre</span>
                        <select
                            value={cadreFilter}
                            onChange={e => setCadreFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-medium text-gray-700 bg-white"
                        >
                            <option value="">All Cadres</option>
                            <option value="ACADEMIC">Academic</option>
                            <option value="ADMINISTRATIVE">Administrative</option>
                            <option value="TECHNICAL">Technical</option>
                            <option value="JUNIOR">Junior</option>
                            <option value="MEDICAL">Medical</option>
                            <option value="SECURITY">Security</option>
                        </select>
                    </div>

                    {/* Center/Unit Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-semibold">Location / Structure</span>
                        <select
                            value={locationFilter}
                            onChange={e => setLocationFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-medium text-gray-700 bg-white max-w-[200px] truncate"
                        >
                            <option value="">All Locations</option>
                            <optgroup label="Study Centers">
                                {orgData.centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </optgroup>
                            <optgroup label="HQ Directorates & Faculties">
                                {orgData.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </optgroup>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-semibold">Status</span>
                        <div className="flex flex-wrap gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
                            {['ACTIVE', 'RETIRED', 'DECEASED', 'RESIGNED', 'FIRED', 'ON_LEAVE', 'SUSPENDED'].map(st => {
                                const isSelected = selectedStatuses.includes(st);
                                return (
                                    <button
                                        key={st}
                                        type="button"
                                        onClick={() => {
                                            if (isSelected) {
                                                if (selectedStatuses.length > 1) {
                                                    setSelectedStatuses(selectedStatuses.filter(s => s !== st));
                                                }
                                            } else {
                                                setSelectedStatuses([...selectedStatuses, st]);
                                            }
                                            setPage(1); // Reset to first page
                                        }}
                                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition ${
                                            isSelected 
                                                ? 'bg-blue-600 text-white shadow-sm' 
                                                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-150'
                                        }`}
                                    >
                                        {st.replace('_', ' ')}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Reset Button */}
                    {(searchTerm || roleFilter || cadreFilter || locationFilter) && (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setRoleFilter('');
                                setCadreFilter('');
                                setLocationFilter('');
                            }}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                        >
                            Reset filters
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-500">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                    <span className="text-sm font-medium">Loading staff records...</span>
                </div>
            ) : filteredStaff.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-150 shadow-sm py-20 text-center text-gray-400">
                    <Users className="mx-auto text-gray-300 mb-3" size={48} />
                    <p className="text-lg font-bold text-gray-700">No staff records found</p>
                    <p className="text-sm text-gray-500">No members matched the active filters.</p>
                </div>
            ) : viewMode === 'grid' ? (
                /* Premium Grid View Layout */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedStaff.map((staff) => {
                        const gradientClass = getAvatarGradient(staff.name);
                        const isAcademic = staff.staffProfile?.cadre === 'ACADEMIC';
                        return (
                            <div 
                                key={staff.id} 
                                className="bg-white rounded-3xl border border-gray-150 hover:border-blue-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between overflow-hidden group"
                            >
                                <div className="p-6 space-y-4">
                                    {/* Card Header (Avatar + Role & Status Badges) */}
                                    <div className="flex justify-between items-start gap-3">
                                        <div className={`h-14 w-14 flex-shrink-0 rounded-2xl bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white font-extrabold text-xl shadow-md transform group-hover:scale-105 transition-transform`}>
                                            {staff.name?.charAt(0) || 'U'}
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <span className={`inline-flex flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRoleBadgeStyle(staff)}`}>
                                                {getRoleDisplayName(staff)}
                                            </span>
                                            <span className={`inline-flex flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeStyle(staff.staffProfile?.status || 'ACTIVE')}`}>
                                                {(staff.staffProfile?.status || 'ACTIVE').replace('_', ' ')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Core Bio Info */}
                                    <div className="space-y-1 min-w-0">
                                        <h3 className="text-lg font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors truncate">
                                            {staff.name}
                                        </h3>
                                        <p className="text-xs font-medium text-gray-400 truncate">
                                            Staff ID: {staff.staffProfile?.staffId || 'N/A'}
                                        </p>
                                    </div>

                                    {/* Division / Structure */}
                                    <div className="space-y-2 pt-2 text-xs font-medium text-gray-600 border-t border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <Building size={14} className="text-gray-400" />
                                            <span className="truncate">
                                                {staff.staffProfile?.unit?.name || staff.staffProfile?.studyCenter?.name || 'Main Registry / HQ'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Briefcase size={14} className="text-gray-400" />
                                            <span>
                                                {staff.staffProfile?.rank || 'Staff'} • {staff.staffProfile?.level ? `Level ${staff.staffProfile.level}` : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <GraduationCap size={14} className="text-gray-400" />
                                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${isAcademic ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>
                                                {staff.staffProfile?.cadre || 'N/A'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Contact Details */}
                                    <div className="space-y-1.5 pt-2 text-xs text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <Mail size={12} className="text-gray-400" />
                                            <span className="truncate">{staff.email}</span>
                                        </div>
                                        {staff.staffProfile?.phone && (
                                            <div className="flex items-center gap-2">
                                                <Phone size={12} className="text-gray-400" />
                                                <span>{staff.staffProfile.phone}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card Footer Action */}
                                <Link
                                    href={`/dashboard/staff/${staff.id}`}
                                    className="bg-gray-50/80 hover:bg-blue-600 hover:text-white border-t border-gray-150 p-4 text-center text-xs font-bold text-gray-700 transition flex items-center justify-center gap-1 group-hover:bg-blue-50/50"
                                >
                                    View Service Record <ChevronRight size={14} />
                                </Link>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Premium List View Layout (Table) */
                <div className="bg-white rounded-3xl border border-gray-150 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-xs font-bold uppercase text-gray-500 tracking-wider border-b border-gray-150">
                                    <th className="px-6 py-4">Staff Member</th>
                                    <th className="px-6 py-4">Role/Title</th>
                                    <th className="px-6 py-4">Location / Department</th>
                                    <th className="px-6 py-4">Rank / Level</th>
                                    <th className="px-6 py-4">Contact</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedStaff.map((staff) => {
                                    const gradientClass = getAvatarGradient(staff.name);
                                    return (
                                        <tr key={staff.id} className="hover:bg-slate-55/30 transition-colors">
                                            {/* Bio Cell */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`h-10 w-10 flex-shrink-0 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                                                        {staff.name?.charAt(0) || 'U'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="font-semibold text-gray-900 block truncate max-w-[180px]">{staff.name}</span>
                                                        <span className="text-[10px] text-gray-400 font-medium truncate block max-w-[180px]">ID: {staff.staffProfile?.staffId || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Role & Status Cell */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-start gap-1">
                                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRoleBadgeStyle(staff)}`}>
                                                        {getRoleDisplayName(staff)}
                                                    </span>
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeStyle(staff.staffProfile?.status || 'ACTIVE')}`}>
                                                        {(staff.staffProfile?.status || 'ACTIVE').replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Location Cell */}
                                            <td className="px-6 py-4 text-sm text-gray-650">
                                                <div className="font-medium truncate max-w-[200px]">
                                                    {staff.staffProfile?.unit?.name || staff.staffProfile?.studyCenter?.name || 'Main Registry / HQ'}
                                                </div>
                                            </td>

                                            {/* Rank Cell */}
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                <div className="font-medium text-gray-800">{staff.staffProfile?.rank || 'Staff'}</div>
                                                <div className="text-[10px] text-gray-400">Level {staff.staffProfile?.level || 'N/A'} • Step {staff.staffProfile?.step || 'N/A'}</div>
                                            </td>

                                            {/* Contact Cell */}
                                            <td className="px-6 py-4 text-xs text-gray-500">
                                                <div>{staff.email}</div>
                                                <div>{staff.staffProfile?.phone || '-'}</div>
                                            </td>

                                            {/* Action Cell */}
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    href={`/dashboard/staff/${staff.id}`}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                                                >
                                                    View Profile <ChevronRight size={14} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-gray-150 shadow-sm mt-6">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Showing <span className="text-gray-800">{Math.min((page - 1) * pageSize + 1, filteredStaff.length)}</span> to{' '}
                        <span className="text-gray-800">{Math.min(page * pageSize, filteredStaff.length)}</span> of{' '}
                        <span className="text-gray-800">{filteredStaff.length}</span> members
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setPage(p => Math.max(p - 1, 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            Prev
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={`h-8 w-8 rounded-xl text-xs font-bold transition flex items-center justify-center ${
                                    page === p 
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                                        : 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                        <button
                            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {showModal && (
                <AddStaffModal
                    onClose={() => setShowModal(false)}
                    onSuccess={fetchStaffAndOrg}
                />
            )}
        </div>
    );
}
