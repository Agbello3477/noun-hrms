'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Star, MessageSquare, ChevronRight, X } from 'lucide-react';
import api from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';

export default function UnitAperReview() {
    const { user } = useAuth();
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSession, setSelectedSession] = useState('');
    const [forms, setForms] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [reviewForm, setReviewForm] = useState<any>(null);
    const [supervisorScores, setSupervisorScores] = useState<any>({});
    const [supervisorComments, setSupervisorComments] = useState('');

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const { data } = await api.get('/api/aper/hr/sessions');
                setSessions(data);
                if (data.length > 0) setSelectedSession(data[0].id);
            } catch (error) {
                console.error(error);
            }
        };
        fetchSessions();
    }, []);

    useEffect(() => {
        if (!selectedSession || !user?.staffProfile?.unitId) return;

        const fetchForms = async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/api/aper/hr/forms?sessionId=${selectedSession}&unitId=${user?.staffProfile?.unitId}`);
                setForms(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchForms();
    }, [selectedSession, user?.staffProfile?.unitId]);

    const handleOpenReview = (form: any) => {
        setReviewForm(form);
        setSupervisorScores(form.scores || {}); // Start with staff scores as template? Or empty
        setSupervisorComments(form.comments?.supervisor || '');
    };

    const submitReview = async () => {
        try {
            await api.put(`/api/aper/hr/review/${reviewForm.id}`, {
                supervisorScores,
                supervisorComments: {
                    ...reviewForm.comments,
                    supervisor: supervisorComments
                },
                status: 'REVIEWED'
            });
            alert('Review submitted successfully');
            setReviewForm(null);
            // Refresh
            const { data } = await api.get(`/api/aper/hr/forms?sessionId=${selectedSession}&unitId=${user?.staffProfile?.unitId}`);
            setForms(data);
        } catch (error) {
            alert('Failed to submit review');
        }
    };

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800">Unit Appraisal Review</h1>
                <p className="text-gray-500">Review and score appraisals for your unit staff</p>
            </div>

            <div className="mb-6 flex gap-4 items-center">
                <label className="font-medium text-gray-700">Appraisal Session:</label>
                <select
                    className="border rounded p-2 bg-white"
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                >
                    {sessions.map(s => (
                        <option key={s.id} value={s.id}>{s.title} ({s.year})</option>
                    ))}
                </select>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Staff Name</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Staff ID</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-nounGreen" /></td></tr>
                        ) : forms.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-500">No appraisal forms found for this session.</td></tr>
                        ) : (
                            forms.map(form => (
                                <tr key={form.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{form.staff.user.name}</td>
                                    <td className="px-6 py-4 text-gray-500">{form.staff.staffId}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                            form.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                                            form.status === 'REVIEWED' ? 'bg-green-100 text-green-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {form.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleOpenReview(form)}
                                            className="text-nounGreen hover:text-green-800 font-bold flex items-center justify-end gap-1 ml-auto"
                                        >
                                            Review <ChevronRight size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Review Modal */}
            {reviewForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b sticky top-0 bg-white flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold">Review Appraisal</h2>
                                <p className="text-sm text-gray-500">{reviewForm.staff.user.name} - {reviewForm.staff.staffId}</p>
                            </div>
                            <button onClick={() => setReviewForm(null)} className="p-2 hover:bg-gray-100 rounded-full"><X /></button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-2">
                                    <MessageSquare size={18} /> Staff Self-Assessment
                                </h3>
                                <p className="text-sm text-blue-900 italic">"{reviewForm.comments?.staff || 'No comments provided'}"</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-gray-800 mb-4 border-b pb-1">Supervisor Scoring</h3>
                                <div className="space-y-4">
                                    {['Job Knowledge', 'Quality of Work', 'Productivity', 'Dependability', 'Initiative'].map(kpi => (
                                        <div key={kpi} className="flex justify-between items-center">
                                            <span className="text-sm font-medium">{kpi}</span>
                                            <div className="flex gap-2">
                                                {[1, 2, 3, 4, 5].map(score => (
                                                    <button
                                                        key={score}
                                                        onClick={() => setSupervisorScores({ ...supervisorScores, [kpi]: score })}
                                                        className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition ${
                                                            supervisorScores[kpi] === score 
                                                            ? 'bg-nounGreen text-white shadow-md scale-110' 
                                                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                        }`}
                                                    >
                                                        {score}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="font-bold text-gray-800 mb-2">Supervisor Comments</h3>
                                <textarea
                                    className="w-full border rounded-lg p-3 h-32 focus:ring-2 focus:ring-nounGreen focus:border-transparent outline-none"
                                    placeholder="Enter your assessment and feedback..."
                                    value={supervisorComments}
                                    onChange={(e) => setSupervisorComments(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setReviewForm(null)} className="px-4 py-2 text-gray-600 font-medium">Cancel</button>
                            <button
                                onClick={submitReview}
                                className="px-6 py-2 bg-nounGreen text-white font-bold rounded-lg hover:bg-green-800 flex items-center gap-2"
                            >
                                <CheckCircle size={18} /> Submit Review
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
