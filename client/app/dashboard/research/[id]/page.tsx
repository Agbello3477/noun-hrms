"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import CollaborativeEditor from '@/components/research/CollaborativeEditor';
import ProjectChat from '@/components/research/ProjectChat';
import { FileText, Users, Download, Upload, UserPlus, FileUp } from 'lucide-react';

export default function ResearchWorkspace() {
    const { id } = useParams();
    const router = useRouter();
    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteeId, setInviteeId] = useState('');
    const [allStaff, setAllStaff] = useState<any[]>([]);

    useEffect(() => {
        // Fetch current user details from local storage or API context
        const userStr = localStorage.getItem('user');
        if (userStr) {
            setCurrentUser(JSON.parse(userStr));
        }

        fetchProject();
        fetchStaff();
    }, [id]);

    const fetchProject = async () => {
        try {
            const res = await api.get(`/api/research/${id}`);
            setProject(res.data);
        } catch (err: any) {
            console.error(err);
            if (err.response?.status === 403) {
                alert('Forbidden: You are not a member of this project.');
                router.push('/dashboard/research');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchStaff = async () => {
        try {
            // Simplified fetch for invite dropdown. In production, use search/pagination.
            const res = await api.get('/api/staff');
            setAllStaff(res.data.staff || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post(`/api/research/${id}/files`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setProject((prev: any) => ({
                ...prev,
                files: [...prev.files, res.data]
            }));
            alert('File uploaded successfully');
        } catch (err) {
            console.error(err);
            alert('Failed to upload file');
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post(`/api/research/${id}/invite`, { inviteeId });
            alert('Invite sent successfully');
            setShowInviteModal(false);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to send invite');
        }
    };

    if (loading) return <div className="p-12 text-center text-gray-500">Loading Workspace...</div>;
    if (!project) return <div className="p-12 text-center text-red-500">Project Not Found</div>;

    return (
        <div className="h-[calc(100vh-100px)] flex space-x-4">
            
            {/* LEFT SIDEBAR: Project Details & Files */}
            <div className="w-1/4 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-y-auto p-4 flex flex-col">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">{project.title}</h2>
                    <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded text-gray-600 dark:text-gray-300 mb-2">
                        {project.domain || 'General Research'}
                    </span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {project.abstract}
                    </p>
                </div>

                {/* Team Members */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200 uppercase tracking-wider flex items-center">
                            <Users size={16} className="mr-2" /> Team
                        </h3>
                        <button 
                            onClick={() => setShowInviteModal(true)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                            <UserPlus size={16} />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {project.members.map((m: any) => (
                            <div key={m.id} className="flex items-center space-x-2 text-sm">
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                                    {m.staff.surname?.[0] || 'U'}
                                </div>
                                <div>
                                    <p className="text-gray-800 dark:text-white font-medium">
                                        {m.staff.surname} {m.staff.otherNames}
                                    </p>
                                    <p className="text-[10px] text-gray-400">{m.role}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Shared Drive */}
                <div className="flex-grow flex flex-col">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200 uppercase tracking-wider flex items-center">
                            <FileText size={16} className="mr-2" /> Shared Drive
                        </h3>
                        <label className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer">
                            <FileUp size={16} />
                            <input type="file" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>
                    
                    {project.files?.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No files uploaded yet.</p>
                    ) : (
                        <div className="space-y-2 overflow-y-auto">
                            {project.files?.map((f: any) => (
                                <div key={f.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-100 dark:border-gray-600">
                                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate w-32" title={f.fileName}>
                                        {f.fileName}
                                    </span>
                                    <a href={f.fileUrl} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-600">
                                        <Download size={14} />
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* CENTER: Collaborative Editor */}
            <div className="w-2/4 flex flex-col">
                <CollaborativeEditor 
                    projectId={id as string} 
                    userName={currentUser?.name || 'Anonymous'} 
                />
            </div>

            {/* RIGHT: Live Chat */}
            <div className="w-1/4">
                <ProjectChat 
                    projectId={id as string} 
                    currentUserId={currentUser?.id} 
                    initialMessages={project.messages}
                />
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-96">
                        <h2 className="text-xl font-bold mb-4">Invite Collaborator</h2>
                        <form onSubmit={handleInvite}>
                            <select 
                                required
                                value={inviteeId}
                                onChange={(e) => setInviteeId(e.target.value)}
                                className="w-full p-2 border rounded mb-4 dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value="">Select a staff member...</option>
                                {allStaff.map(s => (
                                    <option key={s.userId} value={s.userId}>
                                        {s.surname} {s.otherNames}
                                    </option>
                                ))}
                            </select>
                            <div className="flex justify-end space-x-2">
                                <button type="button" onClick={() => setShowInviteModal(false)} className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Cancel</button>
                                <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Send Invite</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
