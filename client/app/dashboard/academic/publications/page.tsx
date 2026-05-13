'use client';

import { useState, useEffect } from 'react';
import api from '../../../../lib/api';
import { BookOpen, Plus, Trash2, Link as LinkIcon, Calendar } from 'lucide-react';

export default function PublicationsPage() {
    const [publications, setPublications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form Inputs
    const [title, setTitle] = useState('');
    const [citation, setCitation] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [link, setLink] = useState('');
    const [type, setType] = useState('ARTICLE');

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchPublications();
    }, []);

    const fetchPublications = async () => {
        try {
            const { data } = await api.get('/api/academic/publications');
            setPublications(data);
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this publication?')) return;
        try {
            await api.delete(`/api/academic/publications/${id}`);
            setPublications(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            alert('Failed to delete');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { data } = await api.post('/api/academic/publications', {
                title, citation, year, link, type
            });
            setPublications([data, ...publications]);
            setShowForm(false);
            // Reset
            setTitle('');
            setCitation('');
            setLink('');
        } catch (error) {
            alert('Failed to save publication');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading publications...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <BookOpen size={24} className="text-blue-600" />
                        Research Publications
                    </h1>
                    <p className="text-sm text-gray-500">Track your academic output and contributions.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus size={18} />
                    Add New
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-blue-100 mb-6">
                    <h3 className="font-semibold text-gray-800 mb-4">Add New Publication</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Title of Work</label>
                            <input type="text" required className="w-full p-2 border rounded"
                                value={title} onChange={e => setTitle(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Type</label>
                                <select className="w-full p-2 border rounded"
                                    value={type} onChange={e => setType(e.target.value)}>
                                    <option value="ARTICLE">Journal Article</option>
                                    <option value="BOOK">Book / Chapter</option>
                                    <option value="CONFERENCE">Conference Paper</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Year</label>
                                <input type="number" required className="w-full p-2 border rounded"
                                    value={year} onChange={e => setYear(Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Citation (APA/MLA)</label>
                            <textarea className="w-full p-2 border rounded" rows={2}
                                value={citation} onChange={e => setCitation(e.target.value)}></textarea>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">DOI / Link</label>
                            <input type="url" className="w-full p-2 border rounded"
                                value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." />
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                                {submitting ? 'Saving...' : 'Save Record'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid gap-4">
                {publications.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300 text-gray-500">
                        No publications recorded yet.
                    </div>
                ) : (
                    publications.map((pub) => (
                        <div key={pub.id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${pub.type === 'ARTICLE' ? 'bg-purple-100 text-purple-700' :
                                                pub.type === 'BOOK' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {pub.type}
                                        </span>
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Calendar size={12} /> {pub.year}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-lg leading-tight">{pub.title}</h3>
                                    <p className="text-gray-600 mt-2 text-sm italic">{pub.citation}</p>
                                    {pub.link && (
                                        <a href={pub.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 text-sm mt-2 hover:underline">
                                            <LinkIcon size={14} /> View Source
                                        </a>
                                    )}
                                </div>
                                <button onClick={() => handleDelete(pub.id)} className="text-gray-400 hover:text-red-500 p-2">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
