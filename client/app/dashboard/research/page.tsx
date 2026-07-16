"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, FolderOpen, Users, Clock } from 'lucide-react';
import api from '@/lib/api';

export default function ResearchDashboard() {
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [formData, setFormData] = useState({ title: '', abstract: '', domain: '' });
    const router = useRouter();

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await api.get('/api/research');
            setProjects(res.data);
        } catch (err) {
            console.error('Failed to fetch projects', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.post('/api/research', formData);
            router.push(`/dashboard/research/${res.data.id}`);
        } catch (err) {
            console.error('Failed to create project', err);
            alert('Failed to create project');
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Research Projects</h1>
                    <p className="text-gray-600 dark:text-gray-300">Collaborate with peers on academic research.</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus size={20} />
                    <span>New Project</span>
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading projects...</div>
            ) : projects.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
                    <FolderOpen size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No projects found</h3>
                    <p className="text-gray-500 mb-6">You aren't a member of any research projects yet.</p>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-6 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition font-medium"
                    >
                        Create your first project
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => (
                        <Link key={project.id} href={`/dashboard/research/${project.id}`}>
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-6 hover:shadow-lg transition cursor-pointer flex flex-col h-full group">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white group-hover:text-blue-600 transition line-clamp-2">
                                        {project.title}
                                    </h3>
                                    <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                                        project.status === 'ONGOING' ? 'bg-green-100 text-green-700' :
                                        project.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' :
                                        'bg-yellow-100 text-yellow-700'
                                    }`}>
                                        {project.status}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 line-clamp-3 flex-grow">
                                    {project.abstract || 'No abstract provided.'}
                                </p>
                                <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center space-x-4">
                                        <div className="flex items-center space-x-1">
                                            <Users size={14} />
                                            <span>{project._count.members}</span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <FolderOpen size={14} />
                                            <span>{project._count.documents} Docs</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <Clock size={14} />
                                        <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {showCreate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
                        <h2 className="text-2xl font-bold mb-4">Create Research Project</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Project Title</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Domain / Discipline</label>
                                <input
                                    type="text"
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    placeholder="e.g. Computer Science, Public Health"
                                    value={formData.domain}
                                    onChange={e => setFormData({ ...formData, domain: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Abstract</label>
                                <textarea
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 min-h-[100px]"
                                    value={formData.abstract}
                                    onChange={e => setFormData({ ...formData, abstract: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                >
                                    Create Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
