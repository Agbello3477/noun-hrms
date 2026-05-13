'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, User, Phone, MapPin, Briefcase } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '../../../../lib/api';
import DigitalDossier from '../../../../components/dashboard/DigitalDossier';

interface StaffDetail {
    id: string;
    name: string;
    email: string;
    role: string;
    staffProfile?: {
        // Add any other props you need
        id: string; // StaffProfile ID needed for Dossier
        department: string;
        rank: string;
        phone: string;
        address: string;
    }
}

export default function StaffDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [staff, setStaff] = useState<StaffDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // We need an endpoint to get single staff. 
        // For now we might not have it in staff.routes.ts, checking implementation plan...
        // The plan didn't explicitly make GET /:id, so I might need to add it or fake it by filtering getAll (inefficient).
        // Let's quickly add GET /:id to backend logic in next step if it fails.

        // Assuming we will implement GET /api/staff/:id
        const fetchStaff = async () => {
            try {
                const { data } = await api.get(`/api/staff/${params.id}`);
                setStaff(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        fetchStaff();
    }, [params.id]);

    if (loading) return <div className="p-8">Loading staff profile...</div>;
    if (!staff) return <div className="p-8">Staff member not found.</div>;

    return (
        <div>
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6"
            >
                <ArrowLeft size={20} /> Back to List
            </button>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-blue-600 h-32 w-full"></div>
                <div className="px-8 pb-8 relative">
                    <div className="absolute -top-12 left-8 h-24 w-24 bg-white rounded-full p-1 shadow-md">
                        <div className="h-full w-full bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-3xl">
                            {staff.name.charAt(0)}
                        </div>
                    </div>

                    <div className="mt-14 flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{staff.name}</h1>
                            <p className="text-gray-500">{staff.email}</p>
                        </div>
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                            {staff.role.replace(/_/g, ' ')}
                        </span>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-center gap-3 text-gray-700">
                            <Briefcase className="text-gray-400" size={20} />
                            <div>
                                <p className="text-xs text-gray-400">Department & Rank</p>
                                <p className="font-medium">{staff.staffProfile?.department || 'N/A'} • {staff.staffProfile?.rank || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-gray-700">
                            <Phone className="text-gray-400" size={20} />
                            <div>
                                <p className="text-xs text-gray-400">Phone</p>
                                <p className="font-medium">{staff.staffProfile?.phone || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-gray-700">
                            <MapPin className="text-gray-400" size={20} />
                            <div>
                                <p className="text-xs text-gray-400">Address</p>
                                <p className="font-medium">{staff.staffProfile?.address || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Digital Dossier Module */}
            {staff.staffProfile?.id && (
                <DigitalDossier staffId={staff.staffProfile.id} />
            )}
        </div>
    );
}
