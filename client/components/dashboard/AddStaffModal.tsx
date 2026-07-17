'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { NIGERIAN_STATES_AND_LGAS } from '../../lib/nigeria-states-lgas';

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
        cadre: '', // ACADEMIC, SENIOR, etc.
        level: '',
        step: '',

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'stateOfOrigin') {
            setFormData(prev => ({ ...prev, stateOfOrigin: value, lga: '' }));
        }

        // Check for HQ Selection to trigger conditional logic
        if (name === 'centerId') {
            const selectedCenter = orgData.centers.find(c => c.id === value);
            // Check if code contains HQ or is the Abuja HQ
            const isHQSelected = selectedCenter?.code === 'HQ-001';
            setIsHQ(isHQSelected);

            // Reset unitId if not HQ
            if (!isHQSelected) {
                setFormData(prev => ({ ...prev, unitId: '' }));
            }
        }
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        // Keep only digits
        const digits = value.replace(/\D/g, '');
        // Limit to 11 characters
        const limitedDigits = digits.slice(0, 11);
        setFormData(prev => ({ ...prev, phone: limitedDigits }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

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

            const payload = {
                ...formData,
                phone: submittedPhone,
                role: dbRole,
                rank: assignedRank,
                // Ensure unitId is null if empty string
                unitId: formData.unitId || undefined,

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
                <div className="px-6 py-4 flex items-center justify-between border-b flex-shrink-0">
                    <h3 className="text-xl font-bold text-gray-900">Add New Staff Member</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {error && (
                    <div className="mx-6 mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                        {error}
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
                                    {(NIGERIAN_STATES_AND_LGAS[formData.stateOfOrigin] || []).map(lga => (
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
                    </div>

                    <hr />

                    {/* Section 2: Organization & Career */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Official Service Record</h4>

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
                                    <option value="">-- Select Cadre --</option>
                                    <option value="ACADEMIC">Academic Staff</option>
                                    <option value="NON_ACADEMIC">Non-Academic Staff</option>
                                    <option value="SENIOR">Senior Staff</option>
                                    <option value="JUNIOR">Junior Staff</option>
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
                                    <option value="CLINIC_DOCTOR">Doctor</option>
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

                    {/* Section 3: Academic Specifics */}
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

                    <div className="pt-4 sticky bottom-0 bg-white border-t -mx-6 -mb-6 p-6 flex-shrink-0">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-blue-900 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors shadow-md shadow-blue-900/10 hover:shadow-lg"
                        >
                            {loading ? 'Creating...' : 'Create Staff Member'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
