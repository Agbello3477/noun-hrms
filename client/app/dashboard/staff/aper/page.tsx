'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import OfficialAperForm from '../../../../components/aper/OfficialAperForm';

export default function StaffAperPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [activeSession, setActiveSession] = useState<any>(null);
    const [form, setForm] = useState<any>(null);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                // Check active APER session
                const sessionRes = await api.get('/api/aper/sessions/active');
                setActiveSession(sessionRes.data);

                // Get existing APER form draft if available
                try {
                    const formRes = await api.get('/api/aper/my-form');
                    if (formRes.data.form) {
                        setForm(formRes.data.form);
                    }
                } catch (e) {
                    // No form yet, start new draft
                }

            } catch (err: any) {
                if (err.response?.status === 404) {
                    setError('No active appraisal session open at this time.');
                } else {
                    setError('Failed to load APER appraisal session data.');
                }
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleSubmitAper = async (formData: any, isDraft = true) => {
        if (!activeSession) return;
        setIsSubmitting(true);

        try {
            await api.post('/api/aper/form', {
                sessionId: activeSession.id,
                scores: formData.responsibilitiesTable,
                comments: { 
                    staff: formData.page3,
                    page1: formData.page1,
                    page2: formData.page2,
                    qualifications: formData.qualifications
                },
                status: isDraft ? 'DRAFT' : 'SUBMITTED'
            });

            alert(isDraft ? 'APER Form draft saved successfully.' : 'APER Performance Evaluation Report submitted successfully!');
            if (!isDraft) {
                router.push('/dashboard');
            }
        } catch (error: any) {
            console.error('Failed to submit APER:', error);
            alert(error.response?.data?.message || 'Failed to submit APER form.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (error || !activeSession) {
        return (
            <div className="p-8 max-w-2xl mx-auto text-center">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 shadow-sm">
                    <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4 animate-bounce" />
                    <h2 className="text-xl font-bold text-slate-800 mb-2">APER Appraisal Window Closed</h2>
                    <p className="text-sm text-slate-600 font-medium">
                        There is currently no active Annual Performance Evaluation Report session open for submission.
                        Please check back during the official appraisal cycle or contact Registry / HR.
                    </p>
                </div>
            </div>
        );
    }

    if (form?.status === 'SUBMITTED' || form?.status === 'REVIEWED' || form?.status === 'COMPLETED') {
        return (
            <div className="p-8 max-w-2xl mx-auto text-center">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 shadow-sm">
                    <CheckCircle className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-900 mb-2">APER Report Submitted</h2>
                    <p className="text-sm text-slate-600 font-medium">
                        You have successfully submitted your Annual Performance Evaluation Report for the <strong>{activeSession.year}</strong> appraisal cycle.
                        Your Head of Department (HOD) / Reporting Officer will review your Part 2 assessment.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
            <OfficialAperForm
                mode="STAFF"
                session={activeSession}
                profile={user?.staffProfile || {}}
                initialData={form?.comments || undefined}
                onSubmit={handleSubmitAper}
                isSubmitting={isSubmitting}
            />
        </div>
    );
}
