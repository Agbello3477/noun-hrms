import { useState, useEffect, useMemo } from 'react';
import { X, Calendar, TrendingUp, AlertCircle, Info, Shield, GraduationCap } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { NIGERIAN_STATES_AND_LGAS } from '../../lib/nigeria-states-lgas';
import { STANDARD_QUALIFICATIONS } from '../../lib/qualifications';
import Button from '../ui/Button';

interface AddStaffModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

interface OrganizationData {
    centers: { id: string; name: string; code: string }[];
    units: { id: string; name: string; type: string; code: string }[];
}

export default function AddStaffModal({ onClose, onSuccess }: AddStaffModalProps) {
    const { user: currentUser } = useAuth();
    const isHrAdmin = ['HR_ADMIN', 'SUPER_USER', 'ADMIN'].includes(currentUser?.role || '');

    const [formData, setFormData] = useState({
        // Identity
        staffId: '',
        surname: '',
        otherNames: '',
        email: '',
        phone: '',
        gender: 'Male', // Default

        // Location
        address: '',
        stateOfOrigin: '',
        lga: '',

        // Career / Role
        role: 'STAFF',
        cadre: 'ADMINISTRATIVE', // Default
        cadreType: 'SENIOR_ADMIN',
        highestQualification: '',
        customQualification: '',
        level: '',
        step: '',
        dateOfFirstAppointment: '',

        // Promotion Maturity & Scheduling
        lastPromotionDate: '',
        cadreAppraisalRule: 'SENIOR_ADMIN_3',
        nextPromotionDueYear: '',
        nextPromotionDueDate: '',
        isDueImmediately: false,
        overrideReason: '',
        isYearOverridden: false,

        // Organization
        centerId: '',
        unitId: '', // For HQ Units

        // Phase 9: Academic Specific
        programmeId: '',
        assignedFacilitatorId: '', // For Academic Staff
        courseCode: '',
        courseTitle: '',
        creditUnit: '1'
    });

    const [orgData, setOrgData] = useState<OrganizationData>({ centers: [], units: [] });
    const [programmes, setProgrammes] = useState<any[]>([]);
    const [facilitators, setFacilitators] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isHQ, setIsHQ] = useState(false);

    useEffect(() => {
        const fetchOrgData = async () => {
            try {
                const [orgRes, progRes, facRes] = await Promise.all([
                    api.get('/api/org/structure'),
                    api.get('/api/org/programmes'),
                    api.get('/api/staff/academic')
                ]);

                setOrgData(orgRes.data);
                setProgrammes(progRes.data);
                setFacilitators(facRes.data);
            } catch (err) {
                console.error('Failed to fetch org structure', err);
                try {
                    const { data } = await api.get('/api/org/structure');
                    setOrgData(data);
                } catch (e) {
                    setError('Failed to load organizational data');
                }
            }
        };
        fetchOrgData();
    }, []);

    // Lock parameters for Study Center Managers and Unit Heads
    useEffect(() => {
        if (currentUser && !isHrAdmin) {
            setFormData(prev => ({
                ...prev,
                centerId: currentUser.staffProfile?.centerId || '',
                unitId: currentUser.staffProfile?.unitId || '',
                role: 'STAFF'
            }));
            if (currentUser.staffProfile?.unitId) {
                setIsHQ(true);
            }
        }
    }, [currentUser, isHrAdmin]);

    // Live Statutory Calculation for Promotion Maturity
    const computedPromotionSchedule = useMemo(() => {
        const baseDateStr = formData.lastPromotionDate || formData.dateOfFirstAppointment;
        const baseYear = baseDateStr ? new Date(baseDateStr).getFullYear() : new Date().getFullYear();
        const validBaseYear = isNaN(baseYear) ? new Date().getFullYear() : baseYear;

        let interval = 3;
        let monthDay = '01-01'; // Default January 1st
        let ruleDescription = 'Senior Administrative / Standard (3-Year Cycle, Jan 1)';

        const rule = formData.cadreAppraisalRule;
        if (rule === 'ACADEMIC_3' || formData.cadre === 'ACADEMIC' || formData.cadreType === 'ACADEMIC') {
            interval = 3;
            monthDay = '10-01'; // October 1st
            ruleDescription = 'Academic Cadre: 3-Year Statutory Waiting Period (October 1st Review Cycle)';
        } else if (rule === 'SENIOR_ADMIN_4') {
            interval = 4;
            monthDay = '01-01';
            ruleDescription = 'Senior Administrative (CONTISS 12+): 4-Year Statutory Period for Principal/Directorate Grades (Jan 1)';
        } else if (rule === 'JUNIOR_2') {
            interval = 2;
            monthDay = '01-01';
            ruleDescription = 'Junior Staff Cadre: Fast-Track 2-Year Waiting Period (Jan 1)';
        } else if (rule === 'JUNIOR_3') {
            interval = 3;
            monthDay = '01-01';
            ruleDescription = 'Junior Staff Cadre: Standard 3-Year Waiting Period (Jan 1)';
        } else if (rule === 'CUSTOM') {
            interval = 3;
            monthDay = '01-01';
            ruleDescription = 'Custom Institutional Review Schedule';
        } else {
            // Default 3 year
            interval = 3;
            monthDay = '01-01';
            ruleDescription = 'Standard Institutional 3-Year Review Cycle (Jan 1)';
        }

        const calculatedYear = validBaseYear + interval;
        const calculatedDate = `${calculatedYear}-${monthDay}`;

        return {
            calculatedYear,
            calculatedDate,
            interval,
            ruleDescription
        };
    }, [formData.lastPromotionDate, formData.dateOfFirstAppointment, formData.cadreAppraisalRule, formData.cadre, formData.cadreType]);

    // Synchronize auto-calculated promotion year & target date when inputs change unless manually overridden
    useEffect(() => {
        if (!formData.isYearOverridden) {
            setFormData(prev => ({
                ...prev,
                nextPromotionDueYear: String(computedPromotionSchedule.calculatedYear),
                nextPromotionDueDate: computedPromotionSchedule.calculatedDate
            }));
        }
    }, [computedPromotionSchedule, formData.isYearOverridden]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

        setFormData(prev => {
            const next = { ...prev, [name]: val };

            if (name === 'stateOfOrigin') {
                next.lga = '';
            }

            if (name === 'cadre') {
                if (value === 'ACADEMIC') {
                    next.cadreType = 'ACADEMIC';
                    next.cadreAppraisalRule = 'ACADEMIC_3';
                } else if (value === 'JUNIOR') {
                    next.cadreType = 'JUNIOR_STAFF';
                    next.cadreAppraisalRule = 'JUNIOR_3';
                } else if (value === 'TECHNICAL') {
                    next.cadreType = 'TECHNICAL';
                    next.cadreAppraisalRule = 'SENIOR_ADMIN_3';
                } else if (value === 'MEDICAL') {
                    next.cadreType = 'MEDICAL';
                    next.cadreAppraisalRule = 'SENIOR_ADMIN_3';
                } else if (value === 'SECURITY') {
                    next.cadreType = 'SECURITY';
                    next.cadreAppraisalRule = 'SENIOR_ADMIN_3';
                } else {
                    next.cadreType = 'SENIOR_ADMIN';
                    next.cadreAppraisalRule = 'SENIOR_ADMIN_3';
                }
            }

            return next;
        });

        // Check for HQ Selection to trigger conditional logic
        if (name === 'centerId') {
            const selectedCenter = orgData.centers.find(c => c.id === value);
            const isHQSelected = selectedCenter?.code === 'HQ-001';
            setIsHQ(isHQSelected);

            // Reset unitId if not HQ
            if (!isHQSelected) {
                setFormData(prev => ({ ...prev, unitId: '' }));
            }
        }
    };

    const handleNextYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const isOverridden = Number(val) !== computedPromotionSchedule.calculatedYear;
        setFormData(prev => ({
            ...prev,
            nextPromotionDueYear: val,
            isYearOverridden: isOverridden
        }));
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        const digits = value.replace(/\D/g, '');
        const limitedDigits = digits.slice(0, 11);
        setFormData(prev => ({ ...prev, phone: limitedDigits }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.isYearOverridden && (!formData.overrideReason || formData.overrideReason.trim().length < 5)) {
            setError('A valid administrative override justification (minimum 5 characters) is required when modifying the calculated promotion year.');
            return;
        }

        setLoading(true);

        try {
            let dbRole = formData.role;
            let assignedRank = formData.cadre === 'ACADEMIC' ? 'Academic Staff' : 'Staff';

            if (formData.role === 'DIRECTOR') {
                dbRole = 'UNIT_HEAD';
                assignedRank = 'Director';
            } else if (formData.role === 'DEAN') {
                dbRole = 'UNIT_HEAD';
                assignedRank = 'Dean';
            } else if (formData.role === 'UNIT_HEAD') {
                dbRole = 'UNIT_HEAD';
                assignedRank = 'Head of Unit';
            } else if (formData.role === 'HEAD_OF_ADMIN') {
                dbRole = 'UNIT_ADMIN';
                assignedRank = 'Head of Admin';
            } else if (formData.role === 'CLINIC_HEAD') {
                assignedRank = 'Head of Clinic';
            } else if (formData.role === 'CLINIC_DOCTOR') {
                assignedRank = 'Medical Doctor';
            } else if (formData.role === 'CLINIC_NURSE') {
                assignedRank = 'Nurse';
            } else if (formData.role === 'CLINIC_LAB_SCIENTIST') {
                assignedRank = 'Lab Scientist';
            } else if (formData.role === 'SECURITY_HEAD') {
                assignedRank = 'Head of Security';
            } else if (formData.role === 'SECURITY_OFFICER') {
                assignedRank = 'Security Officer';
            } else if (formData.role === 'DRIVER') {
                assignedRank = 'Driver';
            }

            let submittedPhone = formData.phone;
            if (submittedPhone) {
                const cleaned = submittedPhone.replace(/\D/g, '');
                const withoutZero = cleaned.startsWith('0') ? cleaned.slice(1) : cleaned;
                submittedPhone = `+234${withoutZero}`;
            }

            const effectiveQualification = formData.highestQualification === 'CUSTOM'
                ? formData.customQualification.trim()
                : formData.highestQualification;

            const payload = {
                ...formData,
                highestQualification: effectiveQualification || undefined,
                phone: submittedPhone,
                role: dbRole,
                rank: assignedRank,
                unitId: formData.unitId || undefined,

                // Promotion Fields
                lastPromotionDate: formData.lastPromotionDate || formData.dateOfFirstAppointment || undefined,
                dateOfFirstAppointment: formData.dateOfFirstAppointment || undefined,
                cadreType: formData.cadreType,
                currentGradeLevel: formData.level ? `CONTISS ${formData.level}` : undefined,
                nextPromotionDueYear: formData.nextPromotionDueYear ? parseInt(formData.nextPromotionDueYear, 10) : computedPromotionSchedule.calculatedYear,
                nextPromotionDueDate: formData.nextPromotionDueDate || computedPromotionSchedule.calculatedDate,
                isDueImmediately: formData.isDueImmediately,
                registryOverride: formData.isYearOverridden,
                overrideReason: formData.isYearOverridden ? formData.overrideReason : undefined,

                // Phase 9 Logic: Facilitator Info
                facilitatorInfo: formData.cadre === 'ACADEMIC' ? {
                    assignedFacilitatorId: formData.assignedFacilitatorId,
                    courses: [{
                        code: formData.courseCode,
                        title: formData.courseTitle,
                        unit: formData.creditUnit
                    }]
                } : undefined
            };

            await api.post('/api/staff', payload);
            onSuccess();
            onClose();

        } catch (err: any) {
            console.error('Add Staff Error:', err);
            setError(err.response?.data?.message || err.message || 'Failed to create staff');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 flex items-center justify-between border-b flex-shrink-0 bg-slate-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Add New Staff Member</h3>
                        <p className="text-xs text-gray-500">Create new staff file with complete bio-data & career promotion milestones</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {error && (
                    <div className="mx-6 mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2">
                        <AlertCircle size={18} className="flex-shrink-0 text-red-600" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Section 1: Identity */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Personal Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Staff ID (IPPIS/File No)</label>
                                <input type="text" name="staffId" required className="mt-1 w-full border rounded p-2"
                                    value={formData.staffId} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Surname</label>
                                <input type="text" name="surname" required className="mt-1 w-full border rounded p-2"
                                    value={formData.surname} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Other Names</label>
                                <input type="text" name="otherNames" required className="mt-1 w-full border rounded p-2"
                                    value={formData.otherNames} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Email Address</label>
                                <input type="email" name="email" required className="mt-1 w-full border rounded p-2"
                                    value={formData.email} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Phone Number</label>
                                <div className="flex rounded border mt-1 overflow-hidden">
                                    <span className="bg-gray-100 text-gray-500 text-sm px-3 flex items-center border-r select-none">+234</span>
                                    <input
                                        type="tel"
                                        name="phone"
                                        required
                                        maxLength={11}
                                        placeholder="e.g. 08031234567"
                                        className="w-full p-2 focus:outline-none"
                                        value={formData.phone}
                                        onChange={handlePhoneChange}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">State of Origin</label>
                                <select
                                    name="stateOfOrigin"
                                    required
                                    className="mt-1 w-full border rounded p-2"
                                    value={formData.stateOfOrigin}
                                    onChange={handleChange}
                                >
                                    <option value="">Select State</option>
                                    {Object.keys(NIGERIAN_STATES_AND_LGAS).map(state => (
                                        <option key={state} value={state}>{state}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">LGA</label>
                                <select
                                    name="lga"
                                    required
                                    className="mt-1 w-full border rounded p-2"
                                    value={formData.lga}
                                    onChange={handleChange}
                                    disabled={!formData.stateOfOrigin}
                                >
                                    <option value="">Select LGA</option>
                                    {(NIGERIAN_STATES_AND_LGAS[formData.stateOfOrigin] || []).map((lga: string) => (
                                        <option key={lga} value={lga}>{lga}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Gender</label>
                                <select name="gender" className="mt-1 w-full border rounded p-2" value={formData.gender} onChange={handleChange}>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700">Residential Address</label>
                            <input type="text" name="address" className="mt-1 w-full border rounded p-2"
                                value={formData.address} onChange={handleChange} />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 flex items-center gap-1.5 mb-1">
                                <GraduationCap size={15} className="text-nounGreen" />
                                Highest Qualification
                            </label>
                            <select
                                name="highestQualification"
                                className="w-full border rounded p-2 text-xs bg-white text-gray-900"
                                value={formData.highestQualification}
                                onChange={handleChange}
                            >
                                <option value="">Select Highest Qualification</option>
                                {STANDARD_QUALIFICATIONS.map(q => (
                                    <option key={q} value={q}>{q}</option>
                                ))}
                                <option value="CUSTOM">Other / Specific Degree Title</option>
                            </select>
                            {formData.highestQualification === 'CUSTOM' && (
                                <input
                                    type="text"
                                    name="customQualification"
                                    placeholder="Enter specific qualification (e.g. Ph.D. in Cyber Security, LL.M, etc.)"
                                    className="w-full border rounded p-2 mt-2 text-xs bg-white text-gray-900"
                                    value={formData.customQualification}
                                    onChange={handleChange}
                                />
                            )}
                        </div>
                    </div>

                    <hr />

                    {/* Section 2: Organization & Career */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Official Service Record & Placement</h4>

                        {!isHrAdmin ? (
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm">
                                <span className="font-semibold text-gray-705 text-xs uppercase tracking-wider block mb-1">Assigned Location</span>
                                <span className="text-gray-805 font-medium">
                                    {currentUser?.role === 'STUDY_CENTER_MANAGER'
                                        ? currentUser?.staffProfile?.studyCenter?.name || 'My Study Center'
                                        : currentUser?.staffProfile?.unit?.name || 'My Unit'
                                    }
                                </span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-705">Study Center / HQ</label>
                                    <select
                                        name="centerId"
                                        required
                                        className="mt-1 block w-full rounded-md border border-gray-300 p-2"
                                        value={formData.centerId}
                                        onChange={handleChange}
                                    >
                                        <option value="">-- Select Center --</option>
                                        {orgData.centers.map(center => (
                                            <option key={center.id} value={center.id}>
                                                {center.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {isHQ && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-705">Directorate / Faculty (HQ)</label>
                                        <select
                                            name="unitId"
                                            required
                                            className="mt-1 block w-full rounded-md border border-blue-300 bg-blue-50 p-2"
                                            value={formData.unitId}
                                            onChange={handleChange}
                                        >
                                            <option value="">-- Select Unit --</option>
                                            <optgroup label="Faculties">
                                                {orgData.units.filter(u => u.type === 'FACULTY').map(unit => (
                                                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Directorates & Departments">
                                                {orgData.units.filter(u => u.type === 'DIRECTORATE' || u.type === 'DEPARTMENT').map(unit => (
                                                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Cadre</label>
                                <select
                                    name="cadre"
                                    required
                                    className="mt-1 w-full border rounded p-2"
                                    value={formData.cadre}
                                    onChange={handleChange}
                                >
                                    <option value="ACADEMIC">Academic Staff</option>
                                    <option value="ADMINISTRATIVE">Administrative Staff</option>
                                    <option value="SENIOR">Senior Staff</option>
                                    <option value="JUNIOR">Junior Staff</option>
                                    <option value="TECHNICAL">Technical</option>
                                    <option value="MEDICAL">Medical</option>
                                    <option value="SECURITY">Security</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Level (CONTISS/CONUASS)</label>
                                <input type="number" name="level" required placeholder="e.g. 7" className="mt-1 w-full border rounded p-2"
                                    value={formData.level} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Step</label>
                                <input type="number" name="step" required placeholder="e.g. 2" className="mt-1 w-full border rounded p-2"
                                    value={formData.step} onChange={handleChange} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700">Date of First Appointment</label>
                            <input
                                type="date"
                                name="dateOfFirstAppointment"
                                className="mt-1 w-full border rounded p-2 text-black"
                                value={formData.dateOfFirstAppointment}
                                onChange={handleChange}
                            />
                        </div>

                        {isHrAdmin ? (
                            <div>
                                <label className="block text-xs font-medium text-gray-705">System Role</label>
                                <select
                                    name="role"
                                    className="mt-1 w-full border rounded p-2"
                                    value={formData.role}
                                    onChange={handleChange}
                                >
                                    <option value="STAFF">Regular Staff</option>
                                    <option value="SUPER_USER">Super User / System Admin</option>
                                    <option value="DIRECTOR">Director (HQ/Directorate)</option>
                                    <option value="DEAN">Dean (Faculty)</option>
                                    <option value="UNIT_HEAD">Head of Unit / HOD</option>
                                    <option value="HEAD_OF_ADMIN">Head of Admin</option>
                                    <option value="STUDY_CENTER_MANAGER">Study Center Manager</option>
                                    <option value="HR_ADMIN">HR Admin</option>
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
                            </div>
                        ) : (
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm">
                                <span className="font-semibold text-gray-700 text-xs uppercase tracking-wider block mb-1">System Role Scope</span>
                                <span className="text-gray-800 font-medium">Regular Staff (Locked)</span>
                            </div>
                        )}
                    </div>

                    <hr />

                    {/* Section 3: Promotion Maturity & Scheduling Subsection */}
                    <div className="space-y-4 bg-emerald-50/50 p-5 rounded-xl border border-emerald-200">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="text-emerald-700" size={18} />
                            <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">
                                Promotion Maturity & Scheduling
                            </h4>
                        </div>
                        <p className="text-xs text-emerald-700">
                            Establish statutory maturity dates and legacy promotion milestones for automated tracking and appraisal staging.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700">
                                    Last Promotion / Substantive Appointment Date
                                </label>
                                <input
                                    type="date"
                                    name="lastPromotionDate"
                                    className="mt-1 w-full border border-emerald-300 rounded-lg p-2 text-black bg-white focus:ring-2 focus:ring-emerald-500"
                                    value={formData.lastPromotionDate}
                                    onChange={handleChange}
                                />
                                <span className="text-[10px] text-gray-500 block mt-1">Defaults to first appointment date if blank.</span>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700">
                                    Cadre & Appraisal Rule
                                </label>
                                <select
                                    name="cadreAppraisalRule"
                                    className="mt-1 w-full border border-emerald-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                                    value={formData.cadreAppraisalRule}
                                    onChange={handleChange}
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

                        {/* Real-time Dynamic Calculation Preview */}
                        <div className="bg-white p-3.5 rounded-lg border border-emerald-200 text-xs text-emerald-900 space-y-2">
                            <div className="flex items-center gap-1.5 font-semibold">
                                <Info size={14} className="text-emerald-600" />
                                <span>Statutory Rule Applied:</span>
                            </div>
                            <p className="text-emerald-800 text-[11px] font-medium bg-emerald-50 p-2 rounded border border-emerald-150">
                                {computedPromotionSchedule.ruleDescription}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-700">Calculated Next Promotion Year</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <input
                                            type="number"
                                            name="nextPromotionDueYear"
                                            value={formData.nextPromotionDueYear}
                                            onChange={handleNextYearChange}
                                            className="w-full border rounded-lg p-2 font-mono font-bold text-sm bg-white"
                                            placeholder={String(computedPromotionSchedule.calculatedYear)}
                                        />
                                        {formData.isYearOverridden && (
                                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded whitespace-nowrap">
                                                Overridden
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-gray-700">Target Effective Date</label>
                                    <input
                                        type="date"
                                        name="nextPromotionDueDate"
                                        value={formData.nextPromotionDueDate}
                                        onChange={handleChange}
                                        className="w-full border rounded-lg p-2 font-mono text-sm bg-white mt-1"
                                    />
                                </div>
                            </div>

                            {/* Override Justification Note */}
                            {formData.isYearOverridden && (
                                <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1 animate-in fade-in duration-200">
                                    <label className="block text-[11px] font-bold text-amber-900">
                                        Override Justification (Mandatory) *
                                    </label>
                                    <input
                                        type="text"
                                        name="overrideReason"
                                        required={formData.isYearOverridden}
                                        placeholder="State official reason for non-standard promotion year (e.g. Approved Accelerated Promotion)"
                                        value={formData.overrideReason}
                                        onChange={handleChange}
                                        className="w-full border border-amber-300 rounded p-2 text-xs bg-white"
                                    />
                                </div>
                            )}

                            {/* Immediate Review Docket Inclusion Checkbox */}
                            <div className="pt-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        name="isDueImmediately"
                                        checked={formData.isDueImmediately}
                                        onChange={handleChange}
                                        className="rounded border-emerald-300 text-emerald-700 focus:ring-emerald-500 h-4 w-4"
                                    />
                                    <span className="text-xs font-semibold text-gray-800">
                                        Flag as Due Immediately for 2026 Appraisal Docket (Fast-track legacy backlog)
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Academic Specifics */}
                    {formData.cadre === 'ACADEMIC' && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <h4 className="font-semibold text-blue-800 mb-2 border-b border-blue-200 pb-1">Academic & Facilitation Records</h4>

                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-700">Academic Programme *</label>
                                <select
                                    name="programmeId"
                                    required
                                    className="mt-1 w-full border rounded p-2"
                                    value={formData.programmeId}
                                    onChange={handleChange}
                                >
                                    <option value="">-- Select Programme --</option>
                                    {programmes.map(prog => (
                                        <option key={prog.id} value={prog.id}>{prog.title}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">Assigned Facilitator</label>
                                    <select
                                        name="assignedFacilitatorId"
                                        className="mt-1 w-full border rounded p-2"
                                        value={formData.assignedFacilitatorId}
                                        onChange={handleChange}
                                    >
                                        <option value="">-- Select Logic  --</option>
                                        {facilitators.map(staff => (
                                            <option key={staff.id} value={staff.id}>{staff.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700">Code</label>
                                        <input type="text" name="courseCode" className="w-full border rounded p-2" placeholder="CIT101"
                                            value={formData.courseCode} onChange={handleChange} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-700">Course Title</label>
                                        <input type="text" name="courseTitle" className="w-full border rounded p-2" placeholder="Comp Sci"
                                            value={formData.courseTitle} onChange={handleChange} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 sticky bottom-0 bg-white border-t -mx-6 -mb-6 p-6 flex-shrink-0 flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="emerald"
                            isLoading={loading}
                            loadingText="Creating Staff Member..."
                        >
                            Create Staff Member
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

