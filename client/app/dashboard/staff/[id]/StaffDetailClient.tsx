'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
    ArrowLeft, 
    User, 
    Phone, 
    MapPin, 
    Briefcase, 
    ShieldAlert, 
    Shield,
    Save, 
    Building, 
    GraduationCap, 
    ChevronRight,
    Loader2,
    Calendar,
    TrendingUp,
    Info,
    CreditCard,
    CheckCircle2,
    Lock,
    ShieldCheck,
    XCircle,
    AlertCircle,
    Clock
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import api, { getImageUrl } from '../../../../lib/api';
import { STANDARD_QUALIFICATIONS } from '../../../../lib/qualifications';
import { NIGERIAN_BANKS, sanitizeAccountNumber } from '../../../../lib/banks';
import { CADRE_LIST, getPostsByCadre, getPostDefinition } from '../../../../lib/schemeOfService';
import DigitalDossier from '../../../../components/dashboard/DigitalDossier';
import QueryHistoryTab from '../../../../components/hr/dossier/QueryHistoryTab';

interface StaffDetail {
    id: string;
    name: string;
    email: string;
    role: string;
    passportUrl?: string | null;
    cadre?: string | null;
    cadreType?: string | null;
    pendingRole?: string | null;
    roleChangeStatus?: string | null;
    roleChangeRequestedById?: string | null;
    roleChangeRequestedAt?: string | null;
    roleChangeRemarks?: string | null;
    staffProfile?: {
        id: string;
        staffId: string | null;
        surname: string | null;
        otherNames: string | null;
        passportUrl?: string | null;
        nin?: string | null;
        highestQualification?: string | null;
        bankName?: string | null;
        accountNumber?: string | null;
        accountName?: string | null;
        department: string | null;
        rank: string | null;
        level: string | null;
        step: string | null;
        cadre: string | null;
        cadreType?: string | null;
        phone: string | null;
        gender: string | null;
        stateOfOrigin: string | null;
        lga: string | null;
        address: string | null;
        unitId: string | null;
        centerId: string | null;
        status?: string;
        dateOfBirth?: string;
        dateOfFirstAppointment?: string;
        lastPromotionDate?: string | null;
        nextPromotionDueYear?: number | null;
        nextPromotionDueDate?: string | null;
        promotionEligibilityStatus?: string | null;
        cadreCriteria?: string | null;
        unit?: { name: string; type: string };
        studyCenter?: { name: string; code: string };
    };
    activeLeave?: {
        id: string;
        type: string;
        startDate: string;
        endDate: string;
        durationDays: number;
        reason?: string;
    } | null;
}

interface OrganizationData {
    centers: { id: string; name: string; code: string }[];
    units: { id: string; name: string; type: string; code: string }[];
}

export default function StaffDetailPage({ params, onBack }: { params?: { id?: string }; onBack?: () => void }) {
    const routeParams = useParams();
    const router = useRouter();
    
    // Resolve staff ID flexibly across SSR params, Next.js route params, and direct URL path for static export
    const id = useMemo(() => {
        if (params?.id && params.id !== 'default') return params.id;
        if (routeParams?.id && routeParams.id !== 'default') return routeParams.id as string;
        if (typeof window !== 'undefined') {
            const cleanPath = window.location.pathname.replace(/\/$/, '');
            const segments = cleanPath.split('/');
            const last = segments[segments.length - 1];
            if (last && last !== 'staff' && last !== 'default') return last;
        }
        return (routeParams?.id as string) || params?.id || '';
    }, [params?.id, routeParams?.id]);

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
    const [editNin, setEditNin] = useState('');
    const [editHighestQualification, setEditHighestQualification] = useState('');
    const [editCustomQualification, setEditCustomQualification] = useState('');
    const [editBankName, setEditBankName] = useState('');
    const [editCustomBankName, setEditCustomBankName] = useState('');
    const [editAccountNumber, setEditAccountNumber] = useState('');
    const [editAccountName, setEditAccountName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editCadre, setEditCadre] = useState('ADMINISTRATIVE');
    const [editLevel, setEditLevel] = useState('');
    const [editStep, setEditStep] = useState('');
    const [editRank, setEditRank] = useState('');
    const [editGender, setEditGender] = useState('');
    const [editDateOfBirth, setEditDateOfBirth] = useState('');
    const [editDateOfFirstAppointment, setEditDateOfFirstAppointment] = useState('');
    const [editStatus, setEditStatus] = useState('ACTIVE');
    const [editTitle, setEditTitle] = useState('');

    // Promotion Maturity form state
    const [editLastPromotionDate, setEditLastPromotionDate] = useState('');
    const [editCadreAppraisalRule, setEditCadreAppraisalRule] = useState('SENIOR_ADMIN_3');
    const [editNextPromotionDueYear, setEditNextPromotionDueYear] = useState('');
    const [editNextPromotionDueDate, setEditNextPromotionDueDate] = useState('');
    const [isYearOverridden, setIsYearOverridden] = useState(false);
    const [overrideReason, setOverrideReason] = useState('');
    const [isDueImmediately, setIsDueImmediately] = useState(false);

    const isRegistrarAuthorizer = ['REGISTRAR', 'SUPER_USER', 'VICE_CHANCELLOR'].includes(currentUser?.role || '');
    const isHrAdmin = ['HR_ADMIN', 'REGISTRY_ADMIN', 'ADMIN', 'SUPER_USER', 'VICE_CHANCELLOR', 'REGISTRAR'].includes(currentUser?.role || '');

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

    // Statutory Cadre Maturity Rule Computation
    const computedPromotionSchedule = useMemo(() => {
        let baseDateStr = editLastPromotionDate || editDateOfFirstAppointment;
        let baseYear = new Date().getFullYear();

        if (baseDateStr) {
            const parsed = new Date(baseDateStr);
            if (!isNaN(parsed.getTime())) {
                baseYear = parsed.getFullYear();
            }
        }

        let interval = 3;
        let monthDay = '01-01';
        let ruleDescription = 'Standard 3-Year Administrative Cycle (Effective Jan 1)';

        const rule = editCadreAppraisalRule;
        const cadre = editCadre;

        if (rule === 'ACADEMIC_3' || cadre === 'ACADEMIC') {
            interval = 3;
            monthDay = '10-01';
            ruleDescription = 'Academic Cadre: Statutory 3-Year Waiting Period (Effective Oct 1)';
        } else if (rule === 'SENIOR_ADMIN_4') {
            interval = 4;
            monthDay = '01-01';
            ruleDescription = 'Senior Administrative (CONTISS 12–15): Statutory 4-Year Waiting Period (Effective Jan 1)';
        } else if (rule === 'JUNIOR_2') {
            interval = 2;
            monthDay = '01-01';
            ruleDescription = 'Junior Staff: Fast-Track 2-Year Waiting Period (Effective Jan 1)';
        } else if (rule === 'JUNIOR_3' || cadre === 'JUNIOR') {
            interval = 3;
            monthDay = '01-01';
            ruleDescription = 'Junior Staff: 3-Year Waiting Period (Effective Jan 1)';
        } else if (rule === 'CUSTOM') {
            interval = 3;
            monthDay = '01-01';
            ruleDescription = 'Custom Institutional Review Schedule';
        } else {
            interval = 3;
            monthDay = '01-01';
            ruleDescription = 'Senior Administrative / Non-Academic: 3-Year Waiting Period (Effective Jan 1)';
        }

        const calculatedYear = baseYear + interval;
        const calculatedDate = `${calculatedYear}-${monthDay}`;

        return {
            calculatedYear,
            calculatedDate,
            interval,
            ruleDescription
        };
    }, [editLastPromotionDate, editDateOfFirstAppointment, editCadreAppraisalRule, editCadre]);

    const getCalculatedRetirementDate = () => {
        if (!editDateOfBirth) return null;
        const dob = new Date(editDateOfBirth);
        if (isNaN(dob.getTime())) return null;

        const rankLower = (editRank || staff?.staffProfile?.rank || '').toLowerCase();
        const roleLower = (editRole || staff?.role || '').toLowerCase();
        const isProfessorOrReader = (editCadre === 'ACADEMIC' || staff?.staffProfile?.cadre === 'ACADEMIC') && 
            (rankLower.includes('prof') || rankLower.includes('reader') || roleLower.includes('prof'));

        const ageLimit = isProfessorOrReader ? 75 : 65;
        const serviceLimit = 35;

        // Age-based retirement
        const ageRetirementDate = new Date(dob);
        ageRetirementDate.setFullYear(ageRetirementDate.getFullYear() + ageLimit);

        // Service-based retirement
        let serviceRetirementDate: Date | null = null;
        if (editDateOfFirstAppointment) {
            const appt = new Date(editDateOfFirstAppointment);
            if (!isNaN(appt.getTime())) {
                serviceRetirementDate = new Date(appt);
                serviceRetirementDate.setFullYear(serviceRetirementDate.getFullYear() + serviceLimit);
            }
        }

        let retirementDate = ageRetirementDate;
        let reason = isProfessorOrReader ? 'Statutory Retirement by Age (75 Years - Professor/Reader)' : 'Statutory Retirement by Age (65 Years Limit)';

        if (serviceRetirementDate && !isProfessorOrReader && serviceRetirementDate < ageRetirementDate) {
            retirementDate = serviceRetirementDate;
            reason = 'Statutory Retirement by Length of Service (35 Years Pensionable Limit)';
        }

        return {
            date: retirementDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }),
            reason
        };
    };

    const fetchStaffData = async () => {
        if (!id) return;
        try {
            setLoading(true);
            const [staffRes, orgRes] = await Promise.all([
                api.get(`/api/staff/${id}`),
                api.get('/api/org/structure')
            ]);
            
            const staffData = staffRes.data;
            setStaff(staffData);
            setOrgData(orgRes.data || { centers: [], units: [] });

            // Authorization check
            if (currentUser && staffData) {
                const isSelf = currentUser.id === staffData.id || (currentUser.staffProfile?.id && currentUser.staffProfile.id === staffData.staffProfile?.id);
                const isHrAdmin = ['HR_ADMIN', 'REGISTRY_ADMIN', 'ADMIN', 'SUPER_USER', 'VICE_CHANCELLOR', 'REGISTRAR'].includes(currentUser.role || '');
                const isManagerOfStaff = 
                    ['UNIT_HEAD', 'STUDY_CENTER_MANAGER', 'UNIT_ADMIN'].includes(currentUser.role || '') && 
                    currentUser.staffProfile && staffData.staffProfile &&
                    (
                        (currentUser.staffProfile.unitId && staffData.staffProfile.unitId === currentUser.staffProfile.unitId) ||
                        (currentUser.staffProfile.centerId && staffData.staffProfile.centerId === currentUser.staffProfile.centerId)
                    );

                if (!isSelf && !isHrAdmin && !isManagerOfStaff) {
                    router.push('/dashboard/access-denied');
                    return;
                }
            }

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
                setEditTitle(staffData.staffProfile?.title || '');
                setEditSurname(staffData.staffProfile?.surname || '');
                setEditOtherNames(staffData.staffProfile?.otherNames || '');
                setEditNin(staffData.staffProfile?.nin || '');
                const qual = staffData.staffProfile?.highestQualification || '';
                if (qual && !STANDARD_QUALIFICATIONS.includes(qual)) {
                    setEditHighestQualification('CUSTOM');
                    setEditCustomQualification(qual);
                } else {
                    setEditHighestQualification(qual);
                    setEditCustomQualification('');
                }
                const bName = staffData.staffProfile?.bankName || '';
                if (bName && !NIGERIAN_BANKS.some(b => b.name === bName)) {
                    setEditBankName('OTHER');
                    setEditCustomBankName(bName);
                } else {
                    setEditBankName(bName);
                    setEditCustomBankName('');
                }
                setEditAccountNumber(staffData.staffProfile?.accountNumber || '');
                setEditAccountName(staffData.staffProfile?.accountName || '');
                setEditPhone(staffData.staffProfile?.phone || '');
                setEditAddress(staffData.staffProfile?.address || '');
                setEditCadre(staffData.staffProfile?.cadre || 'ADMINISTRATIVE');
                setEditLevel(staffData.staffProfile?.level || '');
                setEditStep(staffData.staffProfile?.step || '');
                setEditRank(staffData.staffProfile?.rank || '');
                setEditGender(staffData.staffProfile?.gender || '');
                setEditDateOfBirth(staffData.staffProfile?.dateOfBirth ? staffData.staffProfile.dateOfBirth.substring(0, 10) : '');
                setEditDateOfFirstAppointment(staffData.staffProfile?.dateOfFirstAppointment ? staffData.staffProfile.dateOfFirstAppointment.substring(0, 10) : '');
                const rawStatus = (staffData.staffProfile?.status || 'ACTIVE').toUpperCase();
                setEditStatus(rawStatus === 'FIRED' ? 'TERMINATED' : rawStatus);

                // Initialize promotion state variables
                if (staffData.staffProfile?.lastPromotionDate) {
                    setEditLastPromotionDate(staffData.staffProfile.lastPromotionDate.substring(0, 10));
                } else {
                    setEditLastPromotionDate('');
                }
                if (staffData.staffProfile?.nextPromotionDueYear) {
                    setEditNextPromotionDueYear(String(staffData.staffProfile.nextPromotionDueYear));
                }
                if (staffData.staffProfile?.nextPromotionDueDate) {
                    setEditNextPromotionDueDate(staffData.staffProfile.nextPromotionDueDate.substring(0, 10));
                }
                if (staffData.staffProfile?.cadreCriteria) {
                    if (staffData.staffProfile.cadreCriteria === 'ACADEMIC') setEditCadreAppraisalRule('ACADEMIC_3');
                    else if (staffData.staffProfile.cadreCriteria === 'JUNIOR') setEditCadreAppraisalRule('JUNIOR_3');
                    else setEditCadreAppraisalRule('SENIOR_ADMIN_3');
                }
            }
        } catch (err: any) {
            console.error('Failed to load staff details:', err);
            if (err.response?.status === 403 || err.response?.status === 401) {
                router.push('/dashboard/access-denied');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaffData();
    }, [id]);

    const handleSubmitAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (isYearOverridden && (!overrideReason || overrideReason.trim().length < 5)) {
                alert('A valid administrative override justification (minimum 5 characters) is required when modifying the calculated promotion year.');
                setSaving(false);
                return;
            }

            if (editRole !== staff?.role && !isHrAdmin) {
                alert('Security Violation: Only HR/Registry Administrators can request role changes, subject to Registrar authorization.');
                setSaving(false);
                return;
            }

            let dbRole = editRole;
            let dbRank = editRank || staff?.staffProfile?.rank || 'Staff';

            if (isHrAdmin && !editRank) {
                if (editRole === 'REGISTRAR') {
                    dbRole = 'REGISTRAR';
                    dbRank = 'University Registrar';
                } else if (editRole === 'VICE_CHANCELLOR') {
                    dbRole = 'VICE_CHANCELLOR';
                    dbRank = 'Vice-Chancellor';
                } else if (editRole === 'SUPER_USER') {
                    dbRole = 'SUPER_USER';
                    dbRank = 'System Administrator';
                } else if (editRole === 'DIRECTOR') {
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
                } else if (editRole === 'CLINIC_HEAD') {
                    dbRank = 'Head of Clinic';
                } else if (editRole === 'CLINIC_DOCTOR') {
                    dbRank = 'Medical Doctor';
                } else if (editRole === 'CLINIC_NURSE') {
                    dbRank = 'Nurse';
                } else if (editRole === 'CLINIC_LAB_SCIENTIST') {
                    dbRank = 'Lab Scientist';
                } else if (editRole === 'SECURITY_HEAD') {
                    dbRank = 'Head of Security';
                } else if (editRole === 'SECURITY_OFFICER') {
                    dbRank = 'Security Officer';
                } else if (editRole === 'DRIVER') {
                    dbRank = 'Driver';
                }
            }

            const isArchivedStatus = ['RETIRED', 'DECEASED', 'RESIGNED', 'TERMINATED', 'FIRED'].includes(editStatus);
            const wasActive = !['RETIRED', 'DECEASED', 'RESIGNED', 'TERMINATED', 'FIRED'].includes(staff?.staffProfile?.status || 'ACTIVE');

            if (isArchivedStatus && wasActive) {
                const confirmed = confirm(
                    `WARNING: Changing status to ${editStatus} will immediately:\n` +
                    `1. Archive this staff member's file.\n` +
                    `2. Revoke all active login sessions/tokens.\n` +
                    `3. Disable their portal access.\n\n` +
                    `Are you sure you want to proceed?`
                );
                if (!confirmed) {
                    setSaving(false);
                    return;
                }
            }

            const effectiveQualification = editHighestQualification === 'CUSTOM'
                ? editCustomQualification.trim()
                : editHighestQualification;

            const effectiveBankName = editBankName === 'OTHER'
                ? editCustomBankName.trim()
                : editBankName;

            const payload = {
                title: editTitle,
                surname: editSurname,
                otherNames: editOtherNames,
                nin: editNin.trim() || undefined,
                highestQualification: effectiveQualification || undefined,
                bankName: effectiveBankName || undefined,
                accountNumber: editAccountNumber.trim() || undefined,
                accountName: editAccountName.trim() || undefined,
                phone: editPhone,
                address: editAddress,
                level: editLevel,
                step: editStep,
                cadre: editCadre,
                gender: editGender,
                role: dbRole,
                rank: dbRank,
                unitId: isHrAdmin ? (editLocation === 'HQ' ? editUnitId : 'null') : staff?.staffProfile?.unitId,
                centerId: isHrAdmin ? (editLocation === 'CENTER' ? editCenterId : 'null') : staff?.staffProfile?.centerId,
                dateOfBirth: editDateOfBirth,
                dateOfFirstAppointment: editDateOfFirstAppointment,
                status: editStatus,
                lastPromotionDate: editLastPromotionDate || undefined,
                cadreAppraisalRule: editCadreAppraisalRule,
                nextPromotionDueYear: editNextPromotionDueYear ? parseInt(editNextPromotionDueYear, 10) : undefined,
                nextPromotionDueDate: editNextPromotionDueDate || undefined,
                overrideReason: overrideReason || undefined,
                roleChangeRemarks: overrideReason || undefined,
                isDueImmediately: Boolean(isDueImmediately)
            };

            const { data } = await api.put(`/api/staff/${staff?.id}`, payload);
            alert(data?.message || (editRole !== staff?.role && !isRegistrarAuthorizer
                ? "Staff profile updated. Role will take effect immediately after registrar's authorization."
                : 'Staff profile updated successfully.'));
            fetchStaffData(); // Reload profile details
        } catch (error: any) {
            console.error(error);
            alert(error.response?.data?.message || 'Failed to update staff profile.');
        } finally {
            setSaving(false);
        }
    };

    const [authorizingRole, setAuthorizingRole] = useState(false);

    const handleApproveRoleChange = async () => {
        if (!confirm(`Are you sure you want to officially authorize changing this staff member's role to ${staff?.pendingRole}?`)) return;
        setAuthorizingRole(true);
        try {
            const { data } = await api.post(`/api/staff/${staff?.id}/role/approve`, { remarks: 'Registrar dual-control clearance granted' });
            alert(data.message || 'Role change authorized successfully.');
            fetchStaffData();
        } catch (err: any) {
            alert('Failed to authorize role change: ' + (err.response?.data?.message || err.message));
        } finally {
            setAuthorizingRole(false);
        }
    };

    const handleRejectRoleChange = async () => {
        const reason = prompt('Please enter reason for rejecting this role change request:');
        if (!reason) return;
        setAuthorizingRole(true);
        try {
            const { data } = await api.post(`/api/staff/${staff?.id}/role/reject`, { remarks: reason });
            alert(data.message || 'Role change request rejected.');
            fetchStaffData();
        } catch (err: any) {
            alert('Failed to reject role change: ' + (err.response?.data?.message || err.message));
        } finally {
            setAuthorizingRole(false);
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
                onClick={() => onBack ? onBack() : router.push('/dashboard/staff')}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition font-semibold text-sm"
            >
                <ArrowLeft size={18} /> Back to Directory
            </button>

            {/* Active Leave Countdown Banner if staff member is on leave */}
            {staff.activeLeave && (
                <LeaveCountdownTimer 
                    endDate={staff.activeLeave.endDate} 
                    startDate={staff.activeLeave.startDate}
                    type={staff.activeLeave.type}
                />
            )}

            {/* Profile Detail Card */}
            <div className="bg-white rounded-3xl border border-gray-150 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900 h-36 w-full relative">
                    <div className="absolute inset-0 bg-black/10"></div>
                </div>
                <div className="px-8 pb-8 relative">
                    {/* Avatar Initials or Passport overlay */}
                    <div className="absolute -top-16 left-8 h-28 w-28 bg-white rounded-3xl p-1.5 shadow-lg border border-gray-100 overflow-hidden">
                        {(staff.staffProfile?.passportUrl || staff.passportUrl) ? (
                            <img
                                src={getImageUrl(staff.staffProfile?.passportUrl || staff.passportUrl)}
                                alt={staff.name}
                                className="h-full w-full object-cover rounded-2xl"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallbackEl = e.currentTarget.parentElement?.querySelector('.avatar-initials-fallback') as HTMLElement;
                                    if (fallbackEl) fallbackEl.style.display = 'flex';
                                }}
                            />
                        ) : null}
                        <div 
                            className={`avatar-initials-fallback h-full w-full bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-4xl shadow-inner ${(staff.staffProfile?.passportUrl || staff.passportUrl) ? 'hidden' : 'flex'}`}
                        >
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
                                <p className="font-bold text-gray-800 text-sm">{staff.staffProfile?.cadre || staff.cadre || staff.staffProfile?.cadreType || staff.cadreType || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 border-t border-gray-50">
                        <div className="flex items-center gap-3 text-gray-700">
                            <div className="h-10 w-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                                <GraduationCap size={20} className="text-nounGreen" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Highest Qualification</p>
                                <p className="font-bold text-gray-850 text-sm truncate max-w-[180px]" title={staff.staffProfile?.highestQualification || 'Not Specified'}>
                                    {staff.staffProfile?.highestQualification || 'Not Specified'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-gray-700">
                            <div className="h-10 w-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                                <Shield size={20} className="text-nounGreen" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">National ID (NIN)</p>
                                <p className="font-bold text-gray-850 text-sm font-mono tracking-wider">
                                    {staff.staffProfile?.nin || 'Not Provided'}
                                </p>
                            </div>
                        </div>

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
                                <p className="font-bold text-gray-850 text-sm truncate max-w-[180px]">{staff.staffProfile?.address || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Promotion Maturity & Career Milestone Overview Card */}
            <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm p-6 overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-green-600"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-700 border border-emerald-100">
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Promotion Maturity &amp; Career Milestone</h2>
                            <p className="text-xs text-gray-500">Substantive promotion maturity schedule and institutional appraisal eligibility.</p>
                        </div>
                    </div>
                    <div>
                        {staff.staffProfile?.promotionEligibilityStatus === 'DUE_THIS_CYCLE' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                <Info size={13} className="text-amber-700" /> Due This Cycle (2026)
                            </span>
                        ) : staff.staffProfile?.promotionEligibilityStatus === 'MATURED_OVERDUE' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-200">
                                <Info size={13} className="text-red-700" /> Matured / Overdue
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <TrendingUp size={13} className="text-emerald-700" /> Pending Maturity
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Last Promotion Date</span>
                        <span className="text-sm font-extrabold text-slate-800">
                            {staff.staffProfile?.lastPromotionDate 
                                ? new Date(staff.staffProfile.lastPromotionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                : (staff.staffProfile?.dateOfFirstAppointment ? new Date(staff.staffProfile.dateOfFirstAppointment).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'First Appointment')}
                        </span>
                    </div>

                    <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">Next Due Year</span>
                        <span className="text-lg font-black text-emerald-950 font-mono">
                            {staff.staffProfile?.nextPromotionDueYear || computedPromotionSchedule.calculatedYear}
                        </span>
                    </div>

                    <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">Target Effective Date</span>
                        <span className="text-sm font-extrabold text-emerald-950">
                            {staff.staffProfile?.nextPromotionDueDate 
                                ? new Date(staff.staffProfile.nextPromotionDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                : `${staff.staffProfile?.cadre === 'ACADEMIC' ? '01 Oct' : '01 Jan'} ${staff.staffProfile?.nextPromotionDueYear || computedPromotionSchedule.calculatedYear}`}
                        </span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cadre Waiting Rule</span>
                        <span className="text-xs font-bold text-slate-800">
                            {staff.staffProfile?.cadre === 'ACADEMIC' ? 'Academic (3 Yrs • Oct 1)' : 'Admin/Junior (3–4 Yrs • Jan 1)'}
                        </span>
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
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                                {/* Title */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Title</label>
                                    <select
                                        value={editTitle}
                                        onChange={e => setEditTitle(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                    >
                                        <option value="">Select Title</option>
                                        <option value="Mr">Mr</option>
                                        <option value="Mrs">Mrs</option>
                                        <option value="Ms">Ms</option>
                                        <option value="Miss">Miss</option>
                                        <option value="Dr (Ph.D)">Dr. (Ph.D. - Doctor of Philosophy)</option>
                                        <option value="Dr (M.D.)">Dr. (M.D. / M.B.B.S. - Medical Doctor)</option>
                                        <option value="Assoc. Prof">Assoc. Prof</option>
                                        <option value="Prof">Prof.</option>
                                        <option value="Engr">Engr.</option>
                                        <option value="Barr">Barr.</option>
                                        <option value="Pharm">Pharm.</option>
                                        <option value="Nurse">Nurse</option>
                                        <option value="MLS">MLS</option>
                                    </select>
                                </div>
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
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-550/20 focus:border-blue-500 outline-none bg-white font-medium"
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
                                {/* National ID (NIN) */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                                        <span className="flex items-center gap-1"><Shield size={13} className="text-nounGreen" /> National ID (NIN)</span>
                                        {editNin.length === 11 ? (
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                                                <CheckCircle2 size={10} /> 11-Digit Valid
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-500 font-semibold">{editNin.length}/11 Digits</span>
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={11}
                                        value={editNin}
                                        onChange={e => setEditNin(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono tracking-wider font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                                        placeholder="11-digit NIN"
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
                                        onChange={e => {
                                            const newCadre = e.target.value;
                                            setEditCadre(newCadre);
                                            const posts = getPostsByCadre(newCadre);
                                            if (posts.length > 0) {
                                                const firstPost = posts[0];
                                                setEditRank(firstPost.post);
                                                setEditLevel(String(firstPost.gradeLevel));
                                            }
                                        }}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                    >
                                        <option value="">-- Select Cadre --</option>
                                        {editCadre && !CADRE_LIST.includes(editCadre) && (
                                            <option value={editCadre}>{editCadre}</option>
                                        )}
                                        {CADRE_LIST.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Rank/Post */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Rank/Post</label>
                                    <select
                                        value={editRank}
                                        onChange={e => {
                                            const newRank = e.target.value;
                                            setEditRank(newRank);
                                            const def = getPostDefinition(editCadre, newRank);
                                            if (def) {
                                                setEditLevel(String(def.gradeLevel));
                                            }
                                        }}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                    >
                                        <option value="">-- Select Rank/Post --</option>
                                        {editRank && !getPostsByCadre(editCadre).some(p => p.post === editRank) && (
                                            <option value={editRank}>{editRank}</option>
                                        )}
                                        {getPostsByCadre(editCadre).map(p => (
                                            <option key={p.post} value={p.post}>{p.post} ({p.salaryScale})</option>
                                        ))}
                                    </select>
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

                                {/* Scheme of Service Statutory Profile Info */}
                                {(() => {
                                    const postDef = getPostDefinition(editCadre, editRank);
                                    if (!postDef) return null;
                                    return (
                                        <div className="md:col-span-2 p-3.5 bg-emerald-50/90 rounded-xl border border-emerald-200 text-xs space-y-1.5 shadow-sm">
                                            <div className="font-bold text-emerald-950 flex items-center justify-between">
                                                <span>Scheme of Service Statutory Profile:</span>
                                                <span className="font-mono text-xs text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-bold">{postDef.salaryScale}</span>
                                            </div>
                                            <div className="text-[11px] text-emerald-800 flex flex-wrap gap-x-4 gap-y-1">
                                                <span><span className="font-semibold">Next Grade:</span> {postDef.nextGrade || 'Terminal Grade (Apex)'} {postDef.nextSalaryScale ? `(${postDef.nextSalaryScale})` : ''}</span>
                                                <span><span className="font-semibold">Min Waiting Period:</span> {postDef.minYearsWaiting > 0 ? `${postDef.minYearsWaiting} Years` : 'N/A'}</span>
                                            </div>
                                            {postDef.qualifications && (
                                                <div className="text-[10px] text-emerald-700 leading-relaxed">
                                                    <span className="font-semibold">Statutory Qualifications:</span> {postDef.qualifications}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                                {/* Highest Qualification */}
                                <div className="space-y-1 md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <GraduationCap size={15} className="text-nounGreen" /> Highest Educational Qualification
                                    </label>
                                    <select
                                        value={editHighestQualification}
                                        onChange={e => setEditHighestQualification(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                    >
                                        <option value="">Select Highest Qualification</option>
                                        {STANDARD_QUALIFICATIONS.map(q => (
                                            <option key={q} value={q}>{q}</option>
                                        ))}
                                        <option value="CUSTOM">Other / Specific Degree Title</option>
                                    </select>
                                    {editHighestQualification === 'CUSTOM' && (
                                        <input
                                            type="text"
                                            value={editCustomQualification}
                                            onChange={e => setEditCustomQualification(e.target.value)}
                                            placeholder="Enter specific qualification (e.g. Ph.D. in Cyber Security, LL.M, etc.)"
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mt-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium"
                                        />
                                    )}
                                </div>
                                {/* Bursary & Banking Details */}
                                <div className="md:col-span-2 bg-blue-50/70 p-4 rounded-xl border border-blue-200 space-y-3">
                                    <label className="block text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                                        <CreditCard size={16} className="text-blue-700" />
                                        Bursary &amp; Banking Details (Disbursements &amp; Payroll)
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-blue-900 mb-1">Bank Name</label>
                                            <select
                                                value={editBankName}
                                                onChange={e => setEditBankName(e.target.value)}
                                                className="w-full border border-blue-300 rounded-lg p-2 bg-white text-xs text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                <option value="">Select Bank</option>
                                                <optgroup label="Commercial Banks">
                                                    {NIGERIAN_BANKS.filter(b => b.category === 'Commercial').map(b => (
                                                        <option key={b.code} value={b.name}>{b.name}</option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label="Non-Interest / Islamic Banks">
                                                    {NIGERIAN_BANKS.filter(b => b.category === 'Non-Interest').map(b => (
                                                        <option key={b.code} value={b.name}>{b.name}</option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label="Fintech & Digital Banks">
                                                    {NIGERIAN_BANKS.filter(b => b.category === 'Fintech').map(b => (
                                                        <option key={b.code} value={b.name}>{b.name}</option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label="Merchant & Other Banks">
                                                    {NIGERIAN_BANKS.filter(b => b.category === 'Merchant' || b.category === 'Microfinance').map(b => (
                                                        <option key={b.code} value={b.name}>{b.name}</option>
                                                    ))}
                                                </optgroup>
                                                <option value="OTHER">Other / Specific MFB</option>
                                            </select>
                                            {editBankName === 'OTHER' && (
                                                <input
                                                    type="text"
                                                    value={editCustomBankName}
                                                    onChange={e => setEditCustomBankName(e.target.value)}
                                                    placeholder="Specify institution name"
                                                    className="w-full border border-blue-300 rounded-lg p-2 mt-1.5 bg-white text-xs text-gray-900"
                                                />
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-blue-900 mb-1 flex items-center justify-between">
                                                <span>Account Number (NUBAN)</span>
                                                {editAccountNumber.length === 10 && (
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded inline-flex items-center gap-0.5">
                                                        <CheckCircle2 size={10} /> 10 Digits
                                                    </span>
                                                )}
                                            </label>
                                            <input
                                                type="text"
                                                maxLength={10}
                                                value={editAccountNumber}
                                                onChange={e => setEditAccountNumber(sanitizeAccountNumber(e.target.value))}
                                                placeholder="10 Digits"
                                                className="w-full border border-blue-300 rounded-lg p-2 bg-white text-xs text-gray-900 font-mono font-bold tracking-wider focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-blue-900 mb-1">Account Name</label>
                                            <input
                                                type="text"
                                                value={editAccountName}
                                                onChange={e => setEditAccountName(e.target.value)}
                                                placeholder="Full Beneficiary Name"
                                                className="w-full border border-blue-300 rounded-lg p-2 bg-white text-xs text-gray-900 font-medium uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* Date of Birth */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Date of Birth</label>
                                    <input
                                        type="date"
                                        value={editDateOfBirth}
                                        onChange={e => setEditDateOfBirth(e.target.value)}
                                        disabled={!isHrAdmin}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium disabled:bg-gray-100"
                                    />
                                </div>
                                {/* Date of First Appointment */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Date of First Appointment</label>
                                    <input
                                        type="date"
                                        value={editDateOfFirstAppointment}
                                        onChange={e => setEditDateOfFirstAppointment(e.target.value)}
                                        disabled={!isHrAdmin}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium disabled:bg-gray-100"
                                    />
                                </div>
                                {/* Employment Status */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Employment Status</label>
                                    <select
                                        value={editStatus}
                                        onChange={e => setEditStatus(e.target.value)}
                                        disabled={!isHrAdmin}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium disabled:bg-gray-100"
                                    >
                                        <option value="ACTIVE">Active</option>
                                        <option value="ON_LEAVE">On Leave</option>
                                        <option value="SUSPENDED">Suspended</option>
                                        <option value="RETIRED">Retired</option>
                                        <option value="DECEASED">Deceased</option>
                                        <option value="RESIGNED">Resigned</option>
                                        <option value="TERMINATED">Terminated</option>
                                    </select>
                                </div>
                                {/* Calculated Retirement Date */}
                                {getCalculatedRetirementDate() && (
                                    <div className="md:col-span-2 p-3 bg-blue-50 border border-blue-150 rounded-xl text-xs text-blue-800 space-y-1">
                                        <p className="font-bold uppercase tracking-wider text-[10px]">Calculated Retirement Date</p>
                                        <p className="text-sm font-semibold">{getCalculatedRetirementDate()?.date}</p>
                                        <p className="text-[11px] text-blue-600">Reason: {getCalculatedRetirementDate()?.reason}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 2: System Role & Structure Configuration */}
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-extrabold text-blue-700 uppercase tracking-wider">
                                    2. System Role & Structure Configuration
                                </h3>
                                {staff?.roleChangeStatus === 'PENDING_REGISTRAR_APPROVAL' ? (
                                    <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1.5 animate-pulse">
                                        <Clock size={12} className="text-amber-600" /> Pending Registrar Authorization
                                    </span>
                                ) : !isHrAdmin ? (
                                    <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-200">
                                        Read-Only for Managers
                                    </span>
                                ) : isRegistrarAuthorizer ? (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                                        <ShieldCheck size={12} className="text-emerald-600" /> Registrar Authorization Active
                                    </span>
                                ) : (
                                    <span className="text-[10px] bg-blue-50 text-blue-800 font-bold px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                                        <Lock size={12} className="text-blue-600" /> Maker-Checker Role Governance
                                    </span>
                                )}
                            </div>

                            {/* Pending Registrar Approval Banner */}
                            {staff?.roleChangeStatus === 'PENDING_REGISTRAR_APPROVAL' && (
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-amber-100 text-amber-800 rounded-xl mt-0.5">
                                            <AlertCircle size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-amber-900">
                                                    Pending Institutional Role Change
                                                </h4>
                                                <span className="text-xs bg-amber-200 text-amber-900 font-semibold px-2 py-0.5 rounded-full">
                                                    Awaiting Registrar
                                                </span>
                                            </div>
                                            <p className="text-xs text-amber-800 mt-1">
                                                A request to change this staff member&apos;s role to{' '}
                                                <span className="font-mono font-bold uppercase underline">
                                                    {staff.pendingRole}
                                                </span>{' '}
                                                is currently pending dual-control sign-off.
                                                {staff.roleChangeRemarks && (
                                                    <span className="block mt-0.5 italic text-amber-700">
                                                        Remarks: &ldquo;{staff.roleChangeRemarks}&rdquo;
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Buttons for Authorizers (Registrar / Super User / VC) */}
                                    {isRegistrarAuthorizer && (
                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <button
                                                type="button"
                                                onClick={handleApproveRoleChange}
                                                disabled={authorizingRole}
                                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                                            >
                                                {authorizingRole ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <ShieldCheck size={14} />
                                                )}
                                                Authorize Change
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleRejectRoleChange}
                                                disabled={authorizingRole}
                                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 text-red-700 border border-red-200 text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                                            >
                                                <XCircle size={14} />
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

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
                                        <option value="REGISTRAR">The Registrar (Super admin)</option>
                                        <option value="VICE_CHANCELLOR">The VC</option>
                                        <option value="SUPER_USER">Super User / System Admin</option>
                                        <option value="DIRECTOR">Director (HQ/Directorate)</option>
                                        <option value="DEAN">Dean (Faculty)</option>
                                        <option value="UNIT_HEAD">Head of Unit / HOD</option>
                                        <option value="HEAD_OF_ADMIN">Head of Admin</option>
                                        <option value="STUDY_CENTER_MANAGER">Study Center Manager</option>
                                        <option value="HR_ADMIN">HR Admin</option>
                                        <option value="REGISTRY_ADMIN">Registry Admin (Operations)</option>
                                        <option value="BURSARY">Bursary</option>
                                        <option value="AUDIT">Audit</option>
                                        <option value="CLINIC_HEAD">Head of Clinic</option>
                                        <option value="CLINIC_DOCTOR">Medical Doctor (M.D. / M.B.B.S.)</option>
                                        <option value="CLINIC_NURSE">Nurse</option>
                                        <option value="CLINIC_LAB_SCIENTIST">Lab Scientist</option>
                                        <option value="SECURITY_HEAD">Head of Security</option>
                                        <option value="SECURITY_OFFICER">Officer</option>
                                        <option value="DRIVER">Driver</option>
                                    </select>
                                    {staff?.roleChangeStatus === 'PENDING_REGISTRAR_APPROVAL' ? (
                                        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2 shadow-xs">
                                            <Clock size={16} className="text-amber-600 animate-pulse shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-bold text-amber-900">
                                                    Role will take effect immediately after registrar&apos;s authorization
                                                </p>
                                                <p className="text-[11px] font-medium text-amber-700 mt-0.5">
                                                    Pending Role: <span className="font-mono font-bold uppercase underline">{staff.pendingRole}</span>
                                                    {staff.roleChangeRequestedAt && (
                                                        <span> &bull; Submitted {new Date(staff.roleChangeRequestedAt).toLocaleDateString()}</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    ) : editRole !== staff?.role && isHrAdmin && !isRegistrarAuthorizer ? (
                                        <div className="mt-2 p-2.5 bg-blue-50 border border-blue-300 rounded-xl text-xs text-blue-900 flex items-start gap-2 shadow-xs">
                                            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-bold text-blue-900">
                                                    Role will take effect immediately after registrar&apos;s authorization
                                                </p>
                                                <p className="text-[11px] font-medium text-blue-700 mt-0.5">
                                                    Selected: <span className="font-mono font-bold">{editRole}</span> &bull; Click &ldquo;Save Changes&rdquo; below to submit to Registrar
                                                </p>
                                            </div>
                                        </div>
                                    ) : isRegistrarAuthorizer ? (
                                        <p className="text-[10px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                                            <ShieldCheck size={10} /> Direct Authorization: Changes take effect immediately.
                                        </p>
                                    ) : isHrAdmin ? (
                                        <p className="text-[10px] text-blue-700 font-semibold mt-1 flex items-center gap-1">
                                            <Lock size={10} /> Role will take effect immediately after registrar&apos;s authorization.
                                        </p>
                                    ) : (
                                        <p className="text-[10px] text-gray-500 font-semibold mt-1 flex items-center gap-1">
                                            <Lock size={10} /> Institutional Rule: Role changes restricted to HR and the Registrar.
                                        </p>
                                    )}
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
                                            <optgroup label="Directorates & Departments">
                                                {orgData.units.filter(u => u.type === 'DIRECTORATE' || u.type === 'DEPARTMENT').map(u => (
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

                        {/* Section 3: Promotion Maturity & Scheduling */}
                        <div className="space-y-4 pt-4 border-t border-gray-100 bg-emerald-50/40 p-5 rounded-2xl border border-emerald-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="text-emerald-700" size={18} />
                                    <h3 className="text-sm font-extrabold text-emerald-900 uppercase tracking-wider">
                                        3. Promotion Maturity & Scheduling
                                    </h3>
                                </div>
                                {!isHrAdmin && (
                                    <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-200">
                                        Read-Only for Managers
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-emerald-700">
                                Establish statutory promotion maturity dates and legacy service records for automated tracking and annual appraisal staging.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Last Promotion / Substantive Appointment Date
                                    </label>
                                    <input
                                        type="date"
                                        value={editLastPromotionDate}
                                        onChange={e => setEditLastPromotionDate(e.target.value)}
                                        disabled={!isHrAdmin}
                                        className="w-full border border-emerald-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white disabled:bg-gray-50 disabled:text-gray-500 font-medium"
                                    />
                                    <span className="text-[10px] text-gray-500 block">Defaults to date of first appointment if blank.</span>
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Cadre & Appraisal Rule
                                    </label>
                                    <select
                                        value={editCadreAppraisalRule}
                                        onChange={e => setEditCadreAppraisalRule(e.target.value)}
                                        disabled={!isHrAdmin}
                                        className="w-full border border-emerald-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white disabled:bg-gray-50 disabled:text-gray-500 font-medium"
                                    >
                                        <option value="ACADEMIC_3">Academic — 3 Year Cycle (Oct 1)</option>
                                        <option value="SENIOR_ADMIN_3">Senior Admin — 3 Year Cycle (Jan 1)</option>
                                        <option value="SENIOR_ADMIN_4">Senior Admin (CONTISS 12+) — 4 Year Cycle (Jan 1)</option>
                                        <option value="JUNIOR_2">Junior Staff — 2 Year Fast-Track (Jan 1)</option>
                                        <option value="JUNIOR_3">Junior Staff — 3 Year Cycle (Jan 1)</option>
                                        <option value="CUSTOM">Custom Institutional Schedule</option>
                                    </select>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-3">
                                <div className="flex items-center gap-1.5 font-semibold text-xs">
                                    <Info size={14} className="text-emerald-600" />
                                    <span>Statutory Rule Applied:</span>
                                </div>
                                <p className="text-emerald-800 text-xs font-medium bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                                    {computedPromotionSchedule.ruleDescription}
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Next Promotion Due Year</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={editNextPromotionDueYear || computedPromotionSchedule.calculatedYear}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setEditNextPromotionDueYear(val);
                                                    setIsYearOverridden(Number(val) !== computedPromotionSchedule.calculatedYear);
                                                }}
                                                disabled={!isHrAdmin}
                                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono font-bold bg-white disabled:bg-gray-50 disabled:text-gray-500"
                                                placeholder={String(computedPromotionSchedule.calculatedYear)}
                                            />
                                            {isYearOverridden && (
                                                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded whitespace-nowrap">
                                                    Overridden
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Target Effective Date</label>
                                        <input
                                            type="date"
                                            value={editNextPromotionDueDate || computedPromotionSchedule.calculatedDate}
                                            onChange={e => setEditNextPromotionDueDate(e.target.value)}
                                            disabled={!isHrAdmin}
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono bg-white disabled:bg-gray-50 disabled:text-gray-500"
                                        />
                                    </div>
                                </div>

                                {isYearOverridden && (
                                    <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                                        <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                                            Override Justification (Mandatory) *
                                        </label>
                                        <input
                                            type="text"
                                            value={overrideReason}
                                            onChange={e => setOverrideReason(e.target.value)}
                                            disabled={!isHrAdmin}
                                            placeholder="State reason for non-standard promotion maturity year (e.g. Accelerated Board Approval)"
                                            className="w-full border border-amber-300 rounded-lg p-2 text-xs bg-white"
                                        />
                                    </div>
                                )}

                                {isHrAdmin && (
                                    <div className="pt-2">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={isDueImmediately}
                                                onChange={e => setIsDueImmediately(e.target.checked)}
                                                className="rounded border-emerald-300 text-emerald-700 focus:ring-emerald-500 h-4 w-4"
                                            />
                                            <span className="text-xs font-semibold text-gray-800">
                                                Flag as Due Immediately for 2026 Appraisal Docket (Fast-track legacy backlog)
                                            </span>
                                        </label>
                                    </div>
                                )}

                                {staff.staffProfile?.promotionEligibilityStatus && (
                                    <div className="text-[11px] text-gray-500 pt-1 flex items-center gap-2">
                                        <span>Current Staging Status:</span>
                                        <span className="font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                            {staff.staffProfile.promotionEligibilityStatus}
                                        </span>
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

function LeaveCountdownTimer({ endDate, startDate, type }: { endDate: string; startDate?: string; type?: string }) {
    const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; isResumed: boolean }>({
        days: 0, hours: 0, minutes: 0, seconds: 0, isResumed: false
    });

    useEffect(() => {
        const calculateTime = () => {
            const end = new Date(endDate).getTime();
            const now = new Date().getTime();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isResumed: true });
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft({ days, hours, minutes, seconds, isResumed: false });
        };

        calculateTime();
        const interval = setInterval(calculateTime, 1000);
        return () => clearInterval(interval);
    }, [endDate]);

    if (timeLeft.isResumed) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 flex items-center justify-between text-xs font-bold shadow-sm">
                <span>✅ Active Leave Concluded — Staff Member Has Resumed Duty</span>
                <span className="text-[10px] bg-emerald-700 text-white px-2.5 py-0.5 rounded-full uppercase">Resumed</span>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: '#006533', color: '#ffffff' }} className="rounded-2xl p-5 text-white shadow-xl border border-emerald-700 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
                <span className="p-3 bg-white/20 rounded-2xl"><Calendar size={24} className="animate-pulse" /></span>
                <div>
                    <span className="bg-emerald-800 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-600 inline-block mb-1">
                        🌴 {type ? type.replace(/_/g, ' ') : 'APPROVED LEAVE'} IN PROGRESS
                    </span>
                    <h3 className="text-base font-black tracking-tight">Active Resumption Countdown</h3>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="bg-emerald-950/80 px-3.5 py-2 rounded-xl border border-emerald-600 text-center min-w-[60px]">
                    <span className="text-xl font-black block leading-tight">{timeLeft.days}</span>
                    <span className="text-[9px] uppercase font-bold text-emerald-200">Days</span>
                </div>
                <span className="text-xl font-bold text-emerald-300">:</span>
                <div className="bg-emerald-950/80 px-3.5 py-2 rounded-xl border border-emerald-600 text-center min-w-[60px]">
                    <span className="text-xl font-black block leading-tight">{String(timeLeft.hours).padStart(2, '0')}</span>
                    <span className="text-[9px] uppercase font-bold text-emerald-200">Hours</span>
                </div>
                <span className="text-xl font-bold text-emerald-300">:</span>
                <div className="bg-emerald-950/80 px-3.5 py-2 rounded-xl border border-emerald-600 text-center min-w-[60px]">
                    <span className="text-xl font-black block leading-tight">{String(timeLeft.minutes).padStart(2, '0')}</span>
                    <span className="text-[9px] uppercase font-bold text-emerald-200">Mins</span>
                </div>
                <span className="text-xl font-bold text-emerald-300">:</span>
                <div className="bg-emerald-950/80 px-3.5 py-2 rounded-xl border border-emerald-600 text-center min-w-[60px]">
                    <span className="text-xl font-black block leading-tight">{String(timeLeft.seconds).padStart(2, '0')}</span>
                    <span className="text-[9px] uppercase font-bold text-emerald-200">Secs</span>
                </div>
            </div>
        </div>
    );
}
