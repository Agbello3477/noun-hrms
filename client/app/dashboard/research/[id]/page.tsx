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
import { 
    FileText, 
    Users, 
    Download, 
    UserPlus, 
    FileUp, 
    ArrowLeft, 
    Sparkles,
    Edit3,
    CheckCircle2,
    Trash2,
    UserX,
    Bell
} from 'lucide-react';
import Link from 'next/link';

export default function ResearchWorkspace() {
    const { id } = useParams();
    const router = useRouter();
    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    
    // Modals & form state
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [inviteeId, setInviteeId] = useState('');
    const [allStaff, setAllStaff] = useState<any[]>([]);

    // Edit workspace state
    const [editTitle, setEditTitle] = useState('');
    const [editAbstract, setEditAbstract] = useState('');

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
            if (res.data) {
                setEditTitle(res.data.title || '');
                setEditAbstract(res.data.abstract || '');
            }
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
            const res = await api.get('/api/research/peers');
            setAllStaff(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch academic peers', err);
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

    // 1. Invite Peer
    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post(`/api/research/${id}/invite`, { inviteeId });
            alert('Invite sent successfully');
            setShowInviteModal(false);
            setInviteeId('');
            fetchProject();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to send invite');
        }
    };

    // 2. Uninvite / Remove Collaborator
    const handleRemoveMember = async (memberId: string, name: string) => {
        if (!confirm(`Are you sure you want to remove ${name} from this workspace?`)) return;
        try {
            await api.delete(`/api/research/${id}/member/${memberId}`);
            alert('Collaborator removed successfully');
            fetchProject();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to remove collaborator');
        }
    };

    // 3. Edit Workspace
    const handleEditWorkspace = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.put(`/api/research/${id}`, {
                title: editTitle,
                abstract: editAbstract
            });
            alert('Workspace updated successfully');
            setShowEditModal(false);
            fetchProject();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to update workspace');
        }
    };

    // 4. Mark Workspace as Complete / Toggle Status
    const handleToggleStatus = async () => {
        const newStatus = project.status === 'COMPLETED' ? 'ONGOING' : 'COMPLETED';
        const label = newStatus === 'COMPLETED' ? 'COMPLETED' : 'ONGOING';
        if (!confirm(`Mark this research workspace as ${label}?`)) return;

        try {
            await api.put(`/api/research/${id}/status`, { status: newStatus });
            alert(`Workspace status updated to ${label}`);
            fetchProject();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to update status');
        }
    };

    // 5. Delete Workspace
    const handleDeleteWorkspace = async () => {
        if (!confirm('WARNING: Are you sure you want to permanently delete this research workspace? All content and files will be deleted.')) return;
        try {
            await api.delete(`/api/research/${id}`);
            alert('Workspace deleted successfully');
            router.push('/dashboard/research');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete workspace');
        }
    };

    if (loading) {
        return (
            <div className="flex h-full min-h-[60vh] items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
            </div>
        );
    }
    if (!project) return <div className="p-12 text-center text-red-500 font-bold bg-white">Project Not Found</div>;

    const domainName = project.domain?.split('|')?.[0] || 'General Research';

    return (
        <div className="h-[calc(100vh-90px)] flex flex-col space-y-6 animate-in fade-in duration-500 bg-white p-4 rounded-2xl">
            {/* Top Workspace Header (Vibrant NOUN Green #006533 bar) */}
            <div 
                style={{ backgroundColor: '#006533', color: '#ffffff' }}
                className="relative overflow-hidden rounded-2xl text-white px-8 py-5 border border-emerald-800 shadow-md flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
                <div className="relative z-10 space-y-1">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/research" className="p-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg transition-colors border border-emerald-500">
                            <ArrowLeft size={15} />
                        </Link>
                        <span className="bg-emerald-700/90 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-500 shadow-sm">
                            {domainName}
                        </span>
                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border shadow-sm ${
                            project.status === 'COMPLETED' ? 'bg-emerald-400 text-emerald-950 border-emerald-300' : 'bg-emerald-700/90 text-white border-emerald-500'
                        }`}>
                            Status: {project.status || 'DRAFT'}
                        </span>
                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border shadow-sm ${
                            (project.members?.length || 0) <= 1 ? 'bg-emerald-800/80 text-emerald-200 border-emerald-700' : 'bg-emerald-700/95 text-white border-emerald-500'
                        }`}>
                            {(project.members?.length || 0) <= 1 ? 'Solo Workspace' : 'Collaborative Workspace'}
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-white mt-1.5 tracking-tight">{project.title}</h1>
                </div>

                {/* Workspace Action Toolbar */}
                <div className="relative z-10 flex items-center flex-wrap gap-2">
                    {/* Invite Peer */}
                    <button 
                        onClick={() => setShowInviteModal(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md transition duration-150 border border-emerald-400"
                        title="Invite Peer Researcher"
                    >
                        <UserPlus size={14} />
                        <span>Invite Peer</span>
                    </button>

                    {/* Edit Workspace */}
                    <button 
                        onClick={() => setShowEditModal(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700/90 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md transition duration-150 border border-emerald-500"
                        title="Edit Workspace Title & Synopsis"
                    >
                        <Edit3 size={14} />
                        <span>Edit</span>
                    </button>

                    {/* Mark as Complete */}
                    <button 
                        onClick={handleToggleStatus}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition duration-150 border ${
                            project.status === 'COMPLETED'
                                ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 border-amber-300'
                                : 'bg-teal-500 hover:bg-teal-600 text-white border-teal-400'
                        }`}
                        title="Mark Workspace Status"
                    >
                        <CheckCircle2 size={14} />
                        <span>{project.status === 'COMPLETED' ? 'Reopen Project' : 'Mark Complete'}</span>
                    </button>

                    {/* Delete Workspace */}
                    <button 
                        onClick={handleDeleteWorkspace}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition duration-150 border border-red-500"
                        title="Delete Workspace Permanently"
                    >
                        <Trash2 size={14} />
                        <span>Delete</span>
                    </button>
                </div>
            </div>

            {/* Bottom 3-Column Split View */}
            <div className="flex-1 flex gap-6 min-h-0">
                
                {/* COLUMN 1: Files & Team (Width: 25%) */}
                <div className="w-1/4 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col min-h-0 overflow-hidden">
                    {/* Abstract Header */}
                    <div className="p-5 border-b border-gray-200 bg-emerald-50/50 flex-shrink-0 flex justify-between items-start gap-2">
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Project Synopsis</h4>
                            <p className="text-xs text-gray-700 leading-relaxed line-clamp-4" title={project.abstract}>
                                {project.abstract || 'No project description loaded.'}
                            </p>
                        </div>
                        <button onClick={() => setShowEditModal(true)} className="p-1 text-gray-400 hover:text-emerald-700">
                            <Edit3 size={13} />
                        </button>
                    </div>

                    {/* Scrollable Members & Files */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-white">
                        {/* Team Section */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-xs text-gray-500 uppercase tracking-wider flex items-center">
                                    <Users size={14} className="mr-1.5 text-emerald-700" /> Core Team ({project.members?.length || 0})
                                </h3>
                                <button onClick={() => setShowInviteModal(true)} className="p-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                                    <UserPlus size={12} /> Invite
                                </button>
                            </div>
                            <div className="space-y-2.5">
                                {project.members?.map((m: any) => {
                                    const name = m.staff ? `${m.staff.surname} ${m.staff.otherNames}` : 'Staff Member';
                                    const isOwner = m.role === 'OWNER';
                                    return (
                                        <div key={m.id} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-gray-50 transition group">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold border border-emerald-200 shadow-sm flex-shrink-0">
                                                    {m.staff?.surname?.[0] || 'U'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-800 truncate" title={name}>
                                                        {name}
                                                    </p>
                                                    <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">{m.role}</p>
                                                </div>
                                            </div>
                                            {!isOwner && (
                                                <button
                                                    onClick={() => handleRemoveMember(m.id, name)}
                                                    className="p-1 text-gray-300 hover:text-red-600 rounded transition opacity-0 group-hover:opacity-100"
                                                    title="Uninvite / Remove Collaborator"
                                                >
                                                    <UserX size={14} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Drive / Assets Section */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-xs text-gray-500 uppercase tracking-wider flex items-center">
                                    <FileText size={14} className="mr-1.5 text-emerald-700" /> Shared Drive
                                </h3>
                                <label className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg cursor-pointer transition border border-emerald-200">
                                    <FileUp size={14} />
                                    <input type="file" className="hidden" onChange={handleFileUpload} />
                                </label>
                            </div>
                            
                            {project.files?.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">No project files uploaded yet.</p>
                            ) : (
                                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                    {project.files?.map((f: any) => (
                                        <div key={f.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition duration-150">
                                            <span className="text-xs text-gray-700 truncate w-36 font-semibold" title={f.fileName}>
                                                {f.fileName}
                                            </span>
                                            <a href={f.fileUrl} target="_blank" rel="noreferrer" className="p-1 text-gray-400 hover:text-emerald-700 transition">
                                                <Download size={13} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* COLUMN 2: Editor (Width: 50% - MS Word Style White Canvas) */}
                <div className="w-2/4 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col min-h-0 overflow-hidden">
                    <CollaborativeEditor 
                        projectId={id as string} 
                        currentUserId={currentUser?.id || ''}
                        currentUserName={currentUser?.name || currentUser?.surname || currentUser?.email || 'Collaborator'}
                        projectTitle={project.title}
                        isSolo={(project.members?.length || 0) <= 1}
                    />
                </div>

                {/* COLUMN 3: Real-Time Team Chat (Width: 25%) */}
                <div className="w-1/4 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col min-h-0 overflow-hidden">
                    <ProjectChat 
                        key={id as string}
                        projectId={id as string} 
                        currentUserId={currentUser?.id || ''} 
                        currentUserName={currentUser?.name || currentUser?.surname || currentUser?.email || 'Collaborator'}
                        initialMessages={project.messages}
                        isSolo={(project.members?.length || 0) <= 1}
                    />
                </div>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-350">
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm space-y-4 animate-in scale-in-95 duration-200">
                        <div className="space-y-1">
                            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                <Sparkles size={18} className="text-emerald-700" />
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
                                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-white text-gray-800 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none"
                                >
                                    <option value="">Select staff member...</option>
                                    {allStaff.map(s => (
                                        <option key={s.userId} value={s.userId}>
                                            {s.surname} {s.otherNames} ({s.cadre})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
                                <button type="button" onClick={() => setShowInviteModal(false)} className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition">Cancel</button>
                                <button type="submit" style={{ backgroundColor: '#006533', color: '#ffffff' }} className="px-4 py-2 text-white text-xs font-bold rounded-xl shadow-sm transition hover:opacity-90">Send Invite</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Workspace Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-350">
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md space-y-4 animate-in scale-in-95 duration-200">
                        <div className="space-y-1">
                            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                <Edit3 size={18} className="text-emerald-700" />
                                Edit Workspace Details
                            </h2>
                            <p className="text-xs text-gray-500">Update research project title and abstract synopsis.</p>
                        </div>
                        
                        <form onSubmit={handleEditWorkspace} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Project Title</label>
                                <input 
                                    type="text"
                                    required
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Project Synopsis / Abstract</label>
                                <textarea 
                                    rows={4}
                                    value={editAbstract}
                                    onChange={(e) => setEditAbstract(e.target.value)}
                                    placeholder="Enter abstract..."
                                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-gray-900"
                                />
                            </div>
                            
                            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                                <button type="button" onClick={() => setShowEditModal(false)} className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition">Cancel</button>
                                <button type="submit" style={{ backgroundColor: '#006533', color: '#ffffff' }} className="px-4 py-2 text-white text-xs font-bold rounded-xl shadow-sm transition hover:opacity-90">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
