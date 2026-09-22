
import { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';
import { NIGERIAN_STATES_AND_LGAS } from '../../lib/nigeria-states-lgas';
import { STANDARD_QUALIFICATIONS } from '../../lib/qualifications';
import { NIGERIAN_BANKS, sanitizeAccountNumber } from '../../lib/banks';
import { TrendingUp, Info, GraduationCap, CreditCard, Building2, CheckCircle2, Camera, Upload, X, Shield } from 'lucide-react';

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
        nin: '', // 11-digit National Identification Number
        highestQualification: '',
        customQualification: '',

        // Bursary & Banking Details
        bankName: '',
        customBankName: '',
        accountNumber: '',
        accountName: '',

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
        dateOfFirstAppointment: '',

        // Promotion Maturity & Scheduling
        lastPromotionDate: '',
        cadreAppraisalRule: 'SENIOR_ADMIN_3',
        nextPromotionDueYear: '',
        nextPromotionDueDate: '',
        isYearOverridden: false,
        overrideReason: '',
        isDueImmediately: false,

        // Organization
        centerId: '',
        unitId: '',

        // Academic
        programmeId: '',
        dateOfBirth: '',
    });

    const [orgData, setOrgData] = useState<OrganizationData>({ centers: [], units: [] });
    const [programmes, setProgrammes] = useState<any[]>([]);

    const [passportFile, setPassportFile] = useState<File | null>(null);
    const [passportPreview, setPassportPreview] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isHQ, setIsHQ] = useState(false);

    // Statutory Cadre Maturity Rule Computation
    const computedPromotionSchedule = useMemo(() => {
        let baseDateStr = formData.lastPromotionDate || formData.dateOfFirstAppointment;
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

        const rule = formData.cadreAppraisalRule;
        const cadre = formData.cadre;

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
    }, [formData.lastPromotionDate, formData.dateOfFirstAppointment, formData.cadreAppraisalRule, formData.cadre]);

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
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

        setFormData(prev => {
            const next = { ...prev, [name]: val };

            if (name === 'stateOfOrigin') {
                next.lga = '';
            }

            if (name === 'cadre') {
                if (value === 'ACADEMIC') {
                    next.cadreAppraisalRule = 'ACADEMIC_3';
                } else if (value === 'JUNIOR') {
                    next.cadreAppraisalRule = 'JUNIOR_3';
                } else {
                    next.cadreAppraisalRule = 'SENIOR_ADMIN_3';
                }
            }

            return next;
        });

        if (name === 'centerId') {
            const selectedCenter = orgData.centers.find(c => c.id === value);
            const isHQSelected = selectedCenter?.code === 'HQ-001';
            setIsHQ(isHQSelected);
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
        // Keep only digits
        const digits = value.replace(/\D/g, '');
        // Limit to 11 characters
        const limitedDigits = digits.slice(0, 11);
        setFormData(prev => ({ ...prev, phone: limitedDigits }));
    };

    const handleNinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
        setFormData(prev => ({ ...prev, nin: digits }));
    };

    const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = sanitizeAccountNumber(e.target.value);
        setFormData(prev => ({ ...prev, accountNumber: digits }));
    };

    const handlePassportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setPassportFile(file);
            const preview = URL.createObjectURL(file);
            setPassportPreview(preview);
        }
    };

    const handleRemovePassport = () => {
        setPassportFile(null);
        setPassportPreview(null);
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
            let submittedPhone = formData.phone;
            if (submittedPhone) {
                const cleaned = submittedPhone.replace(/\D/g, '');
                const withoutZero = cleaned.startsWith('0') ? cleaned.slice(1) : cleaned;
                submittedPhone = `+234${withoutZero}`;
            }

            const effectiveQualification = formData.highestQualification === 'CUSTOM'
                ? formData.customQualification.trim()
                : formData.highestQualification;

            const effectiveBankName = formData.bankName === 'OTHER'
                ? formData.customBankName.trim()
                : formData.bankName;

            const endpoint = mode === 'CREATE'
                ? '/api/registry/files/create'
                : '/api/registry/files/existing';

            let responseData: any;

            if (passportFile) {
                const data = new FormData();
                Object.entries(formData).forEach(([key, val]) => {
                    if (val !== undefined && val !== null && val !== '') {
                        data.append(key, String(val));
                    }
                });
                if (effectiveQualification) data.set('highestQualification', effectiveQualification);
                if (effectiveBankName) data.set('bankName', effectiveBankName);
                if (submittedPhone) data.set('phone', submittedPhone);
                data.set('name', `${formData.surname} ${formData.otherNames}`.trim());
                if (formData.nin) data.set('nin', formData.nin.trim());
                data.append('passport', passportFile);

                const res = await api.post(endpoint, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                responseData = res.data;
            } else {
                const payload = {
                    ...formData,
                    highestQualification: effectiveQualification || undefined,
                    bankName: effectiveBankName || undefined,
                    accountNumber: formData.accountNumber.trim() || undefined,
                    accountName: formData.accountName.trim() || undefined,
                    nin: formData.nin.trim() || undefined,
                    phone: submittedPhone || undefined,
                    name: `${formData.surname} ${formData.otherNames}`,
                    unitId: formData.unitId || undefined,
                };

                const res = await api.post(endpoint, payload);
                responseData = res.data;
            }

            onSuccess(responseData);
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

            {/* Passport Photograph Placeholder & Upload */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center gap-5">
                    {/* Passport Photo Frame */}
                    <div className="relative h-28 w-28 rounded-2xl overflow-hidden border-2 border-dashed border-emerald-400 bg-slate-50 flex-shrink-0 shadow-inner group flex items-center justify-center">
                        {passportPreview ? (
                            <img
                                src={passportPreview}
                                alt="Staff Passport Photograph"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                                <Camera size={28} className="text-[#006533] mb-1" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Passport Photo</span>
                            </div>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handlePassportChange}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            title="Click to upload staff passport photo"
                        />
                        <div className="absolute inset-0 bg-emerald-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold pointer-events-none">
                            <span>{passportPreview ? 'Change Photo' : 'Upload Photo'}</span>
                        </div>
                    </div>

                    {/* Passport Upload Controls & Instructions */}
                    <div className="space-y-1.5 flex-1 text-center sm:text-left">
                        <div className="flex items-center justify-center sm:justify-start gap-2">
                            <h4 className="font-bold text-sm text-slate-800">Staff Passport Photograph</h4>
                            {passportPreview && (
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle2 size={11} /> Ready to Upload
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500">
                            Upload a standard official passport photograph with a plain background (JPG, PNG, or WebP).
                        </p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 transition-colors">
                                <Upload size={13} />
                                <span>{passportPreview ? 'Choose Another Image' : 'Select Passport File'}</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePassportChange}
                                    className="hidden"
                                />
                            </label>
                            {passportPreview && (
                                <button
                                    type="button"
                                    onClick={handleRemovePassport}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg border border-red-200 transition-colors"
                                >
                                    <X size={12} /> Remove
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

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
                            <option value="Ms">Ms</option>
                            <option value="Dr (Ph.D)">Dr. (Ph.D. - Doctor of Philosophy)</option>
                            <option value="Dr (M.D.)">Dr. (M.D. / M.B.B.S. - Medical Doctor)</option>
                            <option value="Prof">Prof</option>
                            <option value="Pharm">Pharm.</option>
                            <option value="Nurse">Nurse</option>
                            <option value="MLS">MLS</option>
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

                    {/* National Identification Number (NIN) */}
                    <div className="col-span-2 sm:col-span-1">
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                                <Shield size={13} className="text-[#006533]" />
                                National Identification Number (NIN)
                            </label>
                            {formData.nin && formData.nin.length === 11 ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                    <CheckCircle2 size={10} /> 11-Digit Valid
                                </span>
                            ) : formData.nin ? (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                    {formData.nin.length}/11 Digits
                                </span>
                            ) : null}
                        </div>
                        <input
                            name="nin"
                            type="text"
                            maxLength={11}
                            placeholder="e.g. 12345678901 (11 digits)"
                            className="w-full border p-1.5 rounded font-mono text-sm tracking-wider focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                            value={formData.nin}
                            onChange={handleNinChange}
                        />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
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
                        <label className="block text-xs font-medium text-gray-500">Date of Birth</label>
                        <input
                            type="date"
                            name="dateOfBirth"
                            required
                            className="w-full border p-1.5 rounded mt-0.5 text-black"
                            value={formData.dateOfBirth}
                            onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500">State of Origin</label>
                        <select
                            name="stateOfOrigin"
                            required
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
                            required
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
                    <div className="col-span-2 bg-emerald-50/80 p-3.5 rounded-xl border-2 border-emerald-200 mt-2">
                        <label className="block text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                            <GraduationCap size={16} className="text-[#006533]" />
                            Highest Educational / Academic Qualification
                        </label>
                        <select
                            name="highestQualification"
                            className="w-full border border-emerald-400 rounded-lg p-2.5 bg-white text-gray-900 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                                placeholder="Specify exact qualification (e.g. Ph.D. in Cyber Security, LL.M, etc.)"
                                className="w-full border border-emerald-400 rounded-lg p-2.5 mt-2 bg-white text-xs text-gray-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                value={formData.customQualification}
                                onChange={handleChange}
                            />
                        )}
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
                        <label className="block text-xs font-medium text-gray-500">Cadre</label>
                        <select name="cadre" required className="w-full border p-1.5 rounded" value={formData.cadre} onChange={handleChange}>
                            <option value="">Select Cadre</option>
                            <option value="ACADEMIC">Academic</option>
                            <option value="NON_ACADEMIC">Non-Academic</option>
                            <option value="SENIOR">Senior</option>
                            <option value="JUNIOR">Junior</option>
                            <option value="MEDICAL">Medical</option>
                            <option value="SECURITY">Security</option>
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
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500">Date of First Appointment</label>
                        <input
                            type="date"
                            name="dateOfFirstAppointment"
                            required
                            className="w-full border p-1.5 rounded text-black mt-0.5"
                            value={formData.dateOfFirstAppointment}
                            onChange={handleChange}
                        />
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

            {/* 4. Bursary & Banking Details */}
            <div className="bg-blue-50/70 p-4 rounded-xl border-2 border-blue-200 space-y-3">
                <div className="flex items-center gap-2">
                    <CreditCard className="text-blue-700" size={18} />
                    <div>
                        <h4 className="font-bold text-blue-950 text-sm">Bursary &amp; Banking Details (Payment &amp; Payroll)</h4>
                        <p className="text-[11px] text-blue-700">Account information used by Bursary for salary disbursements, statutory claims, and IPPIS schedules.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-blue-900 mb-1">
                            Bank Name
                        </label>
                        <select
                            name="bankName"
                            className="w-full border border-blue-300 rounded-lg p-2 bg-white text-xs text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            value={formData.bankName}
                            onChange={handleChange}
                        >
                            <option value="">-- Select Bank --</option>
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
                            <option value="OTHER">Other / Specific Microfinance Bank</option>
                        </select>
                        {formData.bankName === 'OTHER' && (
                            <input
                                type="text"
                                name="customBankName"
                                placeholder="Enter full institution / MFB name"
                                className="w-full border border-blue-300 rounded-lg p-2 mt-2 bg-white text-xs text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={formData.customBankName}
                                onChange={handleChange}
                            />
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-blue-900 mb-1 flex items-center justify-between">
                            <span>Account Number (NUBAN)</span>
                            {formData.accountNumber.length === 10 && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                                    <CheckCircle2 size={10} /> 10 Digits
                                </span>
                            )}
                        </label>
                        <input
                            type="text"
                            name="accountNumber"
                            maxLength={10}
                            placeholder="e.g. 0123456789"
                            className="w-full border border-blue-300 rounded-lg p-2 bg-white text-xs text-gray-900 font-mono font-bold tracking-wider focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            value={formData.accountNumber}
                            onChange={handleAccountNumberChange}
                        />
                        <span className="text-[10px] text-blue-600 block mt-0.5">10-digit Nigerian NUBAN format</span>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-blue-900 mb-1">
                            Account Name (Beneficiary)
                        </label>
                        <input
                            type="text"
                            name="accountName"
                            placeholder="e.g. BELLO ABDULGAFFAR O."
                            className="w-full border border-blue-300 rounded-lg p-2 bg-white text-xs text-gray-900 font-medium uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            value={formData.accountName}
                            onChange={handleChange}
                        />
                        <span className="text-[10px] text-blue-600 block mt-0.5">Full name registered with the bank</span>
                    </div>
                </div>
            </div>

            {/* 5. Promotion Maturity & Scheduling */}
            <div className="bg-emerald-50/50 p-4 rounded border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2">
                    <TrendingUp className="text-emerald-700" size={16} />
                    <h4 className="font-semibold text-emerald-900 text-sm">Promotion Maturity & Scheduling</h4>
                </div>
                <p className="text-xs text-emerald-700">
                    Establish statutory maturity dates and legacy promotion milestones for automated tracking and appraisal staging.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-700">
                            Last Promotion / Substantive Appointment Date
                        </label>
                        <input
                            type="date"
                            name="lastPromotionDate"
                            className="w-full border border-emerald-300 rounded p-1.5 text-black bg-white mt-0.5 text-xs"
                            value={formData.lastPromotionDate}
                            onChange={handleChange}
                        />
                        <span className="text-[10px] text-gray-500 block mt-0.5">Defaults to first appointment date if left blank.</span>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700">
                            Cadre & Appraisal Rule
                        </label>
                        <select
                            name="cadreAppraisalRule"
                            className="w-full border border-emerald-300 rounded p-1.5 bg-white text-xs mt-0.5"
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

                <div className="bg-white p-3 rounded border border-emerald-200 text-xs text-emerald-900 space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold text-xs">
                        <Info size={13} className="text-emerald-600" />
                        <span>Statutory Rule Applied:</span>
                    </div>
                    <p className="text-emerald-800 text-[11px] font-medium bg-emerald-50 p-1.5 rounded border border-emerald-100">
                        {computedPromotionSchedule.ruleDescription}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-700">Calculated Next Promotion Year</label>
                            <div className="flex items-center gap-2 mt-0.5">
                                <input
                                    type="number"
                                    name="nextPromotionDueYear"
                                    value={formData.nextPromotionDueYear}
                                    onChange={handleNextYearChange}
                                    className="w-full border rounded p-1.5 font-mono font-bold text-xs bg-white"
                                    placeholder={String(computedPromotionSchedule.calculatedYear)}
                                />
                                {formData.isYearOverridden && (
                                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
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
                                className="w-full border rounded p-1.5 font-mono text-xs bg-white mt-0.5"
                            />
                        </div>
                    </div>

                    {formData.isYearOverridden && (
                        <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200 space-y-1">
                            <label className="block text-[11px] font-bold text-amber-900">
                                Override Justification (Mandatory) *
                            </label>
                            <input
                                type="text"
                                name="overrideReason"
                                required={formData.isYearOverridden}
                                placeholder="State reason for non-standard promotion year"
                                value={formData.overrideReason}
                                onChange={handleChange}
                                className="w-full border border-amber-300 rounded p-1.5 text-xs bg-white"
                            />
                        </div>
                    )}

                    <div className="pt-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                name="isDueImmediately"
                                checked={formData.isDueImmediately}
                                onChange={handleChange}
                                className="rounded border-emerald-300 text-emerald-700 focus:ring-emerald-500 h-3.5 w-3.5"
                            />
                            <span className="text-xs font-semibold text-gray-800">
                                Flag as Due Immediately for 2026 Appraisal Docket (Fast-track legacy backlog)
                            </span>
                        </label>
                    </div>
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
