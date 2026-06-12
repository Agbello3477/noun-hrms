'use client';

import { useState, useEffect } from 'react';
import api from '../../../../lib/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { FileText, AlertCircle, Upload, CheckCircle } from 'lucide-react';
import RichTextEditor from '../../../../components/dashboard/RichTextEditor';

export default function SabbaticalPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [eligibility, setEligibility] = useState<{ eligible: boolean; yearsServed: number; message: string } | null>(null);
    const [loading, setLoading] = useState(true);

    // Form State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const checkEligibility = async () => {
            try {
                const { data } = await api.get('/api/academic/sabbatical/eligibility');
                setEligibility(data);
            } catch (err) {
                console.error('Eligibility check failed', err);
            } finally {
                setLoading(false);
            }
        };
        checkEligibility();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            if (!file) {
                setError('Please upload your Research Plan document.');
                setSubmitting(false);
                return;
            }

            // 1. Upload Document first (using our Document API)
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'OTHER'); // Or specific types if defined
            formData.append('title', 'Sabbatical Research Plan');
            formData.append('accessLevel', 'RESTRICTED');

            const uploadRes = await api.post('/api/documents/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const documentUrl = uploadRes.data.url;

            // 2. Submit Leave Request (saving with raw HTML format link)
            await api.post('/api/leaves/apply', {
                type: 'SABBATICAL', // Must match backend enum
                startDate,
                endDate,
                reason: reason + `<br/><br/><a href="${documentUrl}" target="_blank" class="text-blue-600 underline font-semibold">[Attached Research Plan]</a>`
            });

            router.push('/dashboard/leaves'); // Redirect to listing

        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to submit application');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Checking eligibility...</div>;

    if (!eligibility?.eligible) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-lg text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-red-700 mb-2">Not Eligible for Sabbatical</h2>
                <p className="text-red-700">{eligibility?.message}</p>
                <button
                    onClick={() => router.back()}
                    className="mt-6 px-4 py-2 bg-white border border-red-300 rounded-md text-red-700 hover:bg-red-50"
                >
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <FileText size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Apply for Sabbatical</h1>
                    <p className="text-sm text-gray-500">Academic Research Leave Application</p>
                </div>
            </div>

            <div className="bg-green-50 p-4 rounded-md flex items-center gap-2 text-green-800 text-sm">
                <CheckCircle size={16} />
                <span>You are eligible! Years of Service: <strong>{eligibility.yearsServed} years</strong></span>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Start Date</label>
                            <input type="date" required className="w-full p-2 border rounded"
                                value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">End Date</label>
                            <input type="date" required className="w-full p-2 border rounded"
                                value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Research Topic / Abstract</label>
                        <RichTextEditor
                            value={reason}
                            onChange={setReason}
                            placeholder="Briefly describe your research goals..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Research Plan (PDF/Docx)</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                            <input
                                type="file"
                                id="file-upload"
                                className="hidden"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                accept=".pdf,.doc,.docx"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                <Upload className="text-gray-400" size={32} />
                                <span className="text-sm text-gray-600">
                                    {file ? file.name : 'Click to upload Research Plan'}
                                </span>
                            </label>
                        </div>
                    </div>

                    {error && <div className="text-red-600 text-sm">{error}</div>}

                    <button
                        type="submit"
                        disabled={submitting}
                        className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${submitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        {submitting ? 'Submitting Application...' : 'Submit Sabbatical Request'}
                    </button>
                </form>
            </div>
        </div>
    );
}
