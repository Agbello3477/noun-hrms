import React from 'react';
import { Check, X } from 'lucide-react';

interface PasswordStrengthMeterProps {
    password?: string;
}

export default function PasswordStrengthMeter({ password = '' }: PasswordStrengthMeterProps) {
    // Criteria checks
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

    // Calculate score (0 to 4)
    let score = 0;
    if (password) {
        if (hasMinLength) score += 1;
        if (hasUppercase) score += 1;
        if (hasNumber) score += 1;
        if (hasSpecialChar) score += 1;
    }

    // Get color & text based on score
    const getStrengthLabel = () => {
        if (!password) return { label: 'Empty', color: 'bg-gray-200', text: 'text-gray-400' };
        if (score <= 1) return { label: 'Weak 🔴', color: 'bg-red-500', text: 'text-red-500 font-bold' };
        if (score <= 3) return { label: 'Medium 🟡', color: 'bg-amber-500', text: 'text-amber-500 font-bold' };
        return { label: 'Strong 🟢', color: 'bg-emerald-500', text: 'text-emerald-500 font-bold' };
    };

    const strength = getStrengthLabel();

    const criteria = [
        { label: 'At least 8 characters', met: hasMinLength },
        { label: 'At least 1 uppercase letter', met: hasUppercase },
        { label: 'At least 1 number', met: hasNumber },
        { label: 'At least 1 special character', met: hasSpecialChar }
    ];

    return (
        <div className="space-y-3 mt-2 text-xs">
            {/* Visual Strength Bar */}
            <div className="space-y-1">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Password Strength</span>
                    <span className={`text-[10px] uppercase tracking-wide ${strength.text}`}>{strength.label}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1">
                    {Array.from({ length: 4 }).map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-full flex-1 transition-colors duration-300 ${
                                idx < score ? strength.color : 'bg-slate-200'
                            }`}
                        />
                    ))}
                </div>
            </div>

            {/* Criteria List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                {criteria.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 py-0.5 text-gray-500 font-medium select-none">
                        {item.met ? (
                            <Check size={12} className="text-emerald-500 stroke-[3px]" />
                        ) : (
                            <X size={12} className="text-gray-300 stroke-[3px]" />
                        )}
                        <span className={item.met ? 'text-gray-700' : 'text-gray-400'}>
                            {item.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
