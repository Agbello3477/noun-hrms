'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { DollarSign, BarChart3, ArrowRight, PlayCircle, FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Pagination from '../../../components/ui/Pagination';

import TableSkeleton from '../../../components/ui/TableSkeleton';

export default function PayrollDashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await api.get('/api/payroll/stats');
                setStats(data);
            } catch (error) {
                console.error('Failed to fetch stats', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN'
        }).format(amount || 0);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-xl"></div>
                    <div className="h-10 w-36 bg-slate-200 animate-pulse rounded-xl"></div>
                </div>
                <TableSkeleton rows={5} cols={4} />
            </div>
        );
    }

    // Permissions Check
    if (user?.role !== 'BURSARY' && user?.role !== 'ADMIN' && user?.role !== 'SUPER_USER') {
        return <div className="p-8 text-red-500 text-center">Access Restricted</div>;
    }

    const handleExportIPPIS = async (month: string, year: number) => {
        try {
            const response = await api.post('/api/payroll/export-ippis',
                { month, year },
                { responseType: 'blob' } // Critical for downloading files
            );

            // Create a Blob from the response
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `IPPIS_Export_${month}_${year}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export failed', error);
            alert('Failed to export. Period might not have approved records.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <DollarSign size={24} className="text-blue-600" />
                        Payroll Management
                    </h1>
                    <p className="text-sm text-gray-500">Overview of salary disbursements and wage bill.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleExportIPPIS('January', new Date().getFullYear())} // Example: Export January of current year
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
                    >
                        <FileText size={18} />
                        Export IPPIS
                    </button>
                    <Link
                        href="/dashboard/payroll/run"
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                    >
                        <PlayCircle size={18} />
                        Run Payroll
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-6 md:grid-cols-3">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">YTD Gross Pay</div>
                    <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(stats.reduce((acc, curr) => acc + curr._sum.grossPay, 0))}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">YTD Deductions</div>
                    <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(stats.reduce((acc, curr) => acc + curr._sum.totalDeductions, 0))}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">YTD Net Payout</div>
                    <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(stats.reduce((acc, curr) => acc + curr._sum.netPay, 0))}
                    </div>
                </div>
            </div>

            {/* Monthly Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <BarChart3 size={18} />
                        Monthly Summary ({new Date().getFullYear()})
                    </h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deductions</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Pay</th>
                            <th className="px-6 py-3 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {stats.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    No payroll records found for this year.
                                </td>
                            </tr>
                        ) : (
                            stats.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((monthStat) => (
                                <tr key={monthStat.month} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{monthStat.month}</td>
                                    <td className="px-6 py-4 text-gray-600">{formatCurrency(monthStat._sum.grossPay)}</td>
                                    <td className="px-6 py-4 text-red-600">{formatCurrency(monthStat._sum.totalDeductions)}</td>
                                    <td className="px-6 py-4 text-green-600 font-bold">{formatCurrency(monthStat._sum.netPay)}</td>
                                    <td className="px-6 py-4 text-right flex gap-2 justify-end">
                                        <button
                                            onClick={() => handleExportIPPIS(monthStat.month, new Date().getFullYear())}
                                            className="text-gray-600 hover:text-blue-700 text-xs border rounded px-2 py-1"
                                        >
                                            Export CSV
                                        </button>
                                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">
                                            Details <ArrowRight size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {stats.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={Math.max(1, Math.ceil(stats.length / pageSize))}
                        totalItems={stats.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                        pageSizeOptions={[6, 12, 24]}
                    />
                )}
            </div>
        </div>
    );
}
