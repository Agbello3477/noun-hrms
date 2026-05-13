'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../../lib/api';

interface AddStaffModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

interface OrganizationData {
    centers: { id: string; name: string; code: string }[];
    units: { id: string; name: string; type: string; code: string }[];
}

export default function AddStaffModal({ onClose, onSuccess }: AddStaffModalProps) {
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const payload = {
                ...formData,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto">
            <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl my-8">
                <div className="mb-4 flex items-center justify-between border-b pb-2">
                    <h3 className="text-xl font-bold text-gray-900">Add New Staff Member</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">

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
                                <input type="tel" name="phone" required className="mt-1 w-full border rounded p-2"
                                    value={formData.phone} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">State of Origin</label>
                                <input type="text" name="stateOfOrigin" className="mt-1 w-full border rounded p-2"
                                    value={formData.stateOfOrigin} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">LGA</label>
                                <input type="text" name="lga" className="mt-1 w-full border rounded p-2"
                                    value={formData.lga} onChange={handleChange} />
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Study Center / HQ</label>
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
                                    <label className="block text-xs font-medium text-gray-700">Directorate / Faculty (HQ)</label>
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
                                        <optgroup label="Directorates & Units">
                                            {orgData.units.filter(u => u.type === 'DIRECTORATE').map(unit => (
                                                <option key={unit.id} value={unit.id}>{unit.name}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                </div>
                            )}
                        </div>

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
                            <label className="block text-xs font-medium text-gray-700">System Role</label>
                            <select
                                name="role"
                                className="mt-1 w-full border rounded p-2"
                                value={formData.role}
                                onChange={handleChange}
                            >
                                <option value="STAFF">Regular Staff</option>
                                <option value="STUDY_CENTER_MANAGER">Study Center Manager</option>
                                <option value="UNIT_HEAD">Unit Head / Director</option>
                                <option value="HR_ADMIN">HR Admin</option>
                                <option value="BURSARY">Bursary</option>
                                <option value="AUDIT">Audit</option>
                            </select>
                        </div>
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

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-md bg-blue-900 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Staff Member'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
