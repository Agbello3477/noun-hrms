'use client';

import { useEffect, useState } from 'react';
import { Search, Plus, ChevronRight } from 'lucide-react';
import api from '../../../../lib/api';
import AddStaffModal from '../../../../components/dashboard/AddStaffModal';
import Link from 'next/link';

interface Staff {
    id: string;
    name: string;
    email: string;
    role: string;
    staffProfile?: {
        department: string;
        rank: string;
        unit?: { name: string };
        studyCenter?: { name: string };
        leaves?: any[];
    };
}

export default function UnitStaffPage() {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);

    const fetchUnitStaff = async () => {
        try {
            const response = await api.get('/api/staff/unit');
            setStaffList(response.data);
        } catch (error) {
            console.error('Failed to fetch unit staff', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUnitStaff();
    }, []);

    const filteredStaff = staffList.filter((staff) =>
        staff.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">My Unit Staff</h1>
                    <p className="text-sm text-gray-500">View staff members in your Unit or Study Center</p>
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
                        placeholder="Search staff..."
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
                                <th className="px-6 py-4">Unit / Center</th>
                                <th className="px-6 py-4">Rank</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                        Loading staff data...
                                    </td>
                                </tr>
                            ) : filteredStaff.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                        No staff members found in your unit.
                                    </td>
                                </tr>
                            ) : (
                                filteredStaff.map((staff) => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);

                                    const parseUTCDateToLocal = (dateInput: any) => {
                                        if (!dateInput) return new Date(0);
                                        const isoString = typeof dateInput === 'string' ? dateInput : new Date(dateInput).toISOString();
                                        const parts = isoString.split('T')[0].split('-');
                                        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                    };

                                    const isOnLeave = staff.staffProfile?.status === 'ON_LEAVE';

                                    return (
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
                                                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                                                    {staff.role.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {staff.staffProfile?.unit?.name || staff.staffProfile?.studyCenter?.name || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {staff.staffProfile?.rank || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                                                    isOnLeave ? 'bg-orange-50 text-orange-700 border border-orange-100 animate-pulse' : 'bg-green-50 text-green-750 border border-green-100'
                                                }`}>
                                                    {isOnLeave ? 'On Leave' : 'Active'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    href={`/dashboard/staff/${staff.id}`}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                                                >
                                                    Manage Profile <ChevronRight size={14} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <AddStaffModal
                    onClose={() => setShowModal(false)}
                    onSuccess={fetchUnitStaff}
                />
            )}
        </div>
    );
}
