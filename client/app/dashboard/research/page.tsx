"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, FolderOpen, Users, Clock, BookOpen, Layers, Sparkles, Check, ChevronRight, Bell, X, UserCheck } from 'lucide-react';
import api from '@/lib/api';

const THEMES: Record<string, { bg: string; text: string; border: string; gradient: string; preview: string; name: string }> = {
    indigo: {
        bg: 'bg-indigo-50/50 dark:bg-indigo-950/10',
        text: 'text-indigo-700 dark:text-indigo-300',
        border: 'border-indigo-100 dark:border-indigo-900/40 hover:border-indigo-300 dark:hover:border-indigo-700',
        gradient: 'from-indigo-600 to-blue-700',
        preview: 'bg-gradient-to-r from-indigo-500 to-blue-600',
        name: 'Indigo Blueprint'
    },
    emerald: {
        bg: 'bg-emerald-50/50 dark:bg-emerald-950/10',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-100 dark:border-emerald-900/40 hover:border-emerald-300 dark:hover:border-emerald-700',
        gradient: 'from-emerald-600 to-teal-700',
        preview: 'bg-gradient-to-r from-emerald-500 to-teal-600',
        name: 'Emerald Research'
    },
    rose: {
        bg: 'bg-rose-50/50 dark:bg-rose-950/10',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-100 dark:border-rose-900/40 hover:border-rose-300 dark:hover:border-rose-700',
        gradient: 'from-rose-600 to-pink-700',
        preview: 'bg-gradient-to-r from-rose-500 to-pink-600',
        name: 'Rose Humanity'
    },
    amber: {
        bg: 'bg-amber-50/50 dark:bg-amber-950/10',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-100 dark:border-amber-900/40 hover:border-amber-300 dark:hover:border-amber-700',
        gradient: 'from-amber-600 to-orange-700',
        preview: 'bg-gradient-to-r from-amber-500 to-orange-600',
        name: 'Amber Discovery'
    },
    violet: {
        bg: 'bg-violet-50/50 dark:bg-violet-950/10',
        text: 'text-violet-700 dark:text-violet-300',
        border: 'border-violet-100 dark:border-violet-900/40 hover:border-violet-300 dark:hover:border-violet-700',
        gradient: 'from-violet-600 to-purple-700',
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

// Avatar bubble showing a collaborator's initials
function MemberAvatar({ name, index }: { name: string; index: number }) {
    const colors = [
        'bg-emerald-500', 'bg-indigo-500', 'bg-amber-500',
        'bg-rose-500', 'bg-violet-500', 'bg-cyan-500'
    ];
    const initials = name
        ? name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
        : '?';
    return (
        <div
            title={name}
            style={{ zIndex: 10 - index, marginLeft: index === 0 ? 0 : '-8px' }}
            className={`relative w-7 h-7 rounded-full ${colors[index % colors.length]} text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-sm ring-1 ring-white/50`}
        >
            {initials}
        </div>
    );
}

export default function ResearchDashboard() {
    const [projects, setProjects] = useState<any[]>([]);
    const [invites, setInvites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [formData, setFormData] = useState({ title: '', abstract: '', domain: '' });
    const [selectedColor, setSelectedColor] = useState('indigo');
    const [respondingId, setRespondingId] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchProjects();
        fetchInvites();
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

    const fetchInvites = async () => {
        try {
            const res = await api.get('/api/research/invites/mine');
            setInvites(res.data);
        } catch (err) {
            // Non-fatal — invites panel just won't show
        }
    };

    const handleAccept = async (inviteId: string) => {
        setRespondingId(inviteId);
        try {
            await api.post(`/api/research/invite/${inviteId}/accept`);
            setInvites(prev => prev.filter(i => i.id !== inviteId));
            await fetchProjects(); // Refresh project list so the accepted project appears
        } catch (err) {
            console.error('Failed to accept invite', err);
        } finally {
            setRespondingId(null);
        }
    };

    const handleDecline = async (inviteId: string) => {
        setRespondingId(inviteId);
        try {
            await api.post(`/api/research/invite/${inviteId}/decline`);
            setInvites(prev => prev.filter(i => i.id !== inviteId));
        } catch (err) {
            console.error('Failed to decline invite', err);
        } finally {
            setRespondingId(null);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                title: formData.title,
                abstract: formData.abstract,
                domain: `${formData.domain.trim()}|${selectedColor}`
            };
            const res = await api.post('/api/research', payload);
            router.push(`/dashboard/research/${res.data.id}`);
        } catch (err) {
            console.error('Failed to create project', err);
            alert('Failed to create project');
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Banner — NOUN brand gradient */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary via-primary-dark to-slate-900 p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="relative z-10 max-w-xl space-y-2">
                    <span className="bg-secondary/20 text-secondary border border-secondary/30 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
                        Academic Workspace
                    </span>
                    <h1 className="text-3xl font-black tracking-tight leading-tight">Research Forum</h1>
                    <p className="text-white/75 text-sm leading-relaxed">
                        Collaborate on cutting-edge research, share dynamic documents, co-author files, and exchange real-time feedback with peers across the university.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center justify-center space-x-2 px-5 py-3 bg-secondary hover:bg-yellow-400 text-slate-900 font-bold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 z-10 flex-shrink-0"
                >
                    <Plus size={20} />
                    <span>Create Research Workspace</span>
                </button>
                {/* Visual Highlights */}
                <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-secondary/10 blur-3xl"></div>
                <div className="absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-white/5 blur-3xl"></div>
            </div>

            {/* ── Pending Invitations Panel ─────────────────────────────────── */}
            {invites.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3 shadow-sm animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 mb-1">
                        <Bell size={18} className="text-amber-600 animate-pulse" />
                        <h2 className="text-sm font-black text-amber-800 uppercase tracking-wider">
                            Pending Research Invitations ({invites.length})
                        </h2>
                    </div>
                    <div className="space-y-2">
                        {invites.map(invite => (
                            <div
                                key={invite.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl border border-amber-100 px-4 py-3 shadow-sm"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">
                                        📁 {invite.project?.title}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Invited by <span className="font-semibold">{invite.inviter?.name || 'a colleague'}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleAccept(invite.id)}
                                        disabled={respondingId === invite.id}
                                        className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                                    >
                                        <UserCheck size={13} />
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => handleDecline(invite.id)}
                                        disabled={respondingId === invite.id}
                                        className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition disabled:opacity-50"
                                    >
                                        <X size={13} />
                                        Decline
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Project Grid ───────────────────────────────────────────────── */}
            {loading ? (
                <div className="flex justify-center items-center py-24">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
            ) : projects.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-16 text-center max-w-2xl mx-auto space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                        <FolderOpen size={32} />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white">No active projects found</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-sm">
                            You are not currently registered as a collaborator on any research project. Get started by initializing your own workspace or accepting an invitation above.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-6 py-3 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-2xl transition duration-200"
                    >
                        Initialize First Project
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {projects.map(project => {
                        const { theme, name } = getProjectTheme(project.domain);
                        // Build member list for avatar stack (show up to 5)
                        const memberNames: string[] = (project.members || [])
                            .slice(0, 5)
                            .map((m: any) => m.staff?.user?.name || m.staff?.surname || '?');
                        const extraCount = Math.max(0, (project._count?.members || 0) - 5);

                        return (
                            <Link key={project.id} href={`/dashboard/research/${project.id}`}>
                                <div className={`bg-white dark:bg-gray-800 rounded-3xl border ${theme.border} p-6 shadow-sm hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full group relative overflow-hidden`}>
                                    
                                    {/* Top Accent Gradient Bar */}
                                    <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${theme.gradient}`}></div>
                                    
                                    <div className="flex justify-between items-start mb-4 gap-2">
                                        <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full ${theme.bg} ${theme.text}`}>
                                            {name}
                                        </span>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                                            project.status === 'ONGOING' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                            project.status === 'COMPLETED' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                            'bg-amber-50 text-amber-700 border border-amber-100'
                                        }`}>
                                            {project.status}
                                        </span>
                                    </div>
                                    
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary transition line-clamp-2 mb-3 leading-snug">
                                        {project.title}
                                    </h3>
                                    
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 line-clamp-3 flex-grow leading-relaxed">
                                        {project.abstract || 'No abstract provided. Expand to open files, collaborate on document drafts, and coordinate with active team members.'}
                                    </p>
                                    
                                    {/* Footer: Avatars + Docs + Date */}
                                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700/50">
                                        {/* Member Avatar Stack */}
                                        <div className="flex items-center">
                                            <div className="flex items-center">
                                                {memberNames.map((n, i) => (
                                                    <MemberAvatar key={i} name={n} index={i} />
                                                ))}
                                                {extraCount > 0 && (
                                                    <div
                                                        style={{ zIndex: 0, marginLeft: '-8px' }}
                                                        className="relative w-7 h-7 rounded-full bg-gray-300 text-gray-700 text-[10px] font-black flex items-center justify-center border-2 border-white"
                                                    >
                                                        +{extraCount}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="ml-2 text-xs text-gray-400 font-medium">
                                                {project._count?.members || 0} member{project._count?.members !== 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 text-xs text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <FolderOpen size={13} />
                                                {project._count?.documents || 0} docs
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={13} />
                                                {new Date(project.updatedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Premium Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-2xl w-full max-w-lg p-8 space-y-6 animate-in scale-in-95 duration-200">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <Sparkles size={24} className="text-amber-500 animate-pulse" />
                                Initialize Research Workspace
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Configure parameters for co-authoring workspace, peer invites, and chat.</p>
                        </div>
                        
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Project Title</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. Impact Analysis of E-Learning Protocols"
                                    className="w-full p-3 text-sm border border-gray-200 rounded-xl dark:bg-gray-750 dark:border-gray-600 focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Domain / Discipline</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. Computer Science"
                                        className="w-full p-3 text-sm border border-gray-200 rounded-xl dark:bg-gray-750 dark:border-gray-600 focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                                        value={formData.domain}
                                        onChange={e => setFormData({ ...formData, domain: e.target.value })}
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Color Theme Selection</label>
                                    <div className="flex items-center space-x-2.5 h-[46px]">
                                        {Object.keys(THEMES).map(color => {
                                            const theme = THEMES[color];
                                            const isSelected = selectedColor === color;
                                            return (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setSelectedColor(color)}
                                                    className={`w-7 h-7 rounded-full ${theme.preview} relative hover:scale-110 transition duration-150 flex items-center justify-center shadow-sm`}
                                                    title={theme.name}
                                                >
                                                    {isSelected && (
                                                        <Check size={14} className="text-white font-bold" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Abstract &amp; Objectives</label>
                                <textarea
                                    required
                                    placeholder="Provide a comprehensive synopsis of the research project, objectives, methodologies, and expected academic outputs."
                                    className="w-full p-3 text-sm border border-gray-200 rounded-xl dark:bg-gray-750 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[120px]"
                                    value={formData.abstract}
                                    onChange={e => setFormData({ ...formData, abstract: e.target.value })}
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="px-4 py-2.5 text-sm font-semibold text-gray-650 hover:bg-gray-50 dark:hover:bg-gray-750 rounded-xl transition duration-150"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition duration-150"
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
