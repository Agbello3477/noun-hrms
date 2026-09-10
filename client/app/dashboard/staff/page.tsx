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

    useEffect(() => {
        try {
            const cachedStaff = sessionStorage.getItem('noun_staff_list_cache');
            if (cachedStaff) {
                setStaffList(JSON.parse(cachedStaff));
                setLoading(false);
            }
            const cachedOrg = sessionStorage.getItem('noun_org_structure_cache');
            if (cachedOrg) setOrgData(JSON.parse(cachedOrg));
        } catch {}
    }, []);

    const fetchStaffAndOrg = async () => {
        try {
            const statusParam = selectedStatuses.length > 0 ? selectedStatuses.join(',') : 'ACTIVE';
            const [staffRes, orgRes] = await Promise.all([
                api.get(`/api/staff?status=${statusParam}`),
                api.get('/api/org/structure')
            ]);
            if (staffRes.data) {
                setStaffList(staffRes.data);
                try { sessionStorage.setItem('noun_staff_list_cache', JSON.stringify(staffRes.data)); } catch {}
            }
            if (orgRes.data) {
                setOrgData(orgRes.data);
                try { sessionStorage.setItem('noun_org_structure_cache', JSON.stringify(orgRes.data)); } catch {}
            }
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
        if (s === 'RETIRED') return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
        if (s === 'DECEASED') return 'bg-slate-500/10 text-slate-700 border-slate-500/20';
        if (s === 'RESIGNED') return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
        if (s === 'FIRED') return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
        if (s === 'ON_LEAVE') return 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20';
        if (s === 'SUSPENDED') return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
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

        if (r === 'SUPER_USER' || r === 'VICE_CHANCELLOR') return 'bg-purple-500/10 text-purple-800 border-purple-500/20';
        if (r === 'HR_ADMIN') return 'bg-[#006533]/10 text-[#006533] border-[#006533]/20';
        if (r === 'UNIT_HEAD') {
            if (rank === 'director') return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
            if (rank === 'dean') return 'bg-cyan-500/10 text-cyan-800 border-cyan-500/20';
            return 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20';
        }
        if (r === 'UNIT_ADMIN') return 'bg-violet-500/10 text-violet-700 border-violet-500/20';
        if (r === 'STUDY_CENTER_MANAGER') return 'bg-amber-500/10 text-amber-800 border-amber-500/20';
        if (r === 'BURSARY') return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
        if (r === 'AUDIT') return 'bg-teal-500/10 text-teal-800 border-teal-500/20';
        return 'bg-slate-500/10 text-slate-700 border-slate-500/20';
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
            {/* Top Enterprise Institutional Banner */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-gradient-to-br from-slate-900 via-[#004d26] to-[#006533] p-6 sm:p-8 rounded-2xl text-white shadow-lg border border-emerald-800/40 gap-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-[#FFCD00]/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 space-y-2">
                    <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md text-[#FFCD00] border border-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <Sparkles size={12} className="animate-pulse text-[#FFCD00]" /> Enterprise Directory
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Staff Management</h1>
                    <p className="text-emerald-100/80 text-xs sm:text-sm max-w-xl font-medium">
                        Monitor university staff service records, assign structural hierarchy roles, and manage center files.
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="relative z-10 flex items-center gap-2 bg-[#FFCD00] hover:bg-amber-400 text-slate-950 font-black px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition active:scale-95 duration-150 self-stretch sm:self-auto text-center justify-center text-xs uppercase tracking-wider"
                >
                    <Plus size={16} className="stroke-[3]" />
                    <span>Add New Staff</span>
                </button>
            </div>

            {/* Statistics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="enterprise-card p-5 flex items-center justify-between group hover:border-[#006533]/40 transition-all duration-200">
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Staff</span>
                        <div className="text-3xl font-black text-slate-900 tracking-tight">{loading ? '...' : totalCount}</div>
                        <span className="text-[11px] font-semibold text-slate-500">Active university registry</span>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-[#006533]/10 text-[#006533] flex items-center justify-center border border-[#006533]/20 shadow-sm group-hover:scale-105 transition-transform">
                        <Users size={22} />
                    </div>
                </div>
                <div className="enterprise-card p-5 flex items-center justify-between group hover:border-emerald-300 transition-all duration-200">
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Academic Staff</span>
                        <div className="text-3xl font-black text-slate-900 tracking-tight">{loading ? '...' : academicCount}</div>
                        <span className="text-[11px] font-semibold text-emerald-600">Teaching & Research Faculty</span>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shadow-sm group-hover:scale-105 transition-transform">
                        <GraduationCap size={22} />
                    </div>
                </div>
                <div className="enterprise-card p-5 flex items-center justify-between group hover:border-indigo-300 transition-all duration-200">
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Non-Academic Staff</span>
                        <div className="text-3xl font-black text-slate-900 tracking-tight">{loading ? '...' : nonAcademicCount}</div>
                        <span className="text-[11px] font-semibold text-indigo-600">Admin & Technical Services</span>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100 shadow-sm group-hover:scale-105 transition-transform">
                        <Briefcase size={22} />
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="enterprise-card p-5 space-y-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search Field */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search by name, email, or staff ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#006533]/20 focus:border-[#006533] outline-none transition text-slate-800 placeholder-slate-400"
                        />
                    </div>

                    {/* View Switcher Controls */}
                    <div className="flex gap-1.5 bg-slate-100/80 p-1 rounded-xl self-start border border-slate-200/60">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'grid' ? 'bg-white text-[#006533] shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <Grid size={14} /> Grid
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'list' ? 'bg-white text-[#006533] shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <List size={14} /> List
                        </button>
                    </div>
                </div>

                {/* Filters Dropdown Panel */}
                <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100 text-sm">
                    <div className="flex items-center gap-2">
                        <Filter size={15} className="text-slate-400" />
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-500">Filters:</span>
                    </div>

                    {/* Role Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-semibold">Position/Role</span>
                        <select
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                            className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-[#006533] focus:border-[#006533] outline-none font-medium text-slate-700 bg-white"
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
                        <span className="text-xs text-slate-500 font-semibold">Cadre</span>
                        <select
                            value={cadreFilter}
                            onChange={e => setCadreFilter(e.target.value)}
                            className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-[#006533] focus:border-[#006533] outline-none font-medium text-slate-700 bg-white"
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
                        <span className="text-xs text-slate-500 font-semibold">Location / Structure</span>
                        <select
                            value={locationFilter}
                            onChange={e => setLocationFilter(e.target.value)}
                            className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-[#006533] focus:border-[#006533] outline-none font-medium text-slate-700 bg-white max-w-[200px] truncate"
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
                        <span className="text-xs text-slate-500 font-semibold">Status</span>
                        <div className="flex flex-wrap gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
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
                                            setPage(1);
                                        }}
                                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition ${
                                            isSelected 
                                                ? 'bg-[#006533] text-white shadow-sm' 
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
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
                            className="text-xs font-bold text-[#006533] hover:text-[#004d26] transition underline underline-offset-2"
                        >
                            Reset filters
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(n => (
                        <div key={n} className="enterprise-card p-6 space-y-4 animate-pulse">
                            <div className="flex justify-between items-start gap-3">
                                <div className="h-12 w-12 rounded-2xl bg-slate-200"></div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <div className="h-4 w-20 bg-slate-200 rounded-full"></div>
                                    <div className="h-3 w-14 bg-slate-200 rounded-full"></div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-4 w-3/4 bg-slate-200 rounded"></div>
                                <div className="h-3 w-1/2 bg-slate-200 rounded"></div>
                            </div>
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="h-3 w-full bg-slate-200 rounded"></div>
                                <div className="h-3 w-4/5 bg-slate-200 rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredStaff.length === 0 ? (
                <div className="enterprise-card py-20 text-center text-slate-400">
                    <Users className="mx-auto text-slate-300 mb-3" size={48} />
                    <p className="text-lg font-bold text-slate-800">No staff records found</p>
                    <p className="text-sm text-slate-500">No members matched the active filters.</p>
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
                                className="enterprise-card hover:border-[#006533]/40 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                            >
                                <div className="p-6 space-y-4">
                                    {/* Card Header (Avatar + Role & Status Badges) */}
                                    <div className="flex justify-between items-start gap-3">
                                        <div className={`h-12 w-12 flex-shrink-0 rounded-2xl bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white font-black text-lg shadow-sm transform group-hover:scale-105 transition-transform`}>
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
                                        <h3 className="text-base font-bold text-slate-900 leading-tight group-hover:text-[#006533] transition-colors truncate">
                                            {staff.name}
                                        </h3>
                                        <p className="text-xs font-semibold text-slate-400 truncate">
                                            Staff ID: {staff.staffProfile?.staffId || 'N/A'}
                                        </p>
                                    </div>

                                    {/* Division / Structure */}
                                    <div className="space-y-2 pt-2 text-xs font-medium text-slate-600 border-t border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <Building size={14} className="text-slate-400" />
                                            <span className="truncate">
                                                {staff.staffProfile?.unit?.name || staff.staffProfile?.studyCenter?.name || 'Main Registry / HQ'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Briefcase size={14} className="text-slate-400" />
                                            <span>
                                                {staff.staffProfile?.rank || 'Staff'} • {staff.staffProfile?.level ? `Level ${staff.staffProfile.level}` : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <GraduationCap size={14} className="text-slate-400" />
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isAcademic ? 'bg-emerald-500/10 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                                                {staff.staffProfile?.cadre || 'N/A'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Contact Details */}
                                    <div className="space-y-1.5 pt-2 text-xs text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <Mail size={12} className="text-slate-400" />
                                            <span className="truncate font-medium">{staff.email}</span>
                                        </div>
                                        {staff.staffProfile?.phone && (
                                            <div className="flex items-center gap-2">
                                                <Phone size={12} className="text-slate-400" />
                                                <span className="font-medium">{staff.staffProfile.phone}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card Footer Action */}
                                <Link
                                    href={`/dashboard/staff/${staff.id}`}
                                    className="bg-slate-50/80 hover:bg-[#006533] hover:text-white border-t border-slate-150 p-3.5 text-center text-xs font-bold text-slate-700 transition flex items-center justify-center gap-1 group-hover:bg-[#006533]/10 group-hover:text-[#006533]"
                                >
                                    View Service Record <ChevronRight size={14} />
                                </Link>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Premium List View Layout (Table) */
                <div className="enterprise-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="sticky top-0 bg-slate-50/95 backdrop-blur-sm text-[11px] font-bold uppercase text-slate-500 tracking-wider border-b border-slate-200/80">
                                    <th className="px-6 py-3.5">Staff Member</th>
                                    <th className="px-6 py-3.5">Role/Title</th>
                                    <th className="px-6 py-3.5">Location / Department</th>
                                    <th className="px-6 py-3.5">Rank / Level</th>
                                    <th className="px-6 py-3.5">Contact</th>
                                    <th className="px-6 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedStaff.map((staff) => {
                                    const gradientClass = getAvatarGradient(staff.name);
                                    return (
                                        <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                                            {/* Bio Cell */}
                                            <td className="px-6 py-3.5">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
                                                        {staff.name?.charAt(0) || 'U'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-slate-900 block truncate max-w-[180px] text-xs sm:text-sm">{staff.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-semibold truncate block max-w-[180px]">ID: {staff.staffProfile?.staffId || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Role & Status Cell */}
                                            <td className="px-6 py-3.5">
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
                                            <td className="px-6 py-3.5 text-xs font-medium text-slate-600">
                                                <div className="truncate max-w-[200px]">
                                                    {staff.staffProfile?.unit?.name || staff.staffProfile?.studyCenter?.name || 'Main Registry / HQ'}
                                                </div>
                                            </td>

                                            {/* Rank Cell */}
                                            <td className="px-6 py-3.5 text-xs text-slate-600">
                                                <div className="font-bold text-slate-800">{staff.staffProfile?.rank || 'Staff'}</div>
                                                <div className="text-[10px] text-slate-400 font-medium">Level {staff.staffProfile?.level || 'N/A'} • Step {staff.staffProfile?.step || 'N/A'}</div>
                                            </td>

                                            {/* Contact Cell */}
                                            <td className="px-6 py-3.5 text-xs text-slate-500">
                                                <div className="font-medium text-slate-700">{staff.email}</div>
                                                <div className="text-[11px] text-slate-400">{staff.staffProfile?.phone || '-'}</div>
                                            </td>

                                            {/* Action Cell */}
                                            <td className="px-6 py-3.5 text-right">
                                                <Link
                                                    href={`/dashboard/staff/${staff.id}`}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-[#006533] hover:text-[#004d26] transition bg-[#006533]/10 hover:bg-[#006533]/20 px-3 py-1.5 rounded-lg"
                                                >
                                                    View Profile <ChevronRight size={13} />
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
                <div className="flex items-center justify-between enterprise-card px-6 py-3.5 mt-6">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Showing <span className="text-slate-800">{Math.min((page - 1) * pageSize + 1, filteredStaff.length)}</span> to{' '}
                        <span className="text-slate-800">{Math.min(page * pageSize, filteredStaff.length)}</span> of{' '}
                        <span className="text-slate-800">{filteredStaff.length}</span> members
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setPage(p => Math.max(p - 1, 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                        >
                            Prev
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={`h-8 w-8 rounded-xl text-xs font-bold transition flex items-center justify-center ${
                                    page === p 
                                        ? 'bg-[#006533] text-white shadow-md shadow-[#006533]/20' 
                                        : 'border border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                        <button
                            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
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
