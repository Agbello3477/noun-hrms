'use client';

import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import api from '../../../lib/api';
import AddStaffModal from '../../../components/dashboard/AddStaffModal';

interface Staff {
    id: string;
    name: string;
    email: string;
    role: string;
    staffProfile?: {
        department: string;
        rank: string;
    };
}

export default function StaffPage() {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchStaff = async () => {
        try {
            const response = await api.get('/api/staff');
            setStaffList(response.data);
        } catch (error) {
            console.error('Failed to fetch staff', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const filteredStaff = staffList.filter((staff) =>
        staff.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Staff Management</h1>
                    <p className="text-sm text-gray-500">Manage study center staff and roles</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                >
                    <Plus size={20} />
                    <span>Add New Staff</span>
                </button>
            </div>

            <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search staff by name or email..."
                        className="w-full rounded-md border border-gray-200 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-lg bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-sm font-semibold uppercase text-gray-600">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Department</th>
                                <th className="px-6 py-4">Rank</th>
                                <th className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        Loading staff data...
                                    </td>
                                </tr>
                            ) : filteredStaff.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        No staff members found.
                                    </td>
                                </tr>
                            ) : (
                                filteredStaff.map((staff) => (
                                    <tr key={staff.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">
                                                    {staff.name?.charAt(0) || 'U'}
                                                </div>
                                                <span className="font-medium text-gray-900">{staff.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{staff.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${staff.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                                staff.role === 'STUDY_CENTER_MANAGER' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-green-100 text-green-700'
                                                }`}>
                                                {staff.role.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {staff.staffProfile?.department || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {staff.staffProfile?.rank || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <a
                                                href={`/dashboard/staff/${staff.id}`}
                                                className="text-blue-600 hover:underline"
                                            >
                                                View Profile
                                            </a>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <AddStaffModal
                    onClose={() => setShowModal(false)}
                    onSuccess={fetchStaff}
                />
            )}
        </div>
    );
}
