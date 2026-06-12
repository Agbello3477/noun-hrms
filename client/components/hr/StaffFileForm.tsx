
import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { NIGERIAN_STATES_AND_LGAS } from '../../lib/nigeria-states-lgas';

interface OrganizationData {
    centers: { id: string; name: string; code: string }[];
    units: { id: string; name: string; type: string; code: string }[];
}

interface StaffFileFormProps {
    mode: 'CREATE' | 'EXISTING';
    onSuccess: (data: any) => void;
    onCancel: () => void;
}

export default function StaffFileForm({ mode, onSuccess, onCancel }: StaffFileFormProps) {
    const [formData, setFormData] = useState({
        // Identity
        manualStaffId: '', // For EXISTING mode
        title: '',
        surname: '',
        otherNames: '',
        email: '',
        phone: '',
        gender: 'Male',

        // Auth
        password: '123456789', // Default for admin creation

        // Location
        address: '',
        stateOfOrigin: '',
        lga: '',

        // Career / Role
        role: 'STAFF',
        cadre: '',
        level: '',
        step: '',

        // Organization
        centerId: '',
        unitId: '',

        // Academic
        programmeId: '',
    });

    const [orgData, setOrgData] = useState<OrganizationData>({ centers: [], units: [] });
    const [programmes, setProgrammes] = useState<any[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isHQ, setIsHQ] = useState(false);

    useEffect(() => {
        const fetchOrgData = async () => {
            // Fetch structure
            try {
                const [orgRes, progRes] = await Promise.all([
                    api.get('/api/org/structure'),
                    api.get('/api/org/programmes')
                ]);
                setOrgData(orgRes.data);
                setProgrammes(progRes.data);
            } catch (e) {
                console.error('Failed to load org data', e);
            }
        };
        fetchOrgData();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'stateOfOrigin') {
            setFormData(prev => ({ ...prev, stateOfOrigin: value, lga: '' }));
        }

        if (name === 'centerId') {
            const selectedCenter = orgData.centers.find(c => c.id === value);
            const isHQSelected = selectedCenter?.code === 'HQ-001';
            setIsHQ(isHQSelected);
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
            let submittedPhone = formData.phone;
            if (submittedPhone) {
                const cleaned = submittedPhone.replace(/\D/g, '');
                const withoutZero = cleaned.startsWith('0') ? cleaned.slice(1) : cleaned;
                submittedPhone = `+234${withoutZero}`;
            }

            const payload = {
                ...formData,
                phone: submittedPhone || undefined,
                name: `${formData.surname} ${formData.otherNames}`,
                unitId: formData.unitId || undefined,
            };

            const endpoint = mode === 'CREATE'
                ? '/api/registry/files/create'
                : '/api/registry/files/existing';

            const { data } = await api.post(endpoint, payload);
            onSuccess(data);
        } catch (err: any) {
            console.error('Submission Error:', err);
            setError(err.response?.data?.message || 'Failed to submit staff file');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
            {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}

            {/* 1. Identity */}
            <div className="bg-gray-50 p-4 rounded border">
                <h4 className="font-semibold text-gray-700 mb-2">Personal Information</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500">Title</label>
                        <select name="title" className="w-full border p-1.5 rounded" value={formData.title} onChange={handleChange}>
                            <option value="">Select</option>
                            <option value="Mr">Mr</option>
                            <option value="Mrs">Mrs</option>
                            <option value="Dr">Dr</option>
                            <option value="Prof">Prof</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500">Gender</label>
                        <select name="gender" className="w-full border p-1.5 rounded" value={formData.gender} onChange={handleChange}>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500">Surname</label>
                        <input name="surname" required className="w-full border p-1.5 rounded" value={formData.surname} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500">Other Names</label>
                        <input name="otherNames" required className="w-full border p-1.5 rounded" value={formData.otherNames} onChange={handleChange} />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500">Email (Official/Personal)</label>
                        <input type="email" name="email" required className="w-full border p-1.5 rounded" value={formData.email} onChange={handleChange} />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500">Phone</label>
                        <div className="flex rounded border mt-0.5 overflow-hidden">
                            <span className="bg-gray-100 text-gray-500 text-sm px-3 flex items-center border-r select-none">+234</span>
                            <input
                                name="phone"
                                type="tel"
                                maxLength={11}
                                placeholder="e.g. 08031234567"
                                className="w-full p-1.5 focus:outline-none"
                                value={formData.phone}
                                onChange={handlePhoneChange}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500">State of Origin</label>
                        <select
                            name="stateOfOrigin"
                            className="w-full border p-1.5 rounded mt-0.5"
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
                        <label className="block text-xs font-medium text-gray-500">LGA</label>
                        <select
                            name="lga"
                            className="w-full border p-1.5 rounded mt-0.5"
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
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500">Residential Address</label>
                        <input name="address" className="w-full border p-1.5 rounded" value={formData.address} onChange={handleChange} />
                    </div>
                </div>
            </div>

            {/* 2. Designation */}
            <div className="bg-gray-50 p-4 rounded border">
                <h4 className="font-semibold text-gray-700 mb-2">Designation & ID</h4>
                {mode === 'EXISTING' ? (
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-500">Manual Staff ID (Optional - Legacy)</label>
                        <input
                            name="manualStaffId"
                            className="w-full border p-1.5 rounded bg-yellow-50"
                            placeholder="Leave blank to auto-generate"
                            value={formData.manualStaffId}
                            onChange={handleChange}
                        />
                        <p className="text-[10px] text-gray-500 mt-1">Only use this if migrating a file with a strict existing ID.</p>
                    </div>
                ) : (
                    <div className="mb-4 p-2 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">
                        Staff ID will be auto-generated (e.g. NOUN/01000)
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500">System Role</label>
                        <select name="role" required className="w-full border p-1.5 rounded" value={formData.role} onChange={handleChange}>
                            <option value="STAFF">Regular Staff</option>
                            <option value="UNIT_HEAD">Dean / Unit Head / Director</option>
                            <option value="STUDY_CENTER_MANAGER">Center Manager</option>
                            <option value="HR_ADMIN">HR Admin</option>
                            <option value="BURSARY">Bursary</option>
                            <option value="AUDIT">Audit</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500">Cadre</label>
                        <select name="cadre" required className="w-full border p-1.5 rounded" value={formData.cadre} onChange={handleChange}>
                            <option value="">Select Cadre</option>
                            <option value="ACADEMIC">Academic</option>
                            <option value="NON_ACADEMIC">Non-Academic</option>
                            <option value="SENIOR">Senior</option>
                            <option value="JUNIOR">Junior</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500">Level (e.g. 8)</label>
                        <input name="level" className="w-full border p-1.5 rounded" value={formData.level} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500">Step (e.g. 2)</label>
                        <input name="step" className="w-full border p-1.5 rounded" value={formData.step} onChange={handleChange} />
                    </div>
                </div>
            </div>

            {/* 3. Placement */}
            <div className="bg-gray-50 p-4 rounded border">
                <h4 className="font-semibold text-gray-700 mb-2">Placement (Unit/Faculty/Centre)</h4>
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500">Study Center / HQ</label>
                        <select name="centerId" required className="w-full border p-1.5 rounded" value={formData.centerId} onChange={handleChange}>
                            <option value="">Select Center</option>
                            {orgData.centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {isHQ && (
                        <div>
                            <label className="block text-xs font-medium text-gray-500">Directorate / Faculty / Department</label>
                            <select name="unitId" required className="w-full border p-1.5 rounded" value={formData.unitId} onChange={handleChange}>
                                <option value="">Select Unit</option>
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
                                <optgroup label="Departments">
                                    {orgData.units.filter(u => u.type === 'DEPARTMENT').map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    )}

                    {formData.cadre === 'ACADEMIC' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-500">Academic Programme</label>
                            <select name="programmeId" className="w-full border p-1.5 rounded" value={formData.programmeId} onChange={handleChange}>
                                <option value="">Select Programme</option>
                                {programmes.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex gap-3 pt-4">
                <button type="button" onClick={onCancel} className="flex-1 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50">
                    {loading ? 'Processing...' : (mode === 'CREATE' ? 'Create File & Generate ID' : 'Save Existing File')}
                </button>
            </div>
        </form>
    );
}
