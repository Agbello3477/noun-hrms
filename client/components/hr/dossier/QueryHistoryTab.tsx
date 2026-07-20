'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import api from '../../../lib/api';

const getIssuerDisplayName = (issuedBy?: any) => {
    if (!issuedBy) return 'Registry';
    const role = issuedBy.role;
    if (['HR_ADMIN', 'SUPER_USER', 'ADMIN', 'VICE_CHANCELLOR'].includes(role)) {
        return 'Registry';
    }
    if (['UNIT_HEAD', 'UNIT_ADMIN', 'DIRECTOR', 'DEAN'].includes(role)) {
        return 'Unit Head';
    }
    if (role === 'STUDY_CENTER_MANAGER') {
        return 'Study Center Director';
    }
    return 'Registry';
};

export default function QueryHistoryTab({ staffId }: { staffId: string }) {
    const [queries, setQueries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQueries = async () => {
            try {
                // If API doesn't exist, this will naturally return empty or error which is handled
                const { data } = await api.get(`/api/queries?staffId=${staffId}`);
                setQueries(data || []);
            } catch (error) {
                console.log("No queries found or endpoint missing");
            } finally {
                setLoading(false);
            }
        };
        fetchQueries();
    }, [staffId]);

    if (loading) return <div className="p-8 text-center animate-pulse">Loading disciplinary records...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <AlertTriangle size={20} className="text-red-500" /> Disciplinary Actions & Queries
                </h3>
            </div>

            {queries.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <AlertTriangle className="mx-auto h-12 w-12 text-gray-400 mb-3 opacity-50" />
                    <p className="text-gray-500 font-medium">Staff record is clean.</p>
                    <p className="text-gray-400 text-sm mt-1">No disciplinary actions or queries have been issued.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {queries.map((q) => (
                        <div key={q.id} className="border border-red-100 bg-red-50/30 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-gray-900">{q.title}</h4>
                                        {!q.copyHR && (
                                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-750 border border-indigo-150 rounded">Internal</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Issued: {new Date(q.createdAt).toLocaleDateString()} by {getIssuerDisplayName(q.issuedBy)}</p>
                                </div>
                                <span className={`px-2 py-1 text-xs font-bold rounded ${q.status === 'OPEN' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {q.status}
                                </span>
                            </div>
                            <div className="mt-3 text-sm text-gray-700 bg-white p-3 rounded border border-red-50">
                                <div dangerouslySetInnerHTML={{ __html: q.content }} className="prose max-w-none text-black" />
                            </div>
                            {q.response && (
                                <div className="mt-3 text-sm text-gray-600 pl-4 border-l-2 border-gray-300">
                                    <span className="font-bold text-gray-800 text-xs">Staff Response:</span>
                                    <p className="mt-1">{q.response}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
