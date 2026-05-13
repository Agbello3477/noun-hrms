'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { FileText, Plus, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';

interface FileRequest {
    id: string;
    documentType: string;
    purpose: string;
    urgency: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
    adminComment?: string;
}

export default function FileRequestPage() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<FileRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [docType, setDocType] = useState('Personal File');
    const [purpose, setPurpose] = useState('');
    const [urgency, setUrgency] = useState('MEDIUM');
    const [submitting, setSubmitting] = useState(false);

    const fetchRequests = async () => {
        try {
            const res = await api.get('/api/file-requests/my');
            setRequests(res.data);
        } catch (error) {
            console.error('Failed to fetch requests', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/api/file-requests', {
                documentType: docType,
                purpose,
                urgency
            });
            setShowModal(false);
            setPurpose('');
            fetchRequests();
        } catch (error) {
            alert('Failed to submit request');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle size={12} className="mr-1" /> Approved</span>;
            case 'REJECTED': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle size={12} className="mr-1" /> Rejected</span>;
            default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock size={12} className="mr-1" /> Pending</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">File Requests</h1>
                    <p className="text-sm text-gray-500">Request access to official files or documents from Registry.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                    <Plus size={18} /> New Request
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Urgency</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {requests.map(req => (
                            <tr key={req.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{req.documentType}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{req.purpose}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className={`px-2 py-1 rounded text-xs ${req.urgency === 'HIGH' ? 'bg-red-50 text-red-700 font-bold' : 'text-gray-600'
                                        }`}>{req.urgency}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(req.status)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(req.createdAt).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                        {requests.length === 0 && !loading && (
                            <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">No requests found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Request File Access</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Document Type</label>
                                <select
                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                    value={docType}
                                    onChange={e => setDocType(e.target.value)}
                                >
                                    <option value="Personal File">Personal File (Open)</option>
                                    <option value="Confidential File">Confidential File</option>
                                    <option value="Service Record">Service Record</option>
                                    <option value="Gazette">Gazette / Promotion</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Purpose</label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Reason for request..."
                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                    value={purpose}
                                    onChange={e => setPurpose(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Urgency</label>
                                <select
                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                    value={urgency}
                                    onChange={e => setUrgency(e.target.value)}
                                >
                                    <option value="LOW">Low</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HIGH">High</option>
                                </select>
                            </div>
                            <div className="flex gap-2 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                                <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                                    {submitting ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
