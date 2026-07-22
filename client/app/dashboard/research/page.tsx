"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, FolderOpen, Users, Clock, BookOpen, Layers, Sparkles, Check, ChevronRight, Bell, X, UserCheck } from 'lucide-react';
import api from '@/lib/api';

const THEMES: Record<string, { bg: string; text: string; border: string; gradient: string; preview: string; name: string }> = {
    indigo: {
        bg: 'bg-emerald-700 text-white font-bold',
        text: 'text-white font-bold',
        border: 'border-emerald-300 hover:border-emerald-600',
        gradient: 'from-emerald-700 via-emerald-600 to-teal-700',
        preview: 'bg-gradient-to-r from-emerald-600 to-teal-700',
        name: 'Emerald Research'
    },
    emerald: {
        bg: 'bg-emerald-700 text-white font-bold',
        text: 'text-white font-bold',
        border: 'border-emerald-300 hover:border-emerald-600',
        gradient: 'from-emerald-700 via-emerald-600 to-teal-700',
        preview: 'bg-gradient-to-r from-emerald-600 to-teal-700',
        name: 'Emerald Research'
    },
    rose: {
        bg: 'bg-emerald-700 text-white font-bold',
        text: 'text-white font-bold',
        border: 'border-emerald-300 hover:border-emerald-600',
        gradient: 'from-emerald-700 via-emerald-600 to-teal-700',
        preview: 'bg-gradient-to-r from-emerald-600 to-teal-700',
        name: 'Emerald Research'
    },
    amber: {
        bg: 'bg-emerald-700 text-white font-bold',
        text: 'text-white font-bold',
        border: 'border-emerald-300 hover:border-emerald-600',
        gradient: 'from-emerald-700 via-emerald-600 to-teal-700',
        preview: 'bg-gradient-to-r from-emerald-600 to-teal-700',
        name: 'Emerald Research'
    },
    violet: {
        bg: 'bg-emerald-700 text-white font-bold',
        text: 'text-white font-bold',
        border: 'border-emerald-300 hover:border-emerald-600',
        gradient: 'from-emerald-700 via-emerald-600 to-teal-700',
        preview: 'bg-gradient-to-r from-emerald-600 to-teal-700',
        name: 'Emerald Research'
    }
};

const getProjectTheme = (domainField: string) => {
    if (!domainField) return { theme: THEMES.emerald, name: 'General Research', colorKey: 'emerald' };
    const parts = domainField.split('|');
    const name = parts[0] || 'General Research';
    return { theme: THEMES.emerald, name, colorKey: 'emerald' };
};

// Avatar bubble showing a collaborator's initials
function MemberAvatar({ name, index }: { name: string; index: number }) {
    const colors = [
        'bg-emerald-600', 'bg-teal-600', 'bg-emerald-700',
        'bg-green-600', 'bg-emerald-800', 'bg-teal-700'
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
            await fetchProjects();
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
                domain: `${formData.domain.trim()}|emerald`
            };
            const res = await api.post('/api/research', payload);
            router.push(`/dashboard/research/${res.data.id}`);
        } catch (err) {
            console.error('Failed to create project', err);
            alert('Failed to create project');
        }
    };

    return (
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a' }} className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 min-h-screen rounded-3xl">
            {/* Header Banner — NOUN brand green gradient */}
            <div 
                style={{ backgroundColor: '#006533', color: '#ffffff' }}
                className="relative overflow-hidden rounded-3xl text-white p-8 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6 border border-emerald-800"
            >
                <div className="relative z-10 max-w-xl space-y-2">
                    <span 
                        style={{ backgroundColor: '#004d26', color: '#ffffff' }}
                        className="text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block border border-emerald-500"
                    >
                        Academic Workspace
                    </span>
                    <h1 className="text-3xl font-black tracking-tight leading-tight">Research Forum</h1>
                    <p className="text-white/90 text-sm leading-relaxed">
                        Collaborate on cutting-edge research, share dynamic documents, co-author files, and exchange real-time feedback with peers across the university.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    style={{ backgroundColor: '#008040', color: '#ffffff' }}
                    className="flex items-center justify-center space-x-2 px-5 py-3 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 z-10 flex-shrink-0 border border-emerald-400"
                >
                    <Plus size={20} />
                    <span>Create Research Workspace</span>
                </button>
            </div>

            {/* ── Pending Invitations Panel ─────────────────────────────────── */}
            {invites.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3 shadow-sm animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 mb-1">
                        <Bell size={18} className="text-emerald-700 animate-pulse" />
                        <h2 className="text-sm font-black text-emerald-900 uppercase tracking-wider">
                            Pending Research Invitations ({invites.length})
                        </h2>
                    </div>
                    <div className="space-y-2">
                        {invites.map(invite => (
                            <div
                                key={invite.id}
                                style={{ backgroundColor: '#ffffff' }}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-200 px-4 py-3 shadow-sm"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">
                                        📁 {invite.project?.title}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Invited by <span className="font-semibold text-emerald-800">{invite.inviter?.name || 'a colleague'}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleAccept(invite.id)}
                                        disabled={respondingId === invite.id}
                                        style={{ backgroundColor: '#006533', color: '#ffffff' }}
                                        className="flex items-center gap-1.5 px-4 py-1.5 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 hover:opacity-90 shadow-sm"
                                    >
                                        <UserCheck size={13} />
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => handleDecline(invite.id)}
                                        disabled={respondingId === invite.id}
                                        className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition disabled:opacity-50"
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
                <div className="flex justify-center items-center py-24 bg-white">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
                </div>
            ) : projects.length === 0 ? (
                <div style={{ backgroundColor: '#ffffff' }} className="rounded-3xl border border-slate-200 shadow-sm p-16 text-center max-w-2xl mx-auto space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-800 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-emerald-200">
                        <FolderOpen size={32} />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-black text-slate-900">No active projects found</h3>
                        <p className="text-slate-500 max-w-md mx-auto text-sm">
                            You are not currently registered as a collaborator on any research project. Get started by initializing your own workspace or accepting an invitation above.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        style={{ backgroundColor: '#006533', color: '#ffffff' }}
                        className="px-6 py-3 text-white font-bold rounded-2xl transition duration-200 shadow-sm hover:opacity-90"
                    >
                        Initialize First Project
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {projects.map(project => {
                        const { name } = getProjectTheme(project.domain);
                        const memberNames: string[] = (project.members || [])
                            .slice(0, 5)
                            .map((m: any) => m.staff?.user?.name || m.staff?.surname || '?');
                        const extraCount = Math.max(0, (project._count?.members || 0) - 5);

                        return (
                            <Link key={project.id} href={`/dashboard/research/${project.id}`}>
                                <div 
                                    style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                                    className="rounded-3xl border border-emerald-200 hover:border-emerald-500 p-6 shadow-sm hover:shadow-xl hover:shadow-emerald-900/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full group relative overflow-hidden"
                                >
                                    {/* Top NOUN Emerald Accent Bar */}
                                    <div style={{ backgroundColor: '#006533' }} className="absolute top-0 left-0 right-0 h-2"></div>
                                    
                                    <div className="flex justify-between items-start mb-4 gap-2 mt-1">
                                        {/* Domain Tag — Solid NOUN Green */}
                                        <span 
                                            style={{ backgroundColor: '#006533', color: '#ffffff' }}
                                            className="text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full border border-emerald-700 shadow-sm"
                                        >
                                            {name}
                                        </span>
                                        
                                        {/* Solo vs Collaborative badge */}
                                        <span 
                                            className={`text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full border shadow-sm ${(project.members || []).length <= 1 ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}
                                        >
                                            {(project.members || []).length <= 1 ? 'Solo Research' : 'Collaborative Project'}
                                        </span>

                                        {/* Status Badge (DRAFT/ONGOING/COMPLETED) — Solid Vibrant NOUN Green */}
                                        <span 
                                            style={{ backgroundColor: '#006533', color: '#ffffff' }}
                                            className="text-[10px] font-black tracking-wider uppercase px-3 py-1 rounded-full border border-emerald-700 shadow-sm"
                                        >
                                            {project.status || 'DRAFT'}
                                        </span>
                                    </div>
                                    
                                    <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-800 transition line-clamp-2 mb-3 leading-snug">
                                        {project.title}
                                    </h3>
                                    
                                    <p className="text-slate-500 text-sm mb-6 line-clamp-3 flex-grow leading-relaxed">
                                        {project.abstract || 'No abstract provided. Expand to open files, collaborate on document drafts, and coordinate with active team members.'}
                                    </p>
                                    
                                    {/* Footer: Avatars + Date */}
                                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                        <div className="flex items-center">
                                            <div className="flex items-center">
                                                {memberNames.map((n, i) => (
                                                    <MemberAvatar key={i} name={n} index={i} />
                                                ))}
                                                {extraCount > 0 && (
                                                    <div
                                                        style={{ zIndex: 0, marginLeft: '-8px' }}
                                                        className="relative w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center border-2 border-white"
                                                    >
                                                        +{extraCount}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                                            <Clock size={12} className="text-emerald-700" />
                                            {new Date(project.updatedAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Create Workspace Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div style={{ backgroundColor: '#ffffff', color: '#0f172a' }} className="rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-8 space-y-6 animate-in scale-in-95 duration-200">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                                <Sparkles size={24} className="text-emerald-700 animate-pulse" />
                                Initialize Research Workspace
                            </h2>
                            <p className="text-xs text-slate-500">Configure parameters for co-authoring workspace, peer invites, and chat.</p>
                        </div>
                        
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Project Title</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. Impact Analysis of E-Learning Protocols"
                                    className="w-full p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none text-slate-800 bg-white"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Domain / Discipline</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. Computer Science"
                                    className="w-full p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none text-slate-800 bg-white"
                                    value={formData.domain}
                                    onChange={e => setFormData({ ...formData, domain: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Abstract &amp; Objectives</label>
                                <textarea
                                    required
                                    placeholder="Provide a comprehensive synopsis of the research project, objectives, methodologies, and expected academic outputs."
                                    className="w-full p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none min-h-[120px] text-slate-800 bg-white"
                                    value={formData.abstract}
                                    onChange={e => setFormData({ ...formData, abstract: e.target.value })}
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition duration-150"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{ backgroundColor: '#006533', color: '#ffffff' }}
                                    className="px-5 py-2.5 text-white font-bold rounded-xl text-sm shadow-md hover:opacity-90 transition duration-150"
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
