'use client';

import { useState } from 'react';
import EditProfileModal from '../../../components/modals/EditProfileModal';
import { useAuth } from '../../../hooks/useAuth';
import { User, Mail, Briefcase, MapPin, Phone, Building, Edit2 } from 'lucide-react';

export default function ProfilePage() {
    const { user, isLoading, refreshUser } = useAuth(); // Assuming refreshUser exists? If not, we might need to reload or refetch. 
    // Actually useAuth usually exposes mutate or we can just window.location.reload() for simplicity or re-login.
    // Let's check useAuth again. It uses SWR or Context? Content shows it exports { user, isLoading }.
    // If it uses API call in useEffect, we might need to trigger re-fetch.
    // Making it simple: passing a refresh callback that might just reload page or we assume useAuth revalidates if it uses SWR.

    const [showEdit, setShowEdit] = useState(false);

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading profile...</div>;
    }

    if (!user) {
        return <div className="p-8 text-center text-red-500">User not found. Please log in.</div>;
    }

    const handleSuccess = () => {
        // Simple reload to fetch fresh data
        window.location.reload();
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
                    <p className="text-sm text-gray-500">Manage your personal information and view your employment details.</p>
                </div>
                <button
                    onClick={() => setShowEdit(true)}
                    className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium shadow-sm"
                >
                    <Edit2 size={16} /> Edit Profile
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: ID Card style */}
                <div className="col-span-1">
                    <div className="bg-white rounded-lg shadow-sm p-6 text-center border-t-4 border-blue-600">
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
                        <h2 className="text-xl font-bold text-gray-800">{user.name}</h2>
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
                </div>

                {/* Right Column: Detailed Info */}
                <div className="col-span-2 space-y-6">
                    {/* Official Information */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
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
                    <div className="bg-white rounded-lg shadow-sm p-6">
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
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 uppercase">LGA</label>
                                    <p className="text-gray-900 font-medium mt-1">
                                        {user.staffProfile?.lga || 'N/A'}
                                    </p>
                                </div>
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
