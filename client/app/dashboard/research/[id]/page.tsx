"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import dynamic from 'next/dynamic';
import EditorSkeleton from '@/components/ui/EditorSkeleton';
import ChatSkeleton from '@/components/ui/ChatSkeleton';

// Dynamically import TipTap Word-style editor and Socket.IO chat with ssr: false
const CollaborativeEditor = dynamic(() => import('@/components/research/CollaborativeEditor'), {
    ssr: false,
    loading: () => <EditorSkeleton />
});

const ProjectChat = dynamic(() => import('@/components/research/ProjectChat'), {
    ssr: false,
    loading: () => <ChatSkeleton />
});
import { FileText, Users, Download, Upload, UserPlus, FileUp, ArrowLeft, Plus, FolderSync, Sparkles } from 'lucide-react';
import Link from 'next/link';

const THEMES: Record<string, { bg: string; text: string; border: string; gradient: string; preview: string; name: string }> = {
    indigo: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/20',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-400',
        gradient: 'from-emerald-800 via-teal-800 to-slate-900',
        preview: 'bg-gradient-to-r from-emerald-600 to-teal-700',
        name: 'Official NOUN Workspace'
    },
    emerald: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/20',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-400',
        gradient: 'from-emerald-700 via-teal-800 to-emerald-950',
        preview: 'bg-gradient-to-r from-emerald-600 to-teal-600',
        name: 'Emerald Research'
    },
    rose: {
        bg: 'bg-rose-50 dark:bg-rose-950/20',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-200 dark:border-rose-800 hover:border-rose-400',
        gradient: 'from-rose-700 via-pink-800 to-slate-900',
        preview: 'bg-gradient-to-r from-rose-600 to-pink-600',
        name: 'Rose Humanity'
    },
    amber: {
        bg: 'bg-amber-50 dark:bg-amber-950/20',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800 hover:border-amber-400',
        gradient: 'from-amber-700 via-orange-800 to-slate-900',
        preview: 'bg-gradient-to-r from-amber-600 to-orange-600',
        name: 'Amber Discovery'
    },
    violet: {
        bg: 'bg-violet-50 dark:bg-violet-950/20',
        text: 'text-violet-700 dark:text-violet-300',
        border: 'border-violet-200 dark:border-violet-800 hover:border-violet-400',
        gradient: 'from-violet-700 via-purple-800 to-slate-900',
        preview: 'bg-gradient-to-r from-violet-600 to-purple-600',
        name: 'Violet Tech'
    }
};

const getProjectTheme = (domain: string) => {
    if (!domain) return { theme: THEMES.indigo, name: 'General Research', colorKey: 'indigo' };
    const parts = domain.split('|');
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
            const dataArray = Array.isArray(res.data) ? res.data : (res.data.staff || []);
            const mappedStaff = dataArray
                .map((s: any) => ({
                    userId: s.id,
                    surname: s.staffProfile?.surname || s.name || '',
                    otherNames: s.staffProfile ? s.staffProfile.otherNames || '' : '',
                    cadre: s.staffProfile?.cadre || s.role || ''
                }))
                .filter((s: any) => s.cadre === 'ACADEMIC'); // Only show academic staff in research invites
            setAllStaff(mappedStaff);
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
                files: [...(prev.files || []), res.data]
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
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }
    if (!project) return <div className="p-12 text-center text-red-500 font-bold">Project Not Found</div>;

    const { theme, name: domainName } = getProjectTheme(project.domain);

    return (
        <div className="h-[calc(100vh-90px)] flex flex-col space-y-6 animate-in fade-in duration-500">
            {/* Top Workspace Header (Green theme bar for header) */}
            <div className="relative overflow-hidden rounded-2xl bg-emerald-800 text-white px-8 py-5 border border-emerald-900 shadow-md flex-shrink-0 flex items-center justify-between">
                <div className="relative z-10 space-y-1">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/research" className="p-1.5 bg-emerald-900/60 hover:bg-emerald-900 text-white rounded-lg transition-colors border border-emerald-700">
                            <ArrowLeft size={15} />
                        </Link>
                        <span className="bg-emerald-900/80 text-emerald-100 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-600">
                            {domainName}
                        </span>
                        <span className="bg-emerald-950/90 text-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-700">
                            {project.status}
                        </span>
                    </div>
                    <h1 className="text-xl font-bold text-white mt-1.5">{project.title}</h1>
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <button 
                        onClick={() => setShowInviteModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition duration-150 border border-emerald-400"
                    >
                        <UserPlus size={14} />
                        <span>Invite Peer</span>
                    </button>
                </div>
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
                                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20">
                                            {m.staff?.surname?.[0] || 'U'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                                                {m.staff ? `${m.staff.surname} ${m.staff.otherNames}` : 'Deleted Staff'}
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
                                <label className="p-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg cursor-pointer transition">
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
                                            <a href={f.fileUrl} target="_blank" rel="noreferrer" className="p-1 text-gray-400 hover:text-primary transition">
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
                    />

                </div>

                {/* COLUMN 3: Real-Time Team Chat (Width: 25%) */}
                <div className="w-1/4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-150 dark:border-gray-700/50 flex flex-col min-h-0 overflow-hidden">
                    <ProjectChat 
                        key={id as string}
                        projectId={id as string} 
                        currentUserId={currentUser?.id || ''} 
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
                                <Sparkles size={18} className="text-primary" />
                                Add Research Collaborator
                            </h2>
                            <p className="text-xs text-gray-500">Search and send page invites to active university researchers.</p>
                        </div>
                        
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Academic Staff</label>
                                <select 
                                    required
                                    value={inviteeId}
                                    onChange={(e) => setInviteeId(e.target.value)}
                                    className="w-full p-2.5 border border-gray-200 rounded-xl dark:bg-gray-700 dark:border-gray-600 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                                >
                                    <option value="">Select academic staff member...</option>
                                    {allStaff.map(s => (
                                        <option key={s.userId} value={s.userId}>
                                            {s.surname} {s.otherNames} ({s.cadre})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
                                <button type="button" onClick={() => setShowInviteModal(false)} className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-xl transition">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-xl shadow-sm transition">Send Invite</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
