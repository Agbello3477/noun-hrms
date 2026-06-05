'use client';

import { useEffect, useState } from 'react';
import { Search, FileText, ArrowRight, UserCheck, X, Download } from 'lucide-react';
import api from '../../../../lib/api';
import DigitalDossier from '../../../../components/dashboard/DigitalDossier';

interface Staff {
    id: string; // User UUID
    name: string;
    email: string;
    role: string;
    staffProfile?: {
        id: string; // Profile UUID
        staffId: string; // ID code like N001
        rank: string;
        phone: string;
        unit?: { name: string };
        studyCenter?: { name: string };
    };
}

export default function TransferredStaffPage() {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

    const fetchTransferredStaff = async () => {
        try {
            const response = await api.get('/api/staff/transferred');
            setStaffList(response.data);
        } catch (error) {
            console.error('Failed to fetch transferred staff', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransferredStaff();
    }, []);

    const filteredStaff = staffList.filter((staff) =>
        staff.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.staffProfile?.staffId?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header section with glassmorphic style */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 text-white shadow-xl">
                <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
                <div className="relative z-10 space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold backdrop-blur-md border border-indigo-500/30">
                        <UserCheck size={14} />
                        Dossier Reference Portal
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Transferred Staff Directory</h1>
                    <p className="text-indigo-200/80 max-w-2xl text-sm sm:text-base">
                        Access reference records and digital dossiers of staff members previously deployed in your unit or study center.
                    </p>
                </div>
            </div>

            {/* Statistics and Search Panel */}
            <div className="grid gap-6 md:grid-cols-4">
                <div className="md:col-span-3 rounded-xl bg-white p-4 shadow-sm border border-slate-100 flex items-center">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by name or Staff ID..."
                            className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
                    <span className="text-2xl font-black text-indigo-600">{staffList.length}</span>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Transferred Out</span>
                </div>
            </div>

            {/* Staff list card directory */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <th className="px-6 py-4">Staff Member</th>
                                <th className="px-6 py-4">Staff ID</th>
                                <th className="px-6 py-4">Former Rank</th>
                                <th className="px-6 py-4">Current Placement</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                                            <span>Loading reference directories...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredStaff.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center py-6">
                                            <FileText className="h-12 w-12 text-slate-300 mb-2" />
                                            <p className="font-semibold text-slate-700">No transferred staff records found</p>
                                            <p className="text-xs text-slate-400 mt-1">There are no matching former personnel under reference.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredStaff.map((staff) => (
                                    <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 font-bold text-white shadow-sm">
                                                    {staff.name?.charAt(0) || 'U'}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-900">{staff.name}</div>
                                                    <div className="text-xs text-slate-500">{staff.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-600 font-semibold">
                                            {staff.staffProfile?.staffId || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 font-medium">
                                            {staff.staffProfile?.rank || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                                {staff.staffProfile?.unit?.name || staff.staffProfile?.studyCenter?.name || 'Assigned'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedStaff(staff)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-indigo-650 text-white text-xs font-bold transition-all shadow-sm"
                                            >
                                                <span>Reference Dossier</span>
                                                <ArrowRight size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Dossier Reference Modal Overlay */}
            {selectedStaff && selectedStaff.staffProfile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/20">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <FileText size={20} className="text-indigo-600" />
                                    <span>Staff Dossier: {selectedStaff.name}</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    ReadOnly Reference View &bull; Staff ID: {selectedStaff.staffProfile.staffId}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedStaff(null)}
                                className="p-1.5 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Short bio metadata cards */}
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rank / Title</div>
                                    <div className="text-sm font-bold text-slate-800 mt-1">{selectedStaff.staffProfile.rank || '-'}</div>
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact Phone</div>
                                    <div className="text-sm font-bold text-slate-800 mt-1">{selectedStaff.staffProfile.phone || '-'}</div>
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Deploy</div>
                                    <div className="text-sm font-bold text-slate-800 mt-1">
                                        {selectedStaff.staffProfile.unit?.name || selectedStaff.staffProfile.studyCenter?.name || '-'}
                                    </div>
                                </div>
                            </div>

                            {/* Dossier Documents Component */}
                            <div className="border-t border-slate-100 pt-6">
                                <DigitalDossier 
                                    staffId={selectedStaff.staffProfile.id} 
                                    staffName={selectedStaff.name}
                                    readOnly={true}
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end">
                            <button
                                onClick={() => setSelectedStaff(null)}
                                className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-bold text-slate-700 transition-colors shadow-sm"
                            >
                                Close Reference
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
