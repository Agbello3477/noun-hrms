'use client';

import { useState } from 'react';
import api from '../../../../lib/api';
import { useRouter } from 'next/navigation';
import { PlayCircle, AlertCircle, CheckCircle } from 'lucide-react';

export default function RunPayrollPage() {
    const router = useRouter();
    const [month, setMonth] = useState(new Date().toLocaleString('default', { month: 'long' })); // e.g., "January"
    const [year, setYear] = useState(new Date().getFullYear());

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    const handleRunPayroll = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const { data } = await api.post('/api/payroll/run', { month, year });
            setResult(data);
        } catch (err: any) {
            console.error('Run Payroll Error:', err);
            setError(err.response?.data?.message || 'Failed to run payroll');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <PlayCircle size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Run Payroll</h1> // Fixed closing tag
                    <p className="text-sm text-gray-500">Generate monthly salaries for all active staff.</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <form onSubmit={handleRunPayroll} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Month</label>
                            <select
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                            >
                                {months.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Year</label>
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                            >
                                {years.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-md flex gap-3 text-sm text-blue-700">
                        <AlertCircle className="shrink-0 mt-0.5" size={16} />
                        <div>
                            <p className="font-semibold">Important Note:</p>
                            <p>This action will calculate salaries for all active staff based on their current Level/Step. It may take a few moments. Existing records for this month will be skipped.</p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        {loading ? 'Processing...' : 'Generate Payroll'}
                    </button>
                </form>
            </div>

            {/* Success/Error Feedback */}
            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {result && (
                <div className="bg-green-50 text-green-700 p-6 rounded-lg space-y-4">
                    <div className="flex items-center gap-2 font-bold text-lg">
                        <CheckCircle size={24} />
                        Payroll Run Completed
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-white p-3 rounded border border-green-200">
                            <span className="block text-gray-500">Processed</span>
                            <span className="font-bold text-xl">{result.details.processed}</span>
                        </div>
                        <div className="bg-white p-3 rounded border border-green-200">
                            <span className="block text-gray-500">Skipped/Failed</span>
                            <span className="font-bold text-xl">{result.details.failed}</span>
                        </div>
                    </div>
                    {result.details.failed > 0 && (
                        <div className="bg-white p-4 rounded border border-green-200 text-sm max-h-40 overflow-y-auto">
                            <p className="font-semibold mb-2">Errors:</p>
                            <ul className="list-disc pl-4 space-y-1 text-red-600">
                                {result.details.errors.map((err: any, idx: number) => (
                                    <li key={idx}>{err.user}: {err.error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <button
                        onClick={() => router.push('/dashboard/payroll')}
                        className="text-green-800 font-medium underline hover:text-green-900"
                    >
                        Return to Dashboard
                    </button>
                </div>
            )}
        </div>
    );
}
