'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { FileText, Plus, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import { useRouter } from 'next/navigation';

interface FileRequest {
    id: string;
    documentType?: string;
    purpose?: string;
    reason?: string;
    urgency?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
    adminComment?: string;
    staff?: {
        surname: string;
        otherNames: string;
        staffId: string;
    };
}

function parseReason(reason: string | null | undefined) {
    if (!reason) return { purpose: 'N/A', documentType: 'Personal File', urgency: 'MEDIUM' };
    
    if (reason.includes('|')) {
        const parts = reason.split('|');
        let purpose = '';
        let documentType = 'Personal File';
        let urgency = 'MEDIUM';
        
        parts.forEach(part => {
            const splitIndex = part.indexOf(':');
            if (splitIndex !== -1) {
                const key = part.substring(0, splitIndex).trim();
                const val = part.substring(splitIndex + 1).trim();
                if (key === 'Reason') {
                    purpose = val;
                } else if (key === 'Document Type') {
                    documentType = val;
                } else if (key === 'Urgency') {
                    urgency = val;
                }
            }
        });
        
        return { purpose: purpose || 'N/A', documentType, urgency };
    }
    
    return { purpose: reason, documentType: 'Personal File', urgency: 'MEDIUM' };
}

export default function FileRequestPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [requests, setRequests] = useState<FileRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [docType, setDocType] = useState('Personal File');
    const [purpose, setPurpose] = useState('');
    const [urgency, setUrgency] = useState('MEDIUM');
    const [submitting, setSubmitting] = useState(false);

    // Staff Selection State
    const [staffList, setStaffList] = useState<any[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [staffSearch, setStaffSearch] = useState('');

    const fetchRequests = async () => {
        try {
            const res = await api.get('/api/file-requests');
            setRequests(res.data);
        } catch (error) {
            console.error('Failed to fetch requests', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStaff = async () => {
        try {
            const res = await api.get('/api/staff');
            setStaffList(res.data || []);
        } catch (error) {
            console.error('Failed to fetch staff list', error);
        }
    };

    useEffect(() => {
        if (user && user.role === 'STAFF') {
            router.push('/dashboard');
        } else {
            fetchRequests();
            fetchStaff();
        }
    }, [user, router]);

    if (user && user.role === 'STAFF') {
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStaffId) {
            alert('Please select a staff member');
            return;
        }
        setSubmitting(true);
        try {
            const finalReason = `Reason: ${purpose} | Document Type: ${docType} | Urgency: ${urgency}`;
            await api.post('/api/file-requests/request', {
                staffId: selectedStaffId,
                reason: finalReason
            });
            setShowModal(false);
            setPurpose('');
            setSelectedStaffId('');
            setStaffSearch('');
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff Member</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request Details / Purpose</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {requests.map(req => {
                            const parsed = parseReason(req.reason || req.purpose);
                            return (
                                <tr key={req.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {req.staff ? `${req.staff.surname} ${req.staff.otherNames}` : 'Unknown Staff'}
                                        {req.staff?.staffId && <span className="text-xs text-gray-400 block font-normal mt-0.5">ID: {req.staff.staffId}</span>}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-550">
                                        <div className="font-semibold text-gray-900">{parsed.documentType}</div>
                                        <div className="text-xs text-gray-650 mt-0.5">{parsed.purpose}</div>
                                        <div className="mt-1">
                                            <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                                parsed.urgency === 'HIGH' ? 'bg-red-50 text-red-700' :
                                                parsed.urgency === 'MEDIUM' ? 'bg-yellow-50 text-yellow-750' :
                                                'bg-gray-55 text-gray-600'
                                            }`}>{parsed.urgency} Urgency</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(req.status)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(req.createdAt).toLocaleDateString()}
                                    </td>
                                </tr>
                            );
                        })}
                        {requests.length === 0 && !loading && (
                            <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-gray-500">No requests found.</td>
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
                                <label className="block text-sm font-medium text-gray-700">Search Staff</label>
                                <input
                                    type="text"
                                    placeholder="Filter by name or staff ID..."
                                    value={staffSearch}
                                    onChange={e => setStaffSearch(e.target.value)}
                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-sm outline-none mb-1"
                                />
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2 mb-1">Select Staff Member *</label>
                                <select
                                    required
                                    className="block w-full border border-gray-300 rounded-md p-2"
                                    value={selectedStaffId}
                                    onChange={e => setSelectedStaffId(e.target.value)}
                                >
                                    <option value="">-- Choose Staff Member --</option>
                                    {staffList
                                        .filter(s => {
                                            const query = staffSearch.toLowerCase().trim();
                                            if (!query) return true;
                                            const name = (s.name || '').toLowerCase();
                                            const staffId = (s.staffProfile?.staffId || '').toLowerCase();
                                            const surname = (s.staffProfile?.surname || '').toLowerCase();
                                            const otherNames = (s.staffProfile?.otherNames || '').toLowerCase();
                                            return name.includes(query) || staffId.includes(query) || surname.includes(query) || otherNames.includes(query);
                                        })
                                        .map(s => (
                                            <option key={s.id} value={s.staffProfile?.id}>
                                                {s.name} ({s.staffProfile?.staffId || 'No ID'})
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Purpose / Reason for Request</label>
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
                                <button type="button" onClick={() => { setShowModal(false); setStaffSearch(''); setSelectedStaffId(''); }} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                                <button type="submit" disabled={submitting || !selectedStaffId} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm">
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
