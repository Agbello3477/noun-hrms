'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, CheckCircle, Save } from 'lucide-react';
import api from '../../../../lib/api';
import { useRouter } from 'next/navigation';

export default function StaffAperPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [activeSession, setActiveSession] = useState<any>(null);
    const [form, setForm] = useState<any>(null);
    const [error, setError] = useState('');

    // Form State
    const [kpiScores, setKpiScores] = useState<any>({});
    const [comments, setComments] = useState('');

    useEffect(() => {
        const init = async () => {
            try {
                // Check active
                const sessionRes = await api.get('/api/aper/sessions/active');
                setActiveSession(sessionRes.data);

                // Get my form
                try {
                    const formRes = await api.get('/api/aper/my-form');
                    if (formRes.data.form) {
                        setForm(formRes.data.form);
                        setKpiScores(formRes.data.form.scores || {});
                        setComments(formRes.data.form.comments?.staff || '');
                    }
                } catch (e) {
                    // No form yet, ignore
                }

            } catch (err: any) {
                if (err.response?.status === 404) {
                    setError('No active appraisal session found.');
                } else {
                    setError('Failed to load appraisal data.');
                }
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleSubmit = async (isDraft = true) => {
        if (!activeSession) return;

        try {
            await api.post('/api/aper/form', {
                sessionId: activeSession.id,
                scores: kpiScores,
                comments: { staff: comments },
                status: isDraft ? 'DRAFT' : 'SUBMITTED'
            });
            alert(isDraft ? 'Draft saved successfully' : 'Appraisal submitted successfully');
            if (!isDraft) router.push('/dashboard');
        } catch (error) {
            alert('Failed to save appraisal');
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-nounGreen" />
            </div>
        );
    }

    if (error || !activeSession) {
        return (
            <div className="p-8 max-w-2xl mx-auto text-center">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8">
                    <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Appraisal Window Closed</h2>
                    <p className="text-gray-600">
                        There is currently no active Annual Performance Evaluation Report session open for submission.
                        Please check back later or contact HR.
                    </p>
                </div>
            </div>
        );
    }

    if (form?.status === 'SUBMITTED' || form?.status === 'REVIEWED' || form?.status === 'COMPLETED') {
        return (
            <div className="p-8 max-w-2xl mx-auto text-center">
                <div className="bg-green-50 border border-green-200 rounded-lg p-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Appraisal Submitted</h2>
                    <p className="text-gray-600">
                        You have successfully submitted your appraisal for the <strong>{activeSession.year}</strong> session.
                        You will be notified once it has been reviewed.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">{activeSession.title}</h1>
            <p className="text-gray-500 mb-8">
                Please complete all sections of your Annual Performance Evaluation Report.
                You can save as draft at any time.
            </p>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Part A: Key Performance Indicators</h3>
                <p className="text-sm text-gray-500 mb-4">Rate your performance on a scale of 1-5 (1=Poor, 5=Excellent)</p>

                <div className="space-y-4">
                    {['Job Knowledge', 'Quality of Work', 'Productivity', 'Dependability', 'Initiative'].map(kpi => (
                        <div key={kpi} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                            <label className="text-sm font-medium text-gray-700">{kpi}</label>
                            <select
                                className="border rounded p-2"
                                value={kpiScores[kpi] || ''}
                                onChange={e => setKpiScores({ ...kpiScores, [kpi]: parseInt(e.target.value) })}
                            >
                                <option value="">Select Score</option>
                                <option value="1">1 - Poor</option>
                                <option value="2">2 - Fair</option>
                                <option value="3">3 - Good</option>
                                <option value="4">4 - Very Good</option>
                                <option value="5">5 - Excellent</option>
                            </select>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Part B: Self Assessment</h3>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comment on your achievements and challenges during this appraisal period:
                </label>
                <textarea
                    className="w-full border rounded p-3 h-32"
                    placeholder="Enter your comments here..."
                    value={comments}
                    onChange={e => setComments(e.target.value)}
                />
            </div>

            <div className="flex justify-end gap-3">
                <button
                    onClick={() => handleSubmit(true)}
                    className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded hover:bg-gray-200 flex items-center gap-2"
                >
                    <Save size={18} /> Save Draft
                </button>
                <button
                    onClick={() => {
                        if (confirm('Are you sure you want to submit? You cannot edit after submission.')) {
                            handleSubmit(false);
                        }
                    }}
                    className="px-6 py-2 bg-nounGreen text-white font-bold rounded hover:bg-green-800 shadow-sm"
                >
                    Submit Appraisal
                </button>
            </div>
        </div>
    );
}
