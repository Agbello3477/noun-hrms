'use client';

import { useEffect, useState } from 'react';
import { 
    ArrowLeft, 
    User, 
    Phone, 
    MapPin, 
    Briefcase, 
    ShieldAlert, 
    Save, 
    Building, 
    GraduationCap, 
    ChevronRight,
    Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import api from '../../../../lib/api';
import DigitalDossier from '../../../../components/dashboard/DigitalDossier';
import QueryHistoryTab from '../../../../components/hr/dossier/QueryHistoryTab';

interface StaffDetail {
    id: string;
    name: string;
    email: string;
    role: string;
    staffProfile?: {
        id: string;
        staffId: string | null;
        surname: string | null;
        otherNames: string | null;
        department: string | null;
        rank: string | null;
        level: string | null;
        step: string | null;
        cadre: string | null;
        phone: string | null;
        gender: string | null;
        stateOfOrigin: string | null;
        lga: string | null;
        address: string | null;
        unitId: string | null;
        centerId: string | null;
        unit?: { name: string; type: string };
        studyCenter?: { name: string; code: string };
    }
}

interface OrganizationData {
    centers: { id: string; name: string; code: string }[];
    units: { id: string; name: string; type: string; code: string }[];
}

export default function StaffDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { user: currentUser } = useAuth();
    const [staff, setStaff] = useState<StaffDetail | null>(null);
    const [orgData, setOrgData] = useState<OrganizationData>({ centers: [], units: [] });
    const [loading, setLoading] = useState(true);
    
    // Administrative form state
    const [editRole, setEditRole] = useState('STAFF');
    const [editLocation, setEditLocation] = useState<'HQ' | 'CENTER' | 'NONE'>('NONE');
    const [editUnitId, setEditUnitId] = useState('');
    const [editCenterId, setEditCenterId] = useState('');
    const [saving, setSaving] = useState(false);

    // Bio & Career form state
    const [editSurname, setEditSurname] = useState('');
    const [editOtherNames, setEditOtherNames] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editCadre, setEditCadre] = useState('ADMINISTRATIVE');
    const [editLevel, setEditLevel] = useState('');
    const [editStep, setEditStep] = useState('');
    const [editRank, setEditRank] = useState('');
    const [editGender, setEditGender] = useState('');

    const isHrAdmin = ['HR_ADMIN', 'ADMIN', 'SUPER_USER'].includes(currentUser?.role || '');

    const isManager = 
        currentUser?.role && 
        ['UNIT_HEAD', 'STUDY_CENTER_MANAGER', 'UNIT_ADMIN'].includes(currentUser.role) && 
        staff?.staffProfile && 
        currentUser.staffProfile && 
        (
            (currentUser.staffProfile.unitId && staff.staffProfile.unitId === currentUser.staffProfile.unitId) ||
            (currentUser.staffProfile.centerId && staff.staffProfile.centerId === currentUser.staffProfile.centerId)
        );

    const canManage = isHrAdmin || isManager;

    const fetchStaffData = async () => {
        try {
            setLoading(true);
            const [staffRes, orgRes] = await Promise.all([
                api.get(`/api/staff/${params.id}`),
                api.get('/api/org/structure')
            ]);
            
            const staffData = staffRes.data;
            setStaff(staffData);
            setOrgData(orgRes.data || { centers: [], units: [] });

            // Initialize administrative form state
            if (staffData) {
                const role = staffData.role;
                const rank = staffData.staffProfile?.rank?.toLowerCase() || '';

                if (role === 'UNIT_HEAD') {
                    if (rank === 'director') setEditRole('DIRECTOR');
                    else if (rank === 'dean') setEditRole('DEAN');
                    else setEditRole('UNIT_HEAD');
                } else if (role === 'UNIT_ADMIN' && rank === 'head of admin') {
                    setEditRole('HEAD_OF_ADMIN');
                } else {
                    setEditRole(role);
                }

                if (staffData.staffProfile?.unitId) {
                    setEditLocation('HQ');
                    setEditUnitId(staffData.staffProfile.unitId);
                } else if (staffData.staffProfile?.centerId) {
                    setEditLocation('CENTER');
                    setEditCenterId(staffData.staffProfile.centerId);
                } else {
                    setEditLocation('NONE');
                }

                // Initialize new state variables
                setEditSurname(staffData.staffProfile?.surname || '');
                setEditOtherNames(staffData.staffProfile?.otherNames || '');
                setEditPhone(staffData.staffProfile?.phone || '');
                setEditAddress(staffData.staffProfile?.address || '');
                setEditCadre(staffData.staffProfile?.cadre || 'ADMINISTRATIVE');
                setEditLevel(staffData.staffProfile?.level || '');
                setEditStep(staffData.staffProfile?.step || '');
                setEditRank(staffData.staffProfile?.rank || '');
                setEditGender(staffData.staffProfile?.gender || '');
            }
        } catch (error) {
            console.error('Failed to fetch profile info:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaffData();
    }, [params.id]);

    const handleSubmitAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            let dbRole = editRole;
            let dbRank = isHrAdmin ? (staff?.staffProfile?.rank || 'Staff') : editRank;

            if (isHrAdmin) {
                if (editRole === 'DIRECTOR') {
                    dbRole = 'UNIT_HEAD';
                    dbRank = 'Director';
                } else if (editRole === 'DEAN') {
                    dbRole = 'UNIT_HEAD';
                    dbRank = 'Dean';
                } else if (editRole === 'UNIT_HEAD') {
                    dbRole = 'UNIT_HEAD';
                    dbRank = 'Head of Unit';
                } else if (editRole === 'HEAD_OF_ADMIN') {
                    dbRole = 'UNIT_ADMIN';
                    dbRank = 'Head of Admin';
                } else if (editRole === 'STAFF') {
                    dbRole = 'STAFF';
                    dbRank = 'Staff';
                }
            }

            const payload = {
                surname: editSurname,
                otherNames: editOtherNames,
                phone: editPhone,
                address: editAddress,
                level: editLevel,
                step: editStep,
                cadre: editCadre,
                gender: editGender,
                role: isHrAdmin ? dbRole : staff?.role,
                rank: dbRank,
                unitId: isHrAdmin ? (editLocation === 'HQ' ? editUnitId : 'null') : staff?.staffProfile?.unitId,
                centerId: isHrAdmin ? (editLocation === 'CENTER' ? editCenterId : 'null') : staff?.staffProfile?.centerId
            };

            await api.put(`/api/staff/${staff?.id}`, payload);
            alert('Staff profile updated successfully.');
            fetchStaffData(); // Reload profile details
        } catch (error: any) {
            console.error(error);
            alert(error.response?.data?.message || 'Failed to update staff profile.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-500">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <span className="text-sm font-medium">Loading staff profile...</span>
            </div>
        );
    }

    if (!staff) {
        return (
            <div className="p-8 text-center text-gray-500">
                <ShieldAlert className="mx-auto mb-3 text-red-500" size={48} />
                <p className="text-lg font-bold">Staff member not found.</p>
                <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">
                    Back to List
                </button>
            </div>
        );
    }

    const displayRole = (r: string, rank: string | null) => {
        if (r === 'UNIT_HEAD') {
            if (rank?.toLowerCase() === 'director') return 'Director';
            if (rank?.toLowerCase() === 'dean') return 'Dean';
            return rank || 'Head of Unit';
        }
        if (r === 'UNIT_ADMIN') {
            if (rank?.toLowerCase() === 'head of admin') return 'Head of Admin';
            return rank || 'Unit Administrator';
        }
        return r.replace(/_/g, ' ');
    };

    return (
        <div className="space-y-6">
            {/* Back Button */}
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition font-semibold text-sm"
            >
                <ArrowLeft size={18} /> Back to Directory
            </button>

            {/* Profile Detail Card */}
            <div className="bg-white rounded-3xl border border-gray-150 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900 h-36 w-full relative">
                    <div className="absolute inset-0 bg-black/10"></div>
                </div>
                <div className="px-8 pb-8 relative">
                    {/* Avatar Initials overlay */}
                    <div className="absolute -top-16 left-8 h-28 w-28 bg-white rounded-3xl p-1.5 shadow-lg border border-gray-100">
                        <div className="h-full w-full bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-4xl shadow-inner">
                            {staff.name.charAt(0)}
                        </div>
                    </div>

                    {/* Name / Email / Role row — pl-36 reserves space for the 7rem (112px) avatar + gap */}
                    <div className="mt-16 pl-36 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">{staff.name}</h1>
                            <p className="text-gray-500 font-medium text-sm mt-0.5 truncate">{staff.email}</p>
                        </div>
                        <span className="flex-shrink-0 bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide">
                            {displayRole(staff.role, staff.staffProfile?.rank || null)}
                        </span>
                    </div>

                    {/* Metadata grids */}
                    <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-gray-100">
                        <div className="flex items-center gap-3 text-gray-700">
                            <div className="h-10 w-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                                <Briefcase size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Rank & Level</p>
                                <p className="font-bold text-gray-800 text-sm">
                                    {staff.staffProfile?.rank || 'Staff'} 
                                    {staff.staffProfile?.level ? ` • Level ${staff.staffProfile.level}` : ''}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-gray-700">
                            <div className="h-10 w-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                                <Building size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Assigned Unit</p>
                                <p className="font-bold text-gray-800 text-sm truncate max-w-[220px]">
                                    {staff.staffProfile?.unit?.name || staff.staffProfile?.studyCenter?.name || 'Main Registry / HQ'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-gray-700">
                            <div className="h-10 w-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                                <GraduationCap size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Cadre</p>
                                <p className="font-bold text-gray-800 text-sm">{staff.staffProfile?.cadre || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-50">
                        <div className="flex items-center gap-3 text-gray-700">
                            <div className="h-10 w-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                                <Phone size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Phone</p>
                                <p className="font-bold text-gray-850 text-sm">{staff.staffProfile?.phone || 'N/A'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-gray-700">
                            <div className="h-10 w-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Address</p>
                                <p className="font-bold text-gray-850 text-sm">{staff.staffProfile?.address || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Staff Profile Management Panel */}
            {canManage && (
                <div className="bg-white rounded-3xl border border-blue-200/60 shadow-md overflow-hidden relative">
                    <div className="absolute right-0 top-0 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl"></div>
                    
                    <div className="p-6 border-b border-gray-150 bg-blue-50/20 flex items-center gap-3">
                        <div className="h-9 w-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 border border-blue-100">
                            <ShieldAlert size={18} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Staff Profile Management Panel</h2>
                            <p className="text-xs text-gray-500">Configure administrative roles, career placement, and bio-data details for this staff member.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmitAdmin} className="p-6 space-y-6">
                        {/* Section 1: Bio-Data & Career Configuration */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-extrabold text-blue-700 uppercase tracking-wider border-b border-blue-50 pb-2">
                                1. Bio-Data & Career Configuration
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {/* Surname */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Surname</label>
                                    <input
                                        type="text"
                                        value={editSurname}
                                        onChange={e => setEditSurname(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                        placeholder="Surname"
                                        required
                                    />
                                </div>
                                {/* Other Names */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Other Names</label>
                                    <input
                                        type="text"
                                        value={editOtherNames}
                                        onChange={e => setEditOtherNames(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                        placeholder="Other Names"
                                        required
                                    />
                                </div>
                                {/* Gender */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Gender</label>
                                    <select
                                        value={editGender}
                                        onChange={e => setEditGender(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                    >
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                {/* Phone */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Phone Number</label>
                                    <input
                                        type="text"
                                        value={editPhone}
                                        onChange={e => setEditPhone(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                        placeholder="Phone Number"
                                    />
                                </div>
                                {/* Address */}
                                <div className="space-y-1 md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Contact Address</label>
                                    <input
                                        type="text"
                                        value={editAddress}
                                        onChange={e => setEditAddress(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                        placeholder="Contact Address"
                                    />
                                </div>
                                {/* Cadre */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Cadre</label>
                                    <select
                                        value={editCadre}
                                        onChange={e => setEditCadre(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                    >
                                        <option value="ADMINISTRATIVE">Administrative</option>
                                        <option value="ACADEMIC">Academic</option>
                                        <option value="TECHNICAL">Technical</option>
                                        <option value="JUNIOR">Junior</option>
                                    </select>
                                </div>
                                {/* Rank */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Rank</label>
                                    <input
                                        type="text"
                                        value={editRank}
                                        onChange={e => setEditRank(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                        placeholder="e.g. Lecturer I, Senior Officer"
                                    />
                                </div>
                                {/* Level */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Salary Level</label>
                                    <input
                                        type="text"
                                        value={editLevel}
                                        onChange={e => setEditLevel(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                        placeholder="e.g. 13"
                                    />
                                </div>
                                {/* Step */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Salary Step</label>
                                    <input
                                        type="text"
                                        value={editStep}
                                        onChange={e => setEditStep(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                        placeholder="e.g. 2"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: System Role & Structure Configuration */}
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-extrabold text-blue-700 uppercase tracking-wider">
                                    2. System Role & Structure Configuration
                                </h3>
                                {!isHrAdmin && (
                                    <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-200">
                                        Read-Only for Managers
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {/* Role Dropdown */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Assign Role / Title</label>
                                    <select
                                        value={editRole}
                                        onChange={e => setEditRole(e.target.value)}
                                        disabled={!isHrAdmin}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed font-medium"
                                    >
                                        <option value="STAFF">Regular Staff</option>
                                        <option value="DIRECTOR">Director (HQ/Directorate)</option>
                                        <option value="DEAN">Dean (Faculty)</option>
                                        <option value="UNIT_HEAD">Head of Unit / HOD</option>
                                        <option value="HEAD_OF_ADMIN">Head of Admin</option>
                                        <option value="STUDY_CENTER_MANAGER">Study Center Manager</option>
                                        <option value="HR_ADMIN">HR Admin</option>
                                        <option value="BURSARY">Bursary</option>
                                        <option value="AUDIT">Audit</option>
                                    </select>
                                </div>

                                {/* Location Type Toggle */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Structure Assignment</label>
                                    <select
                                        value={editLocation}
                                        onChange={e => setEditLocation(e.target.value as any)}
                                        disabled={!isHrAdmin}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed font-medium"
                                    >
                                        <option value="NONE">Unassigned (General HQ)</option>
                                        <option value="HQ">Headquarters (Faculty/Directorate)</option>
                                        <option value="CENTER">Study Center</option>
                                    </select>
                                </div>

                                {/* Conditional Selectors */}
                                {editLocation === 'HQ' && (
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Select Directorate / Faculty</label>
                                        <select
                                            value={editUnitId}
                                            onChange={e => setEditUnitId(e.target.value)}
                                            disabled={!isHrAdmin}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed font-medium"
                                        >
                                            <option value="">-- Choose Unit --</option>
                                            <optgroup label="Faculties">
                                                {orgData.units.filter(u => u.type === 'FACULTY').map(u => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Directorates">
                                                {orgData.units.filter(u => u.type === 'DIRECTORATE').map(u => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                )}

                                {editLocation === 'CENTER' && (
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Select Study Center</label>
                                        <select
                                            value={editCenterId}
                                            onChange={e => setEditCenterId(e.target.value)}
                                            disabled={!isHrAdmin}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed font-medium"
                                        >
                                            <option value="">-- Choose Center --</option>
                                            {orgData.centers.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-150">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition shadow-sm active:scale-95 duration-100 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        Saving Changes...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Digital Dossier Module */}
            {staff.staffProfile?.id && (
                <DigitalDossier staffId={staff.staffProfile.id} />
            )}

            {/* Disciplinary Action History */}
            {staff.staffProfile?.id && (isHrAdmin || isManager) && (
                <div className="mt-8">
                    <QueryHistoryTab staffId={staff.staffProfile.id} />
                </div>
            )}
        </div>
    );
}
