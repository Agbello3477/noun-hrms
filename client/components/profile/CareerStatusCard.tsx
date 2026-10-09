'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { ShieldCheck, Clock, Award, AlertCircle, FileCheck, CheckCircle2 } from 'lucide-react';

interface CareerStatus {
    confirmationStatus: string;
    probationMonth: number;
    totalProbationMonths: number;
    isConfirmed: boolean;
    activeBond: {
        id: string;
        trainingType: string;
        bondEndDate: string;
        remainingMonths: number;
        remainingFormatted: string;
    } | null;
    deferredLeavesCount: number;
    maxAllowedDeferredLeaves: number;
    isDisciplinarySuspended: boolean;
    isDisciplinaryInterdicted: boolean;
}

export default function CareerStatusCard() {
    const [status, setStatus] = useState<CareerStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/api/v1/staff/me/career-status')
            .then(res => setStatus(res.data))
            .catch(err => console.error('Failed to load career status', err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-2">
                    <div className="h-8 bg-slate-100 rounded"></div>
                    <div className="h-8 bg-slate-100 rounded"></div>
                </div>
            </div>
        );
    }

    if (!status) return null;

    const isProbation = status.confirmationStatus === 'ON_PROBATION' || status.confirmationStatus === 'PROBATION_EXTENDED';
    const isTerminationRecommended = status.confirmationStatus === 'TERMINATION_RECOMMENDED';

    return (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                    <Award size={18} className="text-[#006533]" />
                    <h3 className="text-sm font-bold text-slate-900">Career & Statutory Service Status</h3>
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Official Record
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Confirmation Badge */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 mb-1">Appointment Status</span>
                    {status.isConfirmed ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/80 text-[#006533] text-xs font-bold w-fit">
                            <CheckCircle2 size={14} />
                            Confirmed Appointment
                        </div>
                    ) : isTerminationRecommended ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-xs font-bold w-fit">
                            <AlertCircle size={14} />
                            Termination Review
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold w-fit">
                            <Clock size={14} />
                            On Probation (Mo {status.probationMonth} of {status.totalProbationMonths})
                        </div>
                    )}
                </div>

                {/* 2. Training Bond Status */}
                {status.activeBond ? (
                    <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 flex flex-col justify-between">
                        <span className="text-[11px] font-semibold text-amber-800 mb-1">Active Training Bond</span>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-200/80 text-amber-950 text-xs font-bold w-fit">
                            <ShieldCheck size={14} className="text-amber-700" />
                            {status.activeBond.remainingFormatted}
                        </div>
                    </div>
                ) : (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col justify-between">
                        <span className="text-[11px] font-semibold text-slate-500 mb-1">Training Service Bond</span>
                        <span className="text-xs font-semibold text-slate-600">No active bond obligations</span>
                    </div>
                )}

                {/* 3. Leave Deferment Meter */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 mb-1">Statutory Leave Deferment</span>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200/80 text-xs font-bold w-fit">
                        <FileCheck size={14} />
                        Deferred: {status.deferredLeavesCount} / {status.maxAllowedDeferredLeaves} Maximum
                    </div>
                </div>
            </div>

            {/* Disciplinary Notice if any */}
            {(status.isDisciplinarySuspended || status.isDisciplinaryInterdicted) && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-900 font-medium">
                    <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                    <span>
                        Staff dossier currently under official {status.isDisciplinarySuspended ? 'Suspension' : 'Interdiction'} sanction with statutory 50% emolument withholding.
                    </span>
                </div>
            )}
        </div>
    );
}
