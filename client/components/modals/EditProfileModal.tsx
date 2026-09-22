'use client';

import { useState } from 'react';
import { X, Camera, Save, Loader2, GraduationCap, CreditCard, CheckCircle2, Shield } from 'lucide-react';
import api from '../../lib/api';
import { NIGERIAN_BANKS, sanitizeAccountNumber } from '../../lib/banks';

const STANDARD_QUALIFICATIONS = [
    'Ph.D. / Doctorate',
    'M.Sc. / Masters',
    'M.Phil.',
    'MBA / MPA / Professional Masters',
    'PGD (Post Graduate Diploma)',
    'B.Sc. / B.A. / B.Ed. / First Degree',
    'HND (Higher National Diploma)',
    'OND / ND (National Diploma)',
    'NCE (Nigeria Certificate in Education)',
    'SSCE / WAEC / NECO / GCE',
    'FSLC (First School Leaving Certificate)'
];

interface EditProfileModalProps {
    user: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EditProfileModal({ user, onClose, onSuccess }: EditProfileModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const initialQual = user.staffProfile?.highestQualification || '';
    const isStandard = STANDARD_QUALIFICATIONS.includes(initialQual);
    const initialBank = user.staffProfile?.bankName || '';
    const isStandardBank = NIGERIAN_BANKS.some(b => b.name === initialBank);
    
    const [formData, setFormData] = useState({
        surname: user.staffProfile?.surname || user.name?.split(' ')[0] || '',
        otherNames: user.staffProfile?.otherNames || user.name?.split(' ').slice(1).join(' ') || '',
        phone: user.staffProfile?.phone || '',
        nin: user.staffProfile?.nin || '',
        address: user.staffProfile?.address || '',
        stateOfOrigin: user.staffProfile?.stateOfOrigin || '',
        lga: user.staffProfile?.lga || '',
        highestQualification: isStandard ? initialQual : (initialQual ? 'CUSTOM' : ''),
        customQualification: isStandard ? '' : initialQual,
        bankName: isStandardBank ? initialBank : (initialBank ? 'OTHER' : ''),
        customBankName: isStandardBank ? '' : initialBank,
        accountNumber: user.staffProfile?.accountNumber || '',
        accountName: user.staffProfile?.accountName || user.name || ''
    });
    const [passport, setPassport] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(user.staffProfile?.passportUrl ? `${process.env.NEXT_PUBLIC_API_URL}${user.staffProfile.passportUrl}` : null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleNinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
        setFormData({ ...formData, nin: digits });
    };

    const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const sanitized = sanitizeAccountNumber(e.target.value);
        setFormData({ ...formData, accountNumber: sanitized });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setPassport(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const effectiveQual = formData.highestQualification === 'CUSTOM'
                ? formData.customQualification.trim()
                : formData.highestQualification;

            const effectiveBank = formData.bankName === 'OTHER'
                ? formData.customBankName.trim()
                : formData.bankName;

            const data = new FormData();
            data.append('surname', formData.surname);
            data.append('otherNames', formData.otherNames);
            data.append('phone', formData.phone);
            if (formData.nin) {
                data.append('nin', formData.nin.trim());
            }
            data.append('address', formData.address);
            data.append('stateOfOrigin', formData.stateOfOrigin);
            data.append('lga', formData.lga);
            if (effectiveQual) {
                data.append('highestQualification', effectiveQual);
            }
            if (effectiveBank) {
                data.append('bankName', effectiveBank);
            }
            if (formData.accountNumber) {
                data.append('accountNumber', formData.accountNumber.trim());
            }
            if (formData.accountName) {
                data.append('accountName', formData.accountName.trim());
            }

            if (passport) {
                data.append('passport', passport);
            }

            // Update "me"
            await api.put('/api/staff/me', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Update failed', error);
            alert('Failed to update profile.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-800">Edit Profile</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Passport Section */}
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="relative h-32 w-32 rounded-full overflow-hidden border-4 border-gray-100 bg-gray-50 group cursor-pointer">
                            {previewUrl ? (
                                <img src={previewUrl} alt="Passport" className="h-full w-full object-cover" />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center text-gray-400">
                                    <Camera size={40} />
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all">
                                <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-bold">CHANGE</span>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">Tap to upload passport photo</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Surname</label>
                            <input
                                type="text" name="surname"
                                value={formData.surname} onChange={handleChange}
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Other Names</label>
                            <input
                                type="text" name="otherNames"
                                value={formData.otherNames} onChange={handleChange}
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        {/* Highest Qualification Field */}
                        <div className="col-span-2 bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                            <label className="block text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                <GraduationCap size={16} className="text-[#006533]" />
                                Highest Educational / Academic Qualification
                            </label>
                            <select
                                name="highestQualification"
                                value={formData.highestQualification}
                                onChange={handleChange}
                                className="block w-full rounded-lg border border-emerald-300 bg-white p-2.5 text-sm text-gray-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                                    placeholder="Specify exact degree title (e.g. Ph.D. in Cyber Security, LL.M, etc.)"
                                    value={formData.customQualification}
                                    onChange={handleChange}
                                    className="mt-2 block w-full rounded-lg border border-emerald-300 bg-white p-2.5 text-sm text-gray-900 placeholder:text-gray-400"
                                />
                            )}
                        </div>

                        {/* Bursary & Banking Details Field */}
                        <div className="col-span-2 bg-blue-50/80 p-4 rounded-xl border border-blue-200 space-y-3">
                            <label className="block text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                                <CreditCard size={16} className="text-blue-700" />
                                Bursary &amp; Banking Details (Salary Disbursement)
                            </label>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-blue-900 mb-1">Bank Name</label>
                                    <select
                                        name="bankName"
                                        value={formData.bankName}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border border-blue-300 bg-white p-2 text-xs text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                                    {formData.bankName === 'OTHER' && (
                                        <input
                                            type="text"
                                            name="customBankName"
                                            placeholder="Specify institution name"
                                            value={formData.customBankName}
                                            onChange={handleChange}
                                            className="mt-1.5 block w-full rounded-lg border border-blue-300 bg-white p-2 text-xs text-gray-900"
                                        />
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-blue-900 mb-1 flex items-center justify-between">
                                        <span>Account Number (NUBAN)</span>
                                        {formData.accountNumber.length === 10 && (
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded inline-flex items-center gap-0.5">
                                                <CheckCircle2 size={10} /> 10 Digits
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        name="accountNumber"
                                        maxLength={10}
                                        placeholder="10 Digits"
                                        value={formData.accountNumber}
                                        onChange={handleAccountNumberChange}
                                        className="block w-full rounded-lg border border-blue-300 bg-white p-2 text-xs text-gray-900 font-mono font-bold tracking-wider focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-blue-900 mb-1">Account Name</label>
                                    <input
                                        type="text"
                                        name="accountName"
                                        placeholder="Full Beneficiary Name"
                                        value={formData.accountName}
                                        onChange={handleChange}
                                        className="block w-full rounded-lg border border-blue-300 bg-white p-2 text-xs text-gray-900 font-medium uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Phone</label>
                            <input
                                type="tel" name="phone"
                                value={formData.phone} onChange={handleChange}
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                                    <Shield size={14} className="text-[#006533]" /> NIN
                                </label>
                                {formData.nin && formData.nin.length === 11 ? (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5">
                                        <CheckCircle2 size={10} /> 11 Digits
                                    </span>
                                ) : formData.nin ? (
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1 py-0.2 rounded">
                                        {formData.nin.length}/11 Digits
                                    </span>
                                ) : null}
                            </div>
                            <input
                                type="text"
                                name="nin"
                                maxLength={11}
                                placeholder="11 Digits NIN"
                                value={formData.nin}
                                onChange={handleNinChange}
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 font-mono text-sm tracking-wider focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">State of Origin</label>
                            <input
                                type="text" name="stateOfOrigin"
                                value={formData.stateOfOrigin} onChange={handleChange}
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">LGA</label>
                            <input
                                type="text" name="lga"
                                value={formData.lga} onChange={handleChange}
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Residential Address</label>
                            <textarea
                                name="address" rows={2}
                                value={formData.address} onChange={handleChange}
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
