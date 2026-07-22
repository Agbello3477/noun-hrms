'use client';

import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { ArrowLeft } from 'lucide-react';
import PasswordStrengthMeter from '../ui/PasswordStrengthMeter';

interface OrganizationData {
    centers: { id: string; name: string; code: string }[];
    units: { id: string; name: string; type: string; code: string }[];
}

interface RegisterFormProps {
    onSwitchView: (view: 'hero' | 'login') => void;
}

export default function RegisterForm({ onSwitchView }: RegisterFormProps) {
    const [formData, setFormData] = useState({
        staffId: '', title: '', surname: '', otherNames: '', email: '', phone: '', gender: 'Male',
        password: '', confirmPassword: '', address: '', stateOfOrigin: '', lga: '',
        role: '', cadre: '', level: '', step: '', centerId: '', unitId: '',
        programmeId: '', assignedFacilitatorId: '', courseCode: '', courseTitle: '', creditUnit: '1'
    });

    const [orgData, setOrgData] = useState<OrganizationData>({ centers: [], units: [] });
    const [programmes, setProgrammes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isHQ, setIsHQ] = useState(false);

    useEffect(() => {
        const fetchOrgData = async () => {
            try {
                const [orgRes, progRes] = await Promise.all([
                    api.get('/api/org/structure'),
                    api.get('/api/org/programmes')
                ]);
                setOrgData(orgRes.data);
                setProgrammes(progRes.data);
            } catch (err) {
                console.error('Failed to fetch org structure', err);
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
            if (!isHQSelected) setFormData(prev => ({ ...prev, unitId: '' }));
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
                name: `${formData.surname} ${formData.otherNames}`,
                unitId: formData.unitId || undefined,
                facilitatorInfo: formData.cadre === 'ACADEMIC' ? {
                    assignedFacilitatorId: formData.assignedFacilitatorId,
                    courses: [{ code: formData.courseCode, title: formData.courseTitle, unit: formData.creditUnit }]
                } : undefined
            };

            await api.post('/api/auth/register', payload);
            setSuccess('Registration successful! Redirecting to login...');

            setTimeout(() => {
                onSwitchView('login');
            }, 2000);

        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Failed to register');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="w-full max-w-2xl mx-auto rounded-2xl bg-white/90 backdrop-blur-xl p-12 shadow-2xl border border-white/40 text-center animate-in zoom-in duration-300">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                    <svg className="h-8 w-8 text-nounGreen" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Registration Successful!</h3>
                <p className="text-gray-500 mb-8">{success}</p>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nounGreen mx-auto"></div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto rounded-2xl bg-white/95 backdrop-blur-xl shadow-2xl border border-white/40 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button 
                        type="button"
                        onClick={() => onSwitchView('hero')}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">New Staff Registration</h2>
                        <p className="text-xs text-gray-500">Complete your profile to access the HRMS</p>
                    </div>
                </div>
                <button 
                    onClick={() => onSwitchView('login')}
                    className="text-sm font-bold text-nounGreen hover:text-green-800 transition-colors bg-green-50 px-4 py-2 rounded-full"
                >
                    Log In Instead
                </button>
            </div>

            {/* Scrollable Form Area */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                {error && <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-100 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    {error}
                </div>}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Section 1 */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">1. Identity & Credentials</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
                                <select name="title" className="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none" value={formData.title} onChange={handleChange}>
                                    <option value="">Select</option>
                                    <option value="Mr">Mr</option>
                                    <option value="Mrs">Mrs</option>
                                    <option value="Ms">Ms</option>
                                    <option value="Dr (Ph.D)">Dr. (Ph.D. - Doctor of Philosophy)</option>
                                    <option value="Dr (M.D.)">Dr. (M.D. / M.B.B.S. - Medical Doctor)</option>
                                    <option value="Prof">Prof</option>
                                    <option value="Pharm">Pharm.</option>
                                    <option value="Nurse">Nurse</option>
                                    <option value="MLS">MLS</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Surname *</label>
                                <input type="text" name="surname" required className="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none" value={formData.surname} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Other Names *</label>
                                <input type="text" name="otherNames" required className="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none" value={formData.otherNames} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address *</label>
                                <input type="email" name="email" required className="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none" value={formData.email} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Password *</label>
                                <input type="password" name="password" required minLength={6} className="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none" value={formData.password} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Confirm Password *</label>
                                <input type="password" name="confirmPassword" required minLength={6} className="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none" value={formData.confirmPassword} onChange={handleChange} />
                            </div>
                        </div>
                        <PasswordStrengthMeter password={formData.password} />
                    </div>

                    {/* Section 2 */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">2. Official Designation</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Staff ID *</label>
                                <input type="text" name="staffId" required className="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none" value={formData.staffId} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Role *</label>
                                <select name="role" required className="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none" value={formData.role} onChange={handleChange}>
                                    <option value="">Select Role</option>
                                    <option value="STAFF">Regular Staff</option>
                                    <option value="STUDY_CENTER_MANAGER">Study Center Manager</option>
                                    <option value="UNIT_HEAD">Dean / Director / Unit Head</option>
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
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Cadre *</label>
                                <select name="cadre" required className="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none" value={formData.cadre} onChange={handleChange}>
                                    <option value="">Select Cadre</option>
                                    <option value="ACADEMIC">Academic Staff</option>
                                    <option value="NON_ACADEMIC">Non-Academic</option>
                                    <option value="ADMINISTRATIVE">Administrative</option>
                                    <option value="TECHNICAL">Technical</option>
                                    <option value="JUNIOR">Junior</option>
                                    <option value="MEDICAL">Medical</option>
                                    <option value="SECURITY">Security</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 3 */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">3. Placement</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Study Center / HQ *</label>
                                <select name="centerId" required className="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none" value={formData.centerId} onChange={handleChange}>
                                    <option value="">Select Center</option>
                                    {orgData.centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            {isHQ && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Unit (HQ) *</label>
                                    <select name="unitId" required className="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none" value={formData.unitId} onChange={handleChange}>
                                        <option value="">Select Unit</option>
                                        {orgData.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer / Submit */}
                    <div className="pt-4 pb-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 px-6 border border-transparent text-sm font-bold rounded-xl text-white bg-nounGreen hover:bg-green-800 transition-all shadow-lg shadow-green-900/20 disabled:opacity-50"
                        >
                            {loading ? 'Creating Account...' : 'Complete Registration'}
                        </button>
                    </div>
                </form>
            </div>
            
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #d1d5db;
                    border-radius: 20px;
                }
            `}</style>
        </div>
    );
}
