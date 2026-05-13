'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Building, MapPin, Calendar, Shield } from 'lucide-react';
import api from '../../../../../lib/api';
import DigitalDossier from '../../../../../components/dashboard/DigitalDossier';

export default function StaffDossierPage() {
    const { id } = useParams();
    const router = useRouter();
    const [staff, setStaff] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchStaff = async () => {
            if (!id) return;
            try {
                const { data } = await api.get(`/api/registry/files/${id}`);
                setStaff(data);
            } catch (err: any) {
                setError('Failed to load staff details. ' + (err.response?.data?.message || ''));
            } finally {
                setLoading(false);
            }
        };

        fetchStaff();
    }, [id]);

    if (loading) return <div className="p-8 text-center">Loading Staff Dossier...</div>;

    if (error) return (
        <div className="p-8">
            <button onClick={() => router.back()} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
                <ArrowLeft className="mr-2" size={20} /> Back
            </button>
            <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
                {error}
            </div>
        </div>
    );

    if (!staff) return null;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <button onClick={() => router.back()} className="mb-6 flex items-center text-gray-500 hover:text-nounGreen transition-colors">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Registry
            </button>

            {/* Staff Header Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-6">
                    <div className="flex items-start gap-4">
                        <div className="h-16 w-16 bg-nounGreen/10 rounded-full flex items-center justify-center text-nounGreen font-bold text-2xl border border-nounGreen/20">
                            {staff.name?.charAt(0) || 'S'}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{staff.name}</h1>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">{staff.staffId || 'NO ID'}</span>
                                <span className="flex items-center gap-1"><Shield size={14} className="text-nounGreen" /> {staff.role}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${staff.userId ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {staff.userId ? 'Active Account' : 'Pending Activation'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-600 border-l pl-6 border-gray-100">
                        <div className="flex items-center gap-2">
                            <Building size={16} className="text-gray-400" />
                            <span className="font-medium">{staff.unit?.name || 'Unassigned Unit'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-gray-400" />
                            <span>{staff.studyCenter?.name || staff.studyCenter?.code || 'HQ'}</span>
                        </div>
                        <div className="flex items-center gap-2 col-span-2">
                            <Calendar size={16} className="text-gray-400" />
                            <span>Created: {new Date(staff.createdAt).toLocaleDateString()} by {staff.createdBy?.name || 'System'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Documents Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <DigitalDossier staffId={String(staff.id)} />
            </div>
        </div>
    );
}
