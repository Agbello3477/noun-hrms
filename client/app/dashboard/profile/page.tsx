'use client';

import { useState } from 'react';
import EditProfileModal from '../../../components/modals/EditProfileModal';
import { useAuth } from '../../../hooks/useAuth';
import ActiveSessions from '../../../components/profile/ActiveSessions';
import {
    User, Mail, Briefcase, MapPin, Phone, Building, Edit2,
    PenTool, Upload, CheckCircle, AlertCircle, Loader2, Trash2, TrendingUp, CreditCard
} from 'lucide-react';
import api, { getImageUrl } from '../../../lib/api';

// Roles that are authorized to have an official signature
const SIGNATURE_ROLES = [
    'VICE_CHANCELLOR',
    'HR_ADMIN',
    'SUPER_USER',
    'UNIT_HEAD',
    'UNIT_ADMIN',
    'STUDY_CENTER_MANAGER',
];

export default function ProfilePage() {
    const { user, isLoading } = useAuth();

    const [showEdit, setShowEdit] = useState(false);

    // Signature upload states
    const [uploadingSig, setUploadingSig] = useState(false);
    const [sigSuccess, setSigSuccess] = useState('');
    const [sigError, setSigError] = useState('');
    const [currentSigUrl, setCurrentSigUrl] = useState<string>(() =>
        typeof window !== 'undefined' ? '' : ''
    );
    // Track if we've initialised sigUrl from user
    const [sigInitialised, setSigInitialised] = useState(false);

    if (isLoading) {
        return (
            <div className="flex h-60 items-center justify-center text-gray-500">
                <Loader2 className="animate-spin mr-2" size={20} /> Loading profile...
            </div>
        );
    }

    if (!user) {
        return <div className="p-8 text-center text-red-500">User not found. Please log in.</div>;
    }

    // Initialise sigUrl once we have user data
    if (!sigInitialised && user.staffProfile?.signatureUrl) {
        setCurrentSigUrl(user.staffProfile.signatureUrl);
        setSigInitialised(true);
    }

    const canUploadSignature = SIGNATURE_ROLES.includes(user.role);

    const handleSuccess = () => {
        window.location.reload();
    };

    const handleUploadSignature = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate: image only, max 2MB
        if (!file.type.startsWith('image/')) {
            setSigError('Please upload an image file (PNG, JPG, SVG recommended).');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setSigError('File too large. Maximum size is 2MB.');
            return;
        }

        setUploadingSig(true);
        setSigSuccess('');
        setSigError('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data } = await api.post('/api/staff/signature', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setCurrentSigUrl(data.signatureUrl);
            setSigSuccess('Signature saved successfully! It will appear on all your approvals and documents.');
        } catch (error: any) {
            setSigError(error.response?.data?.message || 'Failed to upload signature. Please try again.');
        } finally {
            setUploadingSig(false);
            // Reset the file input
            e.target.value = '';
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Page Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
                    <p className="text-sm text-gray-500">Manage your personal information and employment details.</p>
                </div>
                <button
                    onClick={() => setShowEdit(true)}
                    className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium shadow-sm transition"
                >
                    <Edit2 size={16} /> Edit Profile
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: ID Card */}
                <div className="col-span-1 space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm p-6 text-center border-t-4 border-blue-600">
                        <div className="mx-auto h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center text-3xl font-bold text-blue-600 mb-4 overflow-hidden">
                            {user.staffProfile?.passportUrl ? (
                                <img
                                    src={getImageUrl(user.staffProfile.passportUrl)}
                                    alt="Profile"
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.parentElement?.querySelector('.profile-initials') as HTMLElement;
                                        if (fallback) fallback.style.display = 'block';
                                    }}
                                />
                            ) : null}
                            <span className={`profile-initials ${user.staffProfile?.passportUrl ? 'hidden' : 'block'}`}>
                                {user.name.charAt(0)}
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">
                            {user.staffProfile?.title ? `${user.staffProfile.title}. ${user.name}` : user.name}
                        </h2>
                        <p className="text-sm text-blue-600 font-medium mb-4">{user.role.replace(/_/g, ' ')}</p>

                        <div className="border-t pt-4 text-left space-y-3">
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                                <Mail size={16} />
                                <span className="truncate">{user.email}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                                <Briefcase size={16} />
                                <span>{user.staffProfile?.staffId || 'No Staff ID'}</span>
                            </div>
                        </div>
                    </div>

                    {/* ─── Signature Card (Approver Roles Only) ─── */}
                    {canUploadSignature && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            {/* Card header */}
                            <div className="bg-gradient-to-r from-indigo-600 to-blue-700 px-5 py-4 flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
                                    <PenTool size={18} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-white font-bold text-sm leading-tight">Official Signature</p>
                                    <p className="text-blue-100 text-[11px]">Affixed on all approvals &amp; documents</p>
                                </div>
                            </div>

                            <div className="p-5 space-y-4">
                                {/* Current signature preview */}
                                <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center min-h-[90px] relative overflow-hidden">
                                    {currentSigUrl ? (
                                        <img
                                            src={getImageUrl(currentSigUrl)}
                                            alt="Your signature"
                                            className="max-h-[80px] max-w-full object-contain p-2"
                                        />
                                    ) : (
                                        <div className="text-center py-4">
                                            <PenTool size={28} className="text-gray-300 mx-auto mb-1" />
                                            <p className="text-xs text-gray-400 font-medium">No signature uploaded yet</p>
                                        </div>
                                    )}
                                </div>

                                {/* Signed by line */}
                                {currentSigUrl && (
                                    <div className="flex items-center gap-2 text-[11px] text-gray-500 border-t pt-3">
                                        <CheckCircle size={13} className="text-green-500 flex-shrink-0" />
                                        <span>Signature on file — will appear on approved/denied requests.</span>
                                    </div>
                                )}

                                {/* Upload button */}
                                <label className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border font-semibold text-sm cursor-pointer transition ${
                                    uploadingSig
                                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                }`}>
                                    {uploadingSig ? (
                                        <><Loader2 size={15} className="animate-spin" /> Uploading...</>
                                    ) : (
                                        <><Upload size={15} /> {currentSigUrl ? 'Replace Signature' : 'Upload Signature'}</>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        disabled={uploadingSig}
                                        onChange={handleUploadSignature}
                                    />
                                </label>

                                <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                                    Upload a clear image of your signature (PNG with transparent background recommended). Max 2MB.
                                </p>

                                {/* Feedback messages */}
                                {sigSuccess && (
                                    <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 font-medium">
                                        <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
                                        {sigSuccess}
                                    </div>
                                )}
                                {sigError && (
                                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                                        {sigError}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Detailed Info */}
                <div className="col-span-2 space-y-6">
                    {/* Official Information */}
                    <div className="bg-white rounded-2xl shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Building size={20} className="text-gray-400" />
                            Official Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase">Department / Unit</label>
                                <p className="text-gray-900 font-medium mt-1">
                                    {user.staffProfile?.unit?.name || user.staffProfile?.department || 'N/A'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase">Study Center</label>
                                <p className="text-gray-900 font-medium mt-1">
                                    {user.staffProfile?.studyCenter?.name || 'HQ (Abuja)'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase">Rank / Level</label>
                                <p className="text-gray-900 font-medium mt-1">
                                    {user.staffProfile?.level || user.staffProfile?.rank || 'N/A'}
                                    {user.staffProfile?.step ? ` / Step ${user.staffProfile.step}` : ''}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase">Cadre</label>
                                <p className="text-gray-900 font-medium mt-1">
                                    {user.staffProfile?.cadre || 'N/A'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase">Highest Qualification</label>
                                <p className="text-gray-900 font-medium mt-1">
                                    {(user.staffProfile as any)?.highestQualification || 'Not Specified'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase">Date of First Appointment</label>
                                <p className="text-gray-900 font-medium mt-1">
                                    {(user.staffProfile as any)?.dateOfFirstAppointment 
                                        ? new Date((user.staffProfile as any).dateOfFirstAppointment).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) 
                                        : 'Not Specified'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bursary & Banking Details */}
                    <div className="bg-white rounded-2xl shadow-sm border border-blue-200/90 p-6 overflow-hidden relative">
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600"></div>
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="h-9 w-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-700 border border-blue-100">
                                <CreditCard size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Bursary &amp; Banking Details (Disbursements)</h3>
                                <p className="text-xs text-gray-500">Designated bank account for salary payment and official disbursements.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                            <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
                                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block mb-1">Bank Name</span>
                                <span className="text-sm font-extrabold text-blue-950">
                                    {(user.staffProfile as any)?.bankName || 'Not Provided'}
                                </span>
                            </div>
                            <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
                                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block mb-1">Account Number</span>
                                <span className="text-sm font-extrabold text-blue-950 font-mono tracking-wider">
                                    {(user.staffProfile as any)?.accountNumber || 'Not Provided'}
                                </span>
                            </div>
                            <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
                                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block mb-1">Beneficiary Account Name</span>
                                <span className="text-sm font-bold text-blue-950 uppercase">
                                    {(user.staffProfile as any)?.accountName || user.name || 'Not Provided'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Promotion Maturity & Career Milestone */}
                    <div className="bg-white rounded-2xl shadow-sm border border-emerald-200/90 p-6 overflow-hidden relative">
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-green-600"></div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-700 border border-emerald-100">
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">Promotion Maturity &amp; Career Milestone</h3>
                                    <p className="text-xs text-gray-500">Statutory appraisal schedule and institutional advancement timeline.</p>
                                </div>
                            </div>
                            <div>
                                {(user.staffProfile as any)?.promotionEligibilityStatus === 'DUE_THIS_CYCLE' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                        <AlertCircle size={13} className="text-amber-700" /> Due This Cycle
                                    </span>
                                ) : (user.staffProfile as any)?.promotionEligibilityStatus === 'MATURED_OVERDUE' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-200">
                                        <AlertCircle size={13} className="text-red-700" /> Matured / Overdue
                                    </span>
                                ) : (user.staffProfile as any)?.promotionEligibilityStatus === 'PROMOTED' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                                        <CheckCircle size={13} className="text-emerald-700" /> Promoted
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                        <TrendingUp size={13} className="text-emerald-700" /> Pending Maturity
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 mt-4">
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Last Promotion</span>
                                <span className="text-xs font-extrabold text-slate-900">
                                    {(user.staffProfile as any)?.lastPromotionDate 
                                        ? new Date((user.staffProfile as any).lastPromotionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : ((user.staffProfile as any)?.dateOfFirstAppointment ? new Date((user.staffProfile as any).dateOfFirstAppointment).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'First Appointment')}
                                </span>
                            </div>

                            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100">
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">Next Due Year</span>
                                <span className="text-base font-black text-emerald-950 font-mono">
                                    {(user.staffProfile as any)?.nextPromotionDueYear || 'Pending'}
                                </span>
                            </div>

                            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100">
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">Target Effective Date</span>
                                <span className="text-xs font-extrabold text-emerald-950">
                                    {(user.staffProfile as any)?.nextPromotionDueDate 
                                        ? new Date((user.staffProfile as any).nextPromotionDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : ((user.staffProfile as any)?.nextPromotionDueYear ? `${(user.staffProfile as any)?.cadre === 'ACADEMIC' ? '01 Oct' : '01 Jan'} ${(user.staffProfile as any)?.nextPromotionDueYear}` : 'Statutory Cycle')}
                                </span>
                            </div>

                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cadre Waiting Rule</span>
                                <span className="text-xs font-bold text-slate-800">
                                    {(user.staffProfile as any)?.cadre === 'ACADEMIC' ? 'Academic (3 Yrs • Oct 1)' : 'Admin/Junior (3–4 Yrs • Jan 1)'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Personal Information */}
                    <div className="bg-white rounded-2xl shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <User size={20} className="text-gray-400" />
                            Personal Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase">Phone Number</label>
                                <p className="text-gray-900 font-medium mt-1">
                                    {user.staffProfile?.phone || 'Not provided'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase">State of Origin</label>
                                <p className="text-gray-900 font-medium mt-1">
                                    {user.staffProfile?.stateOfOrigin || 'N/A'}
                                </p>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-400 uppercase">Address</label>
                                <div className="flex items-start gap-2 mt-1">
                                    <MapPin size={16} className="text-gray-400 mt-0.5" />
                                    <p className="text-gray-900 font-medium">
                                        {user.staffProfile?.address || 'Not provided'}
                                    </p>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-400 uppercase">LGA</label>
                                <p className="text-gray-900 font-medium mt-1">
                                    {user.staffProfile?.lga || 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <ActiveSessions />
                </div>
            </div>

            {showEdit && (
                <EditProfileModal
                    user={user}
                    onClose={() => setShowEdit(false)}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
}
