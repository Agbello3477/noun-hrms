
'use client';

import { useState } from 'react';
import api from '../../../../lib/api';
import { useRouter } from 'next/navigation';

export default function ApplyLeavePage() {
    const router = useRouter();
    const [type, setType] = useState('ANNUAL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg({ type: '', text: '' });

        try {
            await api.post('/api/leaves/apply', {
                type,
                startDate,
                endDate,
                reason
            });
            setMsg({ type: 'success', text: 'Leave Request Submitted Successfully' });
            setTimeout(() => router.push('/dashboard'), 2000);
        } catch (error: any) {
            setMsg({ type: 'error', text: error.response?.data?.message || 'Submission Failed' });
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Apply for Leave</h1>

            <div className="bg-white p-6 rounded-lg shadow-md">
                {msg.text && (
                    <div className={`p-4 mb-4 rounded ${msg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {msg.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                        <select
                            className="w-full border rounded p-2"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                        >
                            <option value="ANNUAL">Annual Leave</option>
                            <option value="CASUAL">Casual Leave</option>
                            <option value="SICK">Sick Leave</option>
                            <option value="MATERNITY">Maternity Leave</option>
                            <option value="STUDY">Study Leave</option>
                            <option value="SABBATICAL">Sabbatical</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                            <input
                                type="date"
                                className="w-full border rounded p-2"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                            <input
                                type="date"
                                className="w-full border rounded p-2"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                        <textarea
                            className="w-full border rounded p-2"
                            rows={4}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required
                            placeholder="Brief reason or handover notes..."
                        ></textarea>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`px-6 py-2 rounded text-white font-medium ${loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {loading ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
