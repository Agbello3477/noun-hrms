'use client';

import { useState, useEffect } from 'react';
import api from '../../../../lib/api';
import { BookOpen, Plus, Users, Calendar, Filter } from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';

export default function WorkloadPage() {
    const { user } = useAuth();
    const [allocations, setAllocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Lists for selection
    const [staffList, setStaffList] = useState<any[]>([]);
    const [coursesList, setCoursesList] = useState<any[]>([]);

    // Scoped Filter
    const [selectedFacilitatorId, setSelectedFacilitatorId] = useState('');

    // Form Inputs
    const [formStaffId, setFormStaffId] = useState('');
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [courseCode, setCourseCode] = useState('');
    const [session, setSession] = useState('2024/2025');
    const [students, setStudents] = useState<number>(0);

    const [submitting, setSubmitting] = useState(false);

    const isManager = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_USER' || user?.role === 'ADMIN' ||
                      user?.role === 'STUDY_CENTER_MANAGER' || user?.role === 'UNIT_HEAD' || user?.role === 'UNIT_ADMIN';

    const fetchWorkload = async (staffId?: string) => {
        try {
            setLoading(true);
            const url = staffId ? `/api/academic/workload?staffId=${staffId}` : '/api/academic/workload';
            const { data } = await api.get(url);
            setAllocations(data);
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStaff = async () => {
        try {
            const res = await api.get('/api/staff');
            setStaffList(res.data || []);
        } catch (error) {
            console.error('Failed to fetch staff list', error);
        }
    };

    const fetchCourses = async () => {
        try {
            const res = await api.get('/api/academic/courses');
            setCoursesList(res.data || []);
        } catch (error) {
            console.error('Failed to fetch courses', error);
        }
    };

    useEffect(() => {
        if (user) {
            fetchWorkload(selectedFacilitatorId || undefined);
            if (isManager) {
                fetchStaff();
                fetchCourses();
            }
        }
    }, [user, isManager]);

    const handleFacilitatorFilterChange = (staffProfileId: string) => {
        setSelectedFacilitatorId(staffProfileId);
        fetchWorkload(staffProfileId || undefined);
    };

    const handleCourseChange = (courseId: string) => {
        setSelectedCourseId(courseId);
        const course = coursesList.find(c => c.id === courseId);
        if (course) {
            setCourseCode(course.code);
        } else {
            setCourseCode('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/api/academic/workload', {
                courseCode, 
                session, 
                students: Number(students),
                staffId: isManager && formStaffId ? formStaffId : undefined
            });
            // Refresh list
            fetchWorkload(selectedFacilitatorId || undefined);
            setShowForm(false);
            setCourseCode('');
            setSelectedCourseId('');
            setFormStaffId('');
            setStudents(0);
        } catch (error) {
            alert('Failed to allocate course');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading && allocations.length === 0) return <div className="p-8 text-center text-gray-500">Loading workload...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Users size={24} className="text-blue-600" />
                        Teaching & Supervision
                    </h1>
                    <p className="text-sm text-gray-500">Manage course allocations and student supervision details.</p>
                </div>
                <button
                    onClick={() => {
                        setShowForm(!showForm);
                        // Reset defaults
                        setFormStaffId(selectedFacilitatorId || '');
                    }}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                    <Plus size={18} />
                    Add Allocation
                </button>
            </div>

            {/* Oversight Filter Bar for Managers */}
            {isManager && (
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-400" />
                        <span className="text-sm font-bold text-gray-700">Oversight View:</span>
                        <select
                            className="p-2 border rounded-lg text-sm bg-gray-50 font-medium cursor-pointer"
                            value={selectedFacilitatorId}
                            onChange={e => handleFacilitatorFilterChange(e.target.value)}
                        >
                            <option value="">My Own Workload</option>
                            {staffList.map(s => (
                                <option key={s.id} value={s.staffProfile?.id}>
                                    {s.name} ({s.staffProfile?.staffId || 'No ID'})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="text-xs text-gray-500 font-medium">
                        Viewing allocations for: <span className="font-bold underline text-blue-600">{
                            selectedFacilitatorId 
                                ? staffList.find(s => s.staffProfile?.id === selectedFacilitatorId)?.name || 'Selected Staff'
                                : user?.name || 'Self'
                        }</span>
                    </div>
                </div>
            )}

            {/* Allocation Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <BookOpen className="text-blue-650" size={20} />
                            New Allocation
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Facilitator Selector */}
                            {isManager && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Select Facilitator *</label>
                                    <select 
                                        required 
                                        className="w-full p-2 border rounded-md"
                                        value={formStaffId}
                                        onChange={e => setFormStaffId(e.target.value)}
                                    >
                                        <option value="">-- Choose Facilitator --</option>
                                        {staffList.map(s => (
                                            <option key={s.id} value={s.staffProfile?.id}>
                                                {s.name} ({s.staffProfile?.staffId || 'No ID'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Course Selector */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Select Course *</label>
                                <select 
                                    required 
                                    className="w-full p-2 border rounded-md"
                                    value={selectedCourseId}
                                    onChange={e => handleCourseChange(e.target.value)}
                                >
                                    <option value="">-- Choose Course --</option>
                                    {coursesList.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.code} - {c.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Course Code Input (Read-only Auto-fill) */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Course Code (Auto-populated)</label>
                                <input 
                                    type="text" 
                                    readOnly 
                                    required 
                                    className="w-full p-2 border rounded bg-gray-50 text-gray-500 font-mono font-semibold"
                                    placeholder="Select a course to auto-populate"
                                    value={courseCode} 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Session</label>
                                    <input 
                                        type="text" 
                                        required 
                                        className="w-full p-2 border rounded"
                                        value={session} 
                                        onChange={e => setSession(e.target.value)} 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Students Count</label>
                                    <input 
                                        type="number" 
                                        required 
                                        min="0"
                                        className="w-full p-2 border rounded"
                                        value={students} 
                                        onChange={e => setStudents(Number(e.target.value))} 
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t mt-6">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
                                <button type="submit" disabled={submitting || (isManager && !formStaffId) || !selectedCourseId} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold">
                                    {submitting ? 'Allocating...' : 'Allocate Course'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Workload Cards List */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allocations.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500 font-medium">
                        No teaching allocations recorded for this facilitator.
                    </div>
                ) : (
                    allocations.map((alloc) => (
                        <div key={alloc.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:border-blue-200 hover:shadow-md transition duration-200">
                            <div className="flex justify-between items-start mb-2">
                                <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold font-mono">
                                    {alloc.course?.code}
                                </div>
                                <div className="text-gray-400 text-xs flex items-center gap-1 font-semibold">
                                    <Calendar size={12} /> {alloc.session}
                                </div>
                            </div>
                            <h3 className="font-bold text-gray-800 mb-1 leading-snug">{alloc.course?.title}</h3>
                            <p className="text-xs text-gray-450 mb-4">{alloc.course?.semester} Semester • {alloc.course?.unit} Units</p>

                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                <Users size={16} className="text-blue-500" />
                                <span className="font-medium"><strong>{alloc.students}</strong> Students Supervised</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
