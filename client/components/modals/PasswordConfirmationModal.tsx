'use client';

import { useState } from 'react';
import { X, Lock, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';

interface PasswordConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    description?: string;
    actionLabel?: string;
}

export default function PasswordConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    description = 'This action is sensitive. Please enter your password to confirm.',
    actionLabel = 'Confirm',
}: PasswordConfirmationModalProps) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await api.post('/api/auth/validate-password', { password });
            onConfirm();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Incorrect password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                        <Lock className="text-blue-600" size={24} />
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="mb-6 flex items-start gap-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                    <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                    <p>{description}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            type="password"
                            required
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                        />
                    </div>

                    {error && <div className="text-sm text-red-600">{error}</div>}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full rounded-md border border-gray-300 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !password}
                            className="w-full rounded-md bg-red-600 py-2.5 font-bold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                            {loading ? 'Verifying...' : actionLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
