'use client';

import { useState, useEffect, useMemo } from 'react';
import { DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../../../../lib/api';
import Pagination from '../../../../components/ui/Pagination';

interface PayrollRecord {
    id: string;
    month: string;
    year: number;
    baseSalary: number;
    netPay: number;
    status: string;
    user: { name: string; email: string };
}

export default function AuditPage() {
    const [records, setRecords] = useState<PayrollRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [message, setMessage] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const fetchPending = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/api/payroll/pending');
            setRecords(data);
            // Default select all? Or none.
            setSelectedIds(data.map((r: any) => r.id));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPending();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [records]);

    const paginatedRecords = useMemo(() => {
        return records.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    }, [records, currentPage, pageSize]);

    const totalPages = Math.max(1, Math.ceil(records.length / pageSize));

    const handleApprove = async () => {
        if (selectedIds.length === 0) return;
        try {
            const { data } = await api.post('/api/payroll/approve', { recordIds: selectedIds });
            setMessage(`Success: ${data.message || 'Records have been audited'}`);
            setSelectedIds([]);
            fetchPending();
        } catch (error: any) {
            setMessage(`Error: ${error.response?.data?.message || 'Failed to approve'}`);
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <DollarSign className="text-green-600" /> Bursary Audit Unit
            </h1>

            {message && (
                <div className="mb-4 p-4 bg-blue-100 text-blue-800 rounded">
                    {message}
                </div>
            )}

            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-700">Pending Payroll Batches</h3>
                    <button
                        onClick={handleApprove}
                        disabled={selectedIds.length === 0}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        <CheckCircle size={18} /> Approve Selected ({selectedIds.length})
                    </button>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading records...</div>
                ) : records.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <CheckCircle className="mx-auto h-12 w-12 text-green-200 mb-2" />
                        <p>No pending payroll records found.</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    <input
                                        type="checkbox"
                                        onChange={(e) => setSelectedIds(e.target.checked ? records.map(r => r.id) : [])}
                                        checked={selectedIds.length === records.length && records.length > 0}
                                    />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Pay</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedRecords.map(record => (
                                <tr key={record.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(record.id)}
                                            onChange={() => toggleSelect(record.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">{record.user.name}</div>
                                        <div className="text-sm text-gray-500">{record.user.email}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {record.month} {record.year}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                                        ₦{record.netPay.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                            {record.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!loading && records.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={records.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                    />
                )}
            </div>
        </div>
    );
}
