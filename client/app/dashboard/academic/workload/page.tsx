'use client';

import { useState, useEffect } from 'react';
import api from '../../../../lib/api';
import { BookOpen, Plus, Users, Calendar } from 'lucide-react';

export default function WorkloadPage() {
    const [allocations, setAllocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form Inputs
    const [courseCode, setCourseCode] = useState('');
    const [session, setSession] = useState('2024/2025');
    const [students, setStudents] = useState<number>(0);

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchWorkload();
    }, []);

    const fetchWorkload = async () => {
        try {
            const { data } = await api.get('/api/academic/workload');
            setAllocations(data);
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { data } = await api.post('/api/academic/workload', {
                courseCode, session, students
            });
            // Refresh list
            fetchWorkload();
            setShowForm(false);
            setCourseCode('');
            setStudents(0);
        } catch (error) {
            alert('Failed to allocate course');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading workload...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Users size={24} className="text-blue-600" />
                        Teaching & Supervision
                    </h1>
                    <p className="text-sm text-gray-500">Manage your course allocations and student supervision logic.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus size={18} />
                    Add Allocation
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-blue-100 mb-6 w-full max-w-lg">
                    <h3 className="font-semibold text-gray-800 mb-4">New Allocation</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Course Code</label>
                            <input type="text" required className="w-full p-2 border rounded"
                                placeholder="e.g. NOUN101"
                                value={courseCode} onChange={e => setCourseCode(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Session</label>
                                <input type="text" required className="w-full p-2 border rounded"
                                    value={session} onChange={e => setSession(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Students Count</label>
                                <input type="number" required className="w-full p-2 border rounded"
                                    value={students} onChange={e => setStudents(Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                                {submitting ? 'Saving...' : 'Allocate'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allocations.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white rounded-lg border border-dashed border-gray-300 text-gray-500">
                        No teaching allocations recorded.
                    </div>
                ) : (
                    allocations.map((alloc) => (
                        <div key={alloc.id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                            <div className="flex justify-between items-start mb-2">
                                <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                                    {alloc.course.code}
                                </div>
                                <div className="text-gray-400 text-xs flex items-center gap-1">
                                    <Calendar size={12} /> {alloc.session}
                                </div>
                            </div>
                            <h3 className="font-bold text-gray-800 mb-1">{alloc.course.title}</h3>
                            <p className="text-xs text-gray-500 mb-4">{alloc.course.semester} Semester • {alloc.course.unit} Units</p>

                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                <Users size={16} />
                                <span><strong>{alloc.students}</strong> Students Supervised</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
