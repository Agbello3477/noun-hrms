'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, ToggleLeft, ToggleRight, Edit, Loader2 } from 'lucide-react';
import api from '../../../../lib/api';
import { AperSession } from '../../../../types/aper';

export default function HRAperDashboard() {
    const [sessions, setSessions] = useState<AperSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        year: new Date().getFullYear(),
        startDate: '',
        endDate: ''
    });

    const fetchSessions = async () => {
        try {
            const { data } = await api.get('/api/aper/hr/sessions');
            setSessions(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/api/aper/hr/sessions', formData);
            setIsCreating(false);
            fetchSessions();
            alert('Session created successfully');
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to create session');
        }
    };

    const toggleActive = async (session: AperSession) => {
        if (!confirm(`Are you sure you want to ${session.isActive ? 'DEACTIVATE' : 'ACTIVATE'} this session?`)) return;

        try {
            await api.put(`/api/aper/hr/sessions/${session.id}`, {
                isActive: !session.isActive
            });
            fetchSessions();
        } catch (error) {
            alert('Failed to update status');
        }
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Performance Management (APER)</h1>
                    <p className="text-gray-500">Manage Annual Performance Evaluation Report sessions</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="bg-nounGreen text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-green-800 transition shadow-sm"
                >
                    <Plus size={18} /> New Session
                </button>
            </div>

            {/* Create Manual Modal/Form Area */}
            {isCreating && (
                <div className="mb-8 p-6 bg-white rounded-lg border border-green-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <h3 className="font-bold text-lg mb-4 text-gray-800">Create New Appraisal Session</h3>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                            <input
                                type="text"
                                required
                                className="w-full border rounded p-2"
                                placeholder="e.g. 2025 Annual Staff Appraisal"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                            <input
                                type="number"
                                required
                                className="w-full border rounded p-2"
                                value={formData.year}
                                onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                            <input
                                type="date"
                                required
                                className="w-full border rounded p-2"
                                value={formData.startDate}
                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                            <input
                                type="date"
                                required
                                className="w-full border rounded p-2"
                                value={formData.endDate}
                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                            />
                        </div>
                        <div className="col-span-2 flex justify-end gap-2 mt-2">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-nounGreen text-white rounded hover:bg-green-800"
                            >
                                Create Session
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Session</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Year</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Duration</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center">
                                    <Loader2 className="animate-spin mx-auto text-nounGreen" />
                                </td>
                            </tr>
                        ) : sessions.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    No sessions found. Create one to start.
                                </td>
                            </tr>
                        ) : (
                            sessions.map(session => (
                                <tr key={session.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{session.title}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{session.year}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex items-center gap-1">
                                            <Calendar size={14} />
                                            {new Date(session.startDate).toLocaleDateString()} - {new Date(session.endDate).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${session.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            {session.isActive ? 'Active' : 'Closed'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-3">
                                        <button
                                            onClick={() => toggleActive(session)}
                                            className={`${session.isActive ? 'text-green-600' : 'text-gray-400'} hover:text-green-800`}
                                            title="Toggle Status"
                                        >
                                            {session.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                        </button>
                                        <button className="text-blue-600 hover:text-blue-900">
                                            <Edit size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
