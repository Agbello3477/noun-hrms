'use client';

import { User, Phone, Mail, MapPin, Building, Briefcase, GraduationCap } from 'lucide-react';

export default function BioDataTab({ staff }: { staff: any }) {
    if (!staff) return null;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Bio Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Personal Info */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <User className="text-nounGreen" size={20} /> Personal Information
                    </h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Full Name</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.name}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Email</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.email}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Phone</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.phone || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Gender</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.gender || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">State of Origin</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.stateOfOrigin || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">LGA</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.lga || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 text-sm">Address</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.address || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                {/* Professional Info */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Briefcase className="text-nounGreen" size={20} /> Professional Details
                    </h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Staff ID</span>
                            <span className="col-span-2 font-medium text-gray-900 font-mono">{staff.staffId || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Role</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.role}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Cadre</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.cadre || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Level/Step</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.level || 'N/A'} / {staff.step || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Directorate / Faculty</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.unit?.name || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                            <span className="text-gray-500 text-sm">Study Center</span>
                            <span className="col-span-2 font-medium text-gray-900">{staff.studyCenter?.name || 'HQ'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 text-sm">Date Created</span>
                            <span className="col-span-2 font-medium text-gray-900">{new Date(staff.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
