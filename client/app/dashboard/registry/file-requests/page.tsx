'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { FileText, Check, X, Clock, Eye, AlertCircle } from 'lucide-react';

interface FileRequest {
    id: string;
    documentType: string;
    purpose: string;
    urgency: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
    requester: {
        id: string;
        name: string;
        email: string;
        staffProfile: {
            staffId: string;
            unit: { name: string };
        }
    };
}

export default function RegistryFileRequestsPage() {
    const [requests, setRequests] = useState<FileRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);

    const fetchRequests = async () => {
        try {
            const res = await api.get('/api/file-requests');
            setRequests(res.data);
        } catch (error) {
            console.error('Error fetching file requests', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
        try {
            await api.put(`/api/file-requests/${id}/${action === 'APPROVE' ? 'approve' : 'reject'}`);
            // Optimistic update
            setRequests(prev => prev.map(req =>
                req.id === id ? { ...req, status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' } : req
            ));
        } catch (error) {
            alert(`Failed to ${action.toLowerCase()} request`);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading requests...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">File Request Gateway</h1>
            <p className="text-sm text-gray-500">Manage incoming file access requests from staff.</p>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requester</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Urgency</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {requests.map(req => (
                            <tr key={req.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{req.requester.name}</div>
                                    <div className="text-xs text-gray-500">{req.requester.staffProfile?.staffId}</div>
                                    <div className="text-xs text-blue-600">{req.requester.staffProfile?.unit?.name}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{req.documentType}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs" title={req.purpose}>{req.purpose}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded text-xs ${req.urgency === 'HIGH' ? 'bg-red-50 text-red-700 font-bold' : 'text-gray-600'
                                        }`}>{req.urgency}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${req.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                            req.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                        }`}>
                                        {req.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {req.status === 'PENDING' && (
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleAction(req.id, 'APPROVE')}
                                                className="text-green-600 hover:text-green-900 bg-green-50 p-1 rounded"
                                                title="Approve"
                                            >
                                                <Check size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleAction(req.id, 'REJECT')}
                                                className="text-red-600 hover:text-red-900 bg-red-50 p-1 rounded"
                                                title="Reject"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    )}
                                    {req.status === 'APPROVED' && (
                                        <span className="text-xs text-gray-400">Action taken</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
