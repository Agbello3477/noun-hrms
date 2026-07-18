'use client';

import { useState } from 'react';
import EditProfileModal from '../../../components/modals/EditProfileModal';
import { useAuth } from '../../../hooks/useAuth';
import {
    User, Mail, Briefcase, MapPin, Phone, Building, Edit2,
    PenTool, Upload, CheckCircle, AlertCircle, Loader2, Trash2
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
                                    src={`${process.env.NEXT_PUBLIC_API_URL}${user.staffProfile.passportUrl}`}
                                    alt="Profile"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                user.name.charAt(0)
                            )}
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
