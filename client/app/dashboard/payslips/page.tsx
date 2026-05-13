'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { Download, FileText, Calendar, DollarSign } from 'lucide-react';

export default function PayslipsPage() {
    const { user } = useAuth();
    const [payslips, setPayslips] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPayslips = async () => {
            try {
                const { data } = await api.get('/api/payroll/me');
                setPayslips(data);
            } catch (error) {
                console.error('Failed to fetch payslips', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPayslips();
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN'
        }).format(amount);
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading payslips...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FileText size={24} className="text-blue-600" />
                        My Payslips
                    </h1>
                    <p className="text-sm text-gray-500">View and download your monthly payment records.</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {payslips.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white rounded-lg border border-dashed border-gray-300 text-gray-500">
                        No payslips found available for your account.
                    </div>
                ) : (
                    payslips.map((slip) => (
                        <div key={slip.id} className="bg-white rounded-lg shadow-sm border p-5 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                        <Calendar size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800">{slip.month} {slip.year}</h3>
                                        <p className="text-xs text-gray-500">
                                            {slip.status === 'PAID' ? 'Paid on ' + new Date(slip.paymentDate || slip.updatedAt).toLocaleDateString() : 'Processing'}
                                        </p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${slip.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                    {slip.status}
                                </span>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Basic Salary</span>
                                    <span className="font-medium">{formatCurrency(slip.basicSalary)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Allowances</span>
                                    <span className="font-medium text-green-600">+{formatCurrency(slip.totalAllowances)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Deductions</span>
                                    <span className="font-medium text-red-600">-{formatCurrency(slip.totalDeductions)}</span>
                                </div>
                                <div className="border-t pt-2 flex justify-between font-bold text-gray-900">
                                    <span>Net Pay</span>
                                    <span>{formatCurrency(slip.netPay)}</span>
                                </div>
                            </div>

                            <button className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                                <Download size={16} />
                                Download PDF
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
