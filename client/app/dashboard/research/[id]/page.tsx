"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import CollaborativeEditor from '@/components/research/CollaborativeEditor';
import ProjectChat from '@/components/research/ProjectChat';
import { FileText, Users, Download, Upload, UserPlus, FileUp, ArrowLeft, Plus, FolderSync, Sparkles } from 'lucide-react';
import Link from 'next/link';

const THEMES: Record<string, { bg: string; text: string; border: string; gradient: string; preview: string; name: string }> = {
    indigo: {
        bg: 'bg-indigo-50/50 dark:bg-indigo-950/10',
        text: 'text-indigo-700 dark:text-indigo-300',
        border: 'border-indigo-100 dark:border-indigo-900/40 hover:border-indigo-300 dark:hover:border-indigo-700',
        gradient: 'from-indigo-650 via-blue-700 to-indigo-900',
        preview: 'bg-gradient-to-r from-indigo-500 to-blue-600',
        name: 'Indigo Blueprint'
    },
    emerald: {
        bg: 'bg-emerald-50/50 dark:bg-emerald-950/10',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-100 dark:border-emerald-900/40 hover:border-emerald-300 dark:hover:border-emerald-700',
        gradient: 'from-emerald-650 via-teal-700 to-emerald-900',
        preview: 'bg-gradient-to-r from-emerald-500 to-teal-600',
        name: 'Emerald Research'
    },
    rose: {
        bg: 'bg-rose-50/50 dark:bg-rose-950/10',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-100 dark:border-rose-900/40 hover:border-rose-300 dark:hover:border-rose-700',
        gradient: 'from-rose-650 via-pink-700 to-rose-900',
        preview: 'bg-gradient-to-r from-rose-500 to-pink-600',
        name: 'Rose Humanity'
    },
    amber: {
        bg: 'bg-amber-50/50 dark:bg-amber-950/10',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-100 dark:border-amber-900/40 hover:border-amber-300 dark:hover:border-amber-700',
        gradient: 'from-amber-650 via-orange-700 to-amber-900',
        preview: 'bg-gradient-to-r from-amber-500 to-orange-600',
        name: 'Amber Discovery'
    },
    violet: {
        bg: 'bg-violet-50/50 dark:bg-violet-950/10',
        text: 'text-violet-700 dark:text-violet-300',
        border: 'border-violet-100 dark:border-violet-900/40 hover:border-violet-300 dark:hover:border-violet-700',
        gradient: 'from-violet-650 via-purple-700 to-violet-900',
        preview: 'bg-gradient-to-r from-violet-500 to-purple-600',
        name: 'Violet Tech'
    }
};

const getProjectTheme = (domainField: string) => {
    if (!domainField) return { theme: THEMES.indigo, name: 'General Research', colorKey: 'indigo' };
    const parts = domainField.split('|');
    const name = parts[0] || 'General Research';
    const colorKey = parts[1] || 'indigo';
    return { theme: THEMES[colorKey] || THEMES.indigo, name, colorKey };
};

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
            setInviteeId('');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to send invite');
        }
    };

    if (loading) {
        return (
            <div className="flex h-full min-h-[60vh] items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
        );
    }
    if (!project) return <div className="p-12 text-center text-red-500 font-bold">Project Not Found</div>;

    const { theme, name: domainName } = getProjectTheme(project.domain);

    return (
        <div className="h-[calc(100vh-90px)] flex flex-col space-y-6 animate-in fade-in duration-500">
            {/* Top Workspace Header */}
            <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${theme.gradient} px-8 py-5 text-white shadow-lg flex-shrink-0 flex items-center justify-between`}>
                <div className="relative z-10 space-y-1">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/research" className="p-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/10">
                            <ArrowLeft size={16} />
                        </Link>
                        <span className="bg-white/25 text-white text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            {domainName}
                        </span>
                        <span className="bg-white/15 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            {project.status}
                        </span>
                    </div>
                    <h1 className="text-xl font-black tracking-tight mt-1">{project.title}</h1>
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <button 
                        onClick={() => setShowInviteModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 border border-white/25 text-white rounded-xl text-xs font-bold shadow-md transition duration-150"
                    >
                        <UserPlus size={14} />
                        <span>Invite Peer</span>
                    </button>
                </div>
                {/* Visual Highlights */}
                <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl"></div>
            </div>

            {/* Bottom 3-Column Split View */}
            <div className="flex-1 flex gap-6 min-h-0">
                
                {/* COLUMN 1: Files & Team (Width: 25%) */}
                <div className="w-1/4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-150 dark:border-gray-700/50 flex flex-col min-h-0 overflow-hidden">
                    {/* Abstract Header */}
                    <div className="p-5 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-750/30 flex-shrink-0">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Project Synopsis</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3" title={project.abstract}>
                            {project.abstract || 'No project description loaded.'}
                        </p>
                    </div>

                    {/* Scrollable Members & Files */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        {/* Team Section */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider flex items-center">
                                    <Users size={14} className="mr-1.5" /> Core Team
                                </h3>
                            </div>
                            <div className="space-y-2.5">
                                {project.members.map((m: any) => (
                                    <div key={m.id} className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold border border-blue-100/50">
                                            {m.staff.surname?.[0] || 'U'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                                                {m.staff.surname} {m.staff.otherNames}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-semibold uppercase">{m.role}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Drive / Assets Section */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider flex items-center">
                                    <FileText size={14} className="mr-1.5" /> Shared Drive
                                </h3>
                                <label className="p-1 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-lg cursor-pointer transition">
                                    <FileUp size={14} />
                                    <input type="file" className="hidden" onChange={handleFileUpload} />
                                </label>
                            </div>
                            
                            {project.files?.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">No project files uploaded yet.</p>
                            ) : (
                                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                    {project.files?.map((f: any) => (
                                        <div key={f.id} className="flex items-center justify-between p-2.5 bg-gray-50/50 dark:bg-gray-750/30 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:bg-gray-100 transition duration-150">
                                            <span className="text-xs text-gray-600 dark:text-gray-300 truncate w-36 font-semibold" title={f.fileName}>
                                                {f.fileName}
                                            </span>
                                            <a href={f.fileUrl} target="_blank" rel="noreferrer" className="p-1 text-gray-400 hover:text-blue-600 transition">
                                                <Download size={13} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* COLUMN 2: Editor (Width: 50%) */}
                <div className="w-2/4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-150 dark:border-gray-700/50 flex flex-col min-h-0 overflow-hidden">
                    <CollaborativeEditor 
                        projectId={id as string} 
                        userName={currentUser?.name || 'Anonymous'} 
                    />
                </div>

                {/* COLUMN 3: Real-Time Team Chat (Width: 25%) */}
                <div className="w-1/4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-150 dark:border-gray-700/50 flex flex-col min-h-0 overflow-hidden">
                    <ProjectChat 
                        projectId={id as string} 
                        currentUserId={currentUser?.id} 
                        initialMessages={project.messages}
                    />
                </div>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-350">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 shadow-2xl w-full max-w-sm space-y-4 animate-in scale-in-95 duration-200">
                        <div className="space-y-1">
                            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <Sparkles size={18} className="text-blue-600" />
                                Add Research Collaborator
                            </h2>
                            <p className="text-xs text-gray-500">Search and send page invites to active university researchers.</p>
                        </div>
                        
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Staff Profile List</label>
                                <select 
                                    required
                                    value={inviteeId}
                                    onChange={(e) => setInviteeId(e.target.value)}
                                    className="w-full p-2.5 border border-gray-200 rounded-xl dark:bg-gray-700 dark:border-gray-600 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    <option value="">Select researcher...</option>
                                    {allStaff.map(s => (
                                        <option key={s.userId} value={s.userId}>
                                            {s.surname} {s.otherNames} ({s.cadre || 'Staff'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
                                <button type="button" onClick={() => setShowInviteModal(false)} className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-xl transition">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition">Send Invite</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
