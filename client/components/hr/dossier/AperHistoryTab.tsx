'use client';

import { useState, useEffect } from 'react';
import { Target } from 'lucide-react';
import api from '../../../lib/api';

export default function AperHistoryTab({ staffId }: { staffId: string }) {
    const [forms, setForms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAper = async () => {
            try {
                // If API doesn't exist, this will naturally return empty or error which is handled
                const { data } = await api.get(`/api/aper/forms?staffId=${staffId}`);
                setForms(data || []);
            } catch (error) {
                console.log("No APER forms found or endpoint missing");
            } finally {
                setLoading(false);
            }
        };
        fetchAper();
    }, [staffId]);

    if (loading) return <div className="p-8 text-center animate-pulse">Loading performance records...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Target size={20} className="text-nounGreen" /> APER / Appraisals
                </h3>
            </div>

            {forms.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <Target className="mx-auto h-12 w-12 text-gray-400 mb-3 opacity-50" />
                    <p className="text-gray-500 font-medium">No APER records found.</p>
                    <p className="text-gray-400 text-sm mt-1">Performance appraisals will appear here once submitted.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {forms.map((f) => (
                        <div key={f.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-gray-900">{f.session?.title || 'Annual Appraisal'}</h4>
                                    <p className="text-xs text-gray-500 mt-1">Submitted: {new Date(f.createdAt).toLocaleDateString()}</p>
                                </div>
                                <span className={`px-2 py-1 text-xs font-bold rounded ${f.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {f.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
