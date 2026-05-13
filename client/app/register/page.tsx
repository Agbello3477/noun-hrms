'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../lib/api';

interface OrganizationData {
    centers: { id: string; name: string; code: string }[];
    units: { id: string; name: string; type: string; code: string }[];
}

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        // Identity
        staffId: '',
        title: '',
        surname: '',
        otherNames: '',
        email: '',
        phone: '',
        gender: 'Male',

        // Auth
        password: '',
        confirmPassword: '',

        // Location
        address: '',
        stateOfOrigin: '',
        lga: '',

        // Career / Role
        // Default role is STAFF, but per request users can select their role.
        role: '',
        cadre: '',
        level: '',
        step: '',

        // Organization
        centerId: '',
        unitId: '',

        // Phase 9: Academic Specific
        programmeId: '',
        assignedFacilitatorId: '',
        courseCode: '',
        courseTitle: '',
        creditUnit: '1'
    });

    const [orgData, setOrgData] = useState<OrganizationData>({ centers: [], units: [] });
    const [programmes, setProgrammes] = useState<any[]>([]);
    const [facilitators, setFacilitators] = useState<any[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isHQ, setIsHQ] = useState(false);

    useEffect(() => {
        const fetchOrgData = async () => {
            try {
                // Fetch public structure data
                const [orgRes, progRes] = await Promise.all([
                    api.get('/api/org/structure'),
                    api.get('/api/org/programmes')
                ]);

                setOrgData(orgRes.data);
                setProgrammes(progRes.data);

                try {
                    // Attempt to fetch academic staff for facilitator dropdown if public, 
                    // otherwise it might fail without auth. If it fails, we just won't populate it.
                    const facRes = await api.get('/api/staff/academic');
                    setFacilitators(facRes.data);
                } catch (e) {
                    console.log('Fetching facilitators skipped/failed (likely requires auth)');
                }

            } catch (err) {
                console.error('Failed to fetch org structure', err);
                setError('Failed to load organizational data. Please check connection.');
            }
        };
        fetchOrgData();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'centerId') {
            const selectedCenter = orgData.centers.find(c => c.id === value);
            const isHQSelected = selectedCenter?.code === 'HQ-001';
            setIsHQ(isHQSelected);
            if (!isHQSelected) {
                setFormData(prev => ({ ...prev, unitId: '' }));
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        if (!formData.role) {
            setError('Please select a system role/designation');
            setLoading(false);
            return;
        }

        try {
            const payload = {
                ...formData,
                name: `${formData.surname} ${formData.otherNames}`, // Included for User model fallback
                unitId: formData.unitId || undefined,

                // Phase 9 Logic
                facilitatorInfo: formData.cadre === 'ACADEMIC' ? {
                    assignedFacilitatorId: formData.assignedFacilitatorId,
                    courses: [{
                        code: formData.courseCode,
                        title: formData.courseTitle,
                        unit: formData.creditUnit
                    }]
                } : undefined
            };

            await api.post('/api/auth/register', payload);
            setSuccess('Registration successful! Redirecting to login...');

            setTimeout(() => {
                router.push('/login');
            }, 2000);

        } catch (err: any) {
            console.error('Registration Error:', err);
            setError(err.response?.data?.message || err.message || 'Failed to register');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex justify-center">
            <div className="max-w-4xl w-full space-y-8 bg-white p-10 rounded-xl shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Create your NOUN HRMS Account
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Join the digital workforce platform
                    </p>
                </div>

                {error && <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm text-center">{error}</div>}
                {/* Custom Success Modal or large Alert */}
                {success && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">Registration Successful!</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Your account has been created successfully. Redirecting you to the login page...
                            </p>
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700 mx-auto"></div>
                        </div>
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>

                    {/* 1. Identity & Credentials */}
                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">1. Identity & Credentials</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Title</label>
                                <select name="title" className="mt-1 w-full border rounded p-2"
                                    value={formData.title} onChange={handleChange}>
                                    <option value="">Select Title</option>
                                    <option value="Mr">Mr</option>
                                    <option value="Mrs">Mrs</option>
                                    <option value="Ms">Ms</option>
                                    <option value="Dr">Dr</option>
                                    <option value="Prof">Prof</option>
                                    <option value="Engr">Engr</option>
                                    <option value="Arc">Arc</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Surname</label>
                                <input type="text" name="surname" required className="mt-1 w-full border rounded p-2"
                                    value={formData.surname} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Other Names</label>
                                <input type="text" name="otherNames" required className="mt-1 w-full border rounded p-2"
                                    value={formData.otherNames} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                                <input type="email" name="email" required className="mt-1 w-full border rounded p-2"
                                    value={formData.email} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                                <input type="tel" name="phone" required className="mt-1 w-full border rounded p-2"
                                    value={formData.phone} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Create Password</label>
                                <input type="password" name="password" required className="mt-1 w-full border rounded p-2"
                                    value={formData.password} onChange={handleChange} minLength={6} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                                <input type="password" name="confirmPassword" required className="mt-1 w-full border rounded p-2"
                                    value={formData.confirmPassword} onChange={handleChange} minLength={6} />
                            </div>
                        </div>
                    </div>

                    {/* 2. Official Designation */}
                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">2. Official Designation</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Staff ID (IPPIS/File No)</label>
                                <input type="text" name="staffId" required className="mt-1 w-full border rounded p-2"
                                    value={formData.staffId} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Role / Designation</label>
                                <select name="role" required className="mt-1 w-full border rounded p-2"
                                    value={formData.role} onChange={handleChange}>
                                    <option value="">-- Select Role --</option>
                                    <option value="STAFF">Regular Staff</option>
                                    <option value="STUDY_CENTER_MANAGER">Study Center Manager</option>
                                    <option value="UNIT_HEAD">Unit Head / Director</option>
                                    <option value="HR_ADMIN">HR Admin</option>
                                    <option value="BURSARY">Bursary</option>
                                    <option value="AUDIT">Audit</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Cadre</label>
                                <select name="cadre" required className="mt-1 w-full border rounded p-2"
                                    value={formData.cadre} onChange={handleChange}>
                                    <option value="">-- Select Cadre --</option>
                                    <option value="ACADEMIC">Academic Staff</option>
                                    <option value="NON_ACADEMIC">Non-Academic Staff</option>
                                    <option value="SENIOR">Senior Staff</option>
                                    <option value="JUNIOR">Junior Staff</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Grade Level</label>
                                <input type="number" name="level" required className="mt-1 w-full border rounded p-2" placeholder="e.g. 8"
                                    value={formData.level} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Step</label>
                                <input type="number" name="step" required className="mt-1 w-full border rounded p-2" placeholder="e.g. 2"
                                    value={formData.step} onChange={handleChange} />
                            </div>
                        </div>
                    </div>

                    {/* 3. Placement */}
                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">3. Placement</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Study Center / HQ</label>
                                <select
                                    name="centerId"
                                    required
                                    className="mt-1 w-full border rounded p-2"
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
                                    <label className="block text-sm font-medium text-gray-700">Directorate / Faculty (HQ)</label>
                                    <select
                                        name="unitId"
                                        required
                                        className="mt-1 w-full border rounded p-2"
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

                        {/* Academic Specifics */}
                        {formData.cadre === 'ACADEMIC' && (
                            <div className="mt-6 border-t pt-4">
                                <h4 className="text-sm font-semibold text-blue-800 mb-2">Academic & Facilitation Records</h4>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700">Academic Programme *</label>
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
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">State of Origin</label>
                                <input type="text" name="stateOfOrigin" className="mt-1 w-full border rounded p-2"
                                    value={formData.stateOfOrigin} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">LGA</label>
                                <input type="text" name="lga" className="mt-1 w-full border rounded p-2"
                                    value={formData.lga} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Residential Address</label>
                                <input type="text" name="address" className="mt-1 w-full border rounded p-2"
                                    value={formData.address} onChange={handleChange} />
                            </div>
                        </div>
                    </div>


                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                            {loading ? 'Registering...' : 'Register Account'}
                        </button>
                    </div>
                </form>

                <div className="text-center mt-4">
                    <p className="text-sm text-gray-600">
                        Already have an account?{' '}
                        <Link href="/login" className="font-medium text-green-600 hover:text-green-500">
                            Log in here
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
