'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Star, MessageSquare, ChevronRight, X } from 'lucide-react';
import api from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';
import OfficialAperForm from '../../../../components/aper/OfficialAperForm';

export default function UnitAperReview() {
    const { user } = useAuth();
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSession, setSelectedSession] = useState('');
    const [forms, setForms] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [reviewForm, setReviewForm] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
    };

    const submitHodReview = async (formData: any, isDraft: boolean) => {
        if (!reviewForm) return;
        setIsSubmitting(true);

        try {
            await api.put(`/api/aper/hr/review/${reviewForm.id}`, {
                supervisorScores: formData.page4?.aspectRatings || {},
                supervisorComments: {
                    ...reviewForm.comments,
                    page4: formData.page4,
                    supervisor: formData.page4?.effectivenessComments || ''
                },
                status: isDraft ? 'DRAFT' : 'REVIEWED'
            });

            alert(isDraft ? 'HOD Assessment draft saved successfully.' : 'Part 2 Reporting Officer APER Review submitted successfully!');
            setReviewForm(null);
            
            // Refresh forms list
            const { data } = await api.get(`/api/aper/hr/forms?sessionId=${selectedSession}&unitId=${user?.staffProfile?.unitId}`);
            setForms(data);
        } catch (error: any) {
            console.error('Failed to submit review:', error);
            alert(error.response?.data?.message || 'Failed to submit HOD review');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Unit APER Appraisal Review</h1>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">Reporting Officer / Head of Department assessment portal</p>
                </div>

                <div className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm">
                    <label className="text-xs font-extrabold text-slate-700">Appraisal Session:</label>
                    <select
                        className="border rounded-xl px-3 py-1.5 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                        value={selectedSession}
                        onChange={(e) => setSelectedSession(e.target.value)}
                    >
                        {sessions.map(s => (
                            <option key={s.id} value={s.id}>{s.title} ({s.year})</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-900 text-white font-extrabold uppercase">
                        <tr>
                            <th className="px-6 py-3.5 text-left">Staff Member</th>
                            <th className="px-6 py-3.5 text-left">Staff ID / Cadre</th>
                            <th className="px-6 py-3.5 text-left">Appraisal Status</th>
                            <th className="px-6 py-3.5 text-right">Part 2 Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {loading ? (
                            <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-emerald-600" /></td></tr>
                        ) : forms.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-medium">No APER appraisal forms submitted for this unit session yet.</td></tr>
                        ) : (
                            forms.map(form => (
                                <tr key={form.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900">{form.staff?.user?.name || 'Staff Member'}</div>
                                        <div className="text-[11px] text-slate-400 font-semibold">{form.staff?.rank || '—'}</div>
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-slate-600">
                                        {form.staff?.staffId || '—'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                                            form.status === 'SUBMITTED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            form.status === 'REVIEWED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                            {form.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleOpenReview(form)}
                                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-sm inline-flex items-center gap-1"
                                        >
                                            <span>Review & Complete Part 2</span>
                                            <ChevronRight size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* HOD Full APER Review Modal */}
            {reviewForm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto border border-slate-200 my-auto">
                        <div className="p-6 border-b sticky top-0 bg-white z-20 flex justify-between items-center shadow-sm">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase">HOD APER Appraisal Review</h2>
                                <p className="text-xs text-slate-500 font-semibold">
                                    Evaluating: <strong className="text-emerald-700">{reviewForm.staff?.user?.name}</strong> ({reviewForm.staff?.staffId})
                                </p>
                            </div>
                            <button 
                                onClick={() => setReviewForm(null)} 
                                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 md:p-6">
                            <OfficialAperForm
                                mode="HOD_REVIEW"
                                session={sessions.find(s => s.id === selectedSession)}
                                profile={reviewForm.staff}
                                initialData={reviewForm.comments || undefined}
                                onSubmit={submitHodReview}
                                isSubmitting={isSubmitting}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
