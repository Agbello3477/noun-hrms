"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import api from '@/lib/api';
import { 
    Save, Loader2, CheckCircle2, AlertCircle, Bold, Italic, List, ListOrdered, 
    Heading2, Heading3, Quote, Undo, Redo, Edit3, BookOpen, Bookmark, 
    Sigma, FileDown, Plus, X, AlignLeft, Check
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface RichTextEditorProps {
    projectId: string;
    currentUserName?: string;
    currentUserId?: string;
    projectTitle?: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function RichTextEditor({ projectId, currentUserName, currentUserId, projectTitle }: RichTextEditorProps) {
    const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const [lastContributor, setLastContributor] = useState<string | null>(null);
    const [activeEditors, setActiveEditors] = useState<Record<string, string>>({});
    
    // Modern Modals State
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showCitationModal, setShowCitationModal] = useState(false);
    const [showFormulaModal, setShowFormulaModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);

    // Citation parameters
    const [citationStyle, setCitationStyle] = useState<'APA' | 'IEEE' | 'MLA' | 'Vancouver'>('APA');
    const [citationAuthor, setCitationAuthor] = useState('');
    const [citationTitle, setCitationTitle] = useState('');
    const [citationYear, setCitationYear] = useState('');
    const [citationJournal, setCitationJournal] = useState('');
    const [citationDoi, setCitationDoi] = useState('');
    const [bibtexString, setBibtexString] = useState('');
    const [citationsList, setCitationsList] = useState<Array<{
        id: string;
        author: string;
        title: string;
        year: string;
        journal: string;
        doi: string;
    }>>([]);

    // Formula parameter
    const [latexFormula, setLatexFormula] = useState('');

    // Export parameter
    const [doubleSpaced, setDoubleSpaced] = useState(false);
    const [exporting, setExporting] = useState(false);
    
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const docTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const socketRef = useRef<Socket | null>(null);

    // Socket.io Connection for Document Collaboration Events
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5055';
        const socket = io(rawBaseUrl, {
            auth: { token },
            withCredentials: true
        });

        socket.on('connect', () => {
            socket.emit('join-project', projectId);
        });

        // Real-Time Document Editing Listeners
        socket.on('user-doc-editing', (data: { userId: string; userName: string }) => {
            if (data.userId !== currentUserId) {
                setActiveEditors(prev => ({ ...prev, [data.userId]: data.userName }));
            }
        });

        socket.on('user-doc-stop-editing', (data: { userId: string }) => {
            setActiveEditors(prev => {
                const updated = { ...prev };
                delete updated[data.userId];
                return updated;
            });
        });

        socket.on('user-doc-saved', (data: { userId: string; userName: string; timestamp: string }) => {
            setLastContributor(data.userName);
            setLastSaved(data.timestamp);
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, [projectId, currentUserId]);

    const handleDocTyping = useCallback(() => {
        if (!socketRef.current) return;

        socketRef.current.emit('doc-editing', {
            projectId,
            userName: currentUserName || 'Collaborator'
        });

        if (docTypingTimer.current) clearTimeout(docTypingTimer.current);
        docTypingTimer.current = setTimeout(() => {
            if (socketRef.current) {
                socketRef.current.emit('doc-stop-editing', { projectId });
            }
        }, 2500);
    }, [projectId, currentUserName]);

    const handleSave = useCallback(async (html?: string) => {
        if (!editor) return;
        const contentHtml = html ?? editor.getHTML();
        setSaveStatus('saving');
        try {
            const res = await api.put(`/api/research/${projectId}/document`, { contentHtml });
            const savedTime = new Date(res.data.updatedAt).toLocaleTimeString();
            setLastSaved(savedTime);
            setSaveStatus('saved');

            if (socketRef.current) {
                socketRef.current.emit('doc-saved', {
                    projectId,
                    userName: currentUserName || 'Collaborator',
                    timestamp: savedTime
                });
            }

            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (err) {
            console.error('Failed to save document:', err);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 4000);
        }
    }, [projectId, currentUserName]);

    const editor = useEditor({
        extensions: [StarterKit.configure({})],
        editorProps: {
            attributes: {
                class: 'prose max-w-none focus:outline-none min-h-[700px] p-12 text-gray-900 leading-relaxed bg-white',
                style: 'background-color: #ffffff !important; color: #111827 !important;',
            },
        },
        onUpdate: ({ editor }) => {
            handleDocTyping();

            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
            autoSaveTimer.current = setTimeout(() => {
                handleSave(editor.getHTML());
            }, 2500);
        },
    });

    useEffect(() => {
        if (!editor) return;

        api.get(`/api/research/${projectId}/document`)
            .then((res) => {
                const html = res.data.contentHtml || '';
                editor.commands.setContent(html);
                if (res.data.updatedAt) {
                    setLastSaved(new Date(res.data.updatedAt).toLocaleTimeString());
                }
                setLoadStatus('ready');
            })
            .catch((err) => {
                console.error('Failed to load document:', err);
                setLoadStatus('error');
            });

        return () => {
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
            if (docTypingTimer.current) clearTimeout(docTypingTimer.current);
        };
    }, [editor, projectId]);

    // Template Selection Handler
    const handleTemplateSelect = (templateId: string) => {
        if (!editor) return;
        if (!confirm("Are you sure you want to load this template? It will replace the current document content.")) return;

        let content = '';
        if (templateId === 'journal') {
            content = `
                <h2>[Research Title: Insert Scholarly Title Here]</h2>
                <p><strong>Abstract</strong> — This study outlines the research objectives, methodology, key findings, and academic contributions of our collaborative efforts.</p>
                <h2>1. Introduction</h2>
                <p>Enter introduction text here. Establish the research background, problem statement, and scope of study.</p>
                <h2>2. Literature Review</h2>
                <p>Analyze previous works, historic baselines, and current developments in the field.</p>
                <h2>3. Methodology</h2>
                <p>Detail the research design, data collection, sample population, and algorithms used.</p>
                <h2>4. Results & Discussion</h2>
                <p>Present data analytics, statistical tables, and discuss findings in relation to your hypotheses.</p>
                <h2>5. Conclusion</h2>
                <p>Summarize outcomes, limitations, and future research directions.</p>
            `;
        } else if (templateId === 'proposal') {
            content = `
                <h2>Institutional Grant / Funding Proposal</h2>
                <p><strong>Executive Summary:</strong> Provide a concise overview of the proposed project, target goals, budget, and impact.</p>
                <h2>1. Statement of Need</h2>
                <p>Describe the specific institutional or societal challenge this project aims to solve.</p>
                <h2>2. Project Objectives</h2>
                <p>List clear, realistic, and time-bound project targets.</p>
                <h2>3. Work Plan & Timeline</h2>
                <p>Detail project phases, key coordinators, and execution schedule.</p>
                <h2>4. Budget Request & Justification</h2>
                <p>Detail requested funds, personnel costs, capital expenditure, and operational logistics.</p>
            `;
        } else if (templateId === 'ethics') {
            content = `
                <h2>Research Ethics Board (REB) Application Form</h2>
                <p><strong>Protocol Title:</strong> [Insert Title]</p>
                <p><strong>Principal Investigator:</strong> [Insert Name & Department]</p>
                <h2>1. Objective & Hypothesis</h2>
                <p>Outline the primary research questions, hypotheses, and clinical or social goals.</p>
                <h2>2. Participant Selection</h2>
                <p>Define study population, inclusion/exclusion criteria, and sample size justification.</p>
                <h2>3. Risks & Benefits Analysis</h2>
                <p>Evaluate potential physical, psychological, or social risks and lay out mitigation strategies.</p>
                <h2>4. Informed Consent Process</h2>
                <p>Detail how consent forms will be administered, signed, and stored.</p>
            `;
        } else if (templateId === 'thesis') {
            content = `
                <h2>Postgraduate Thesis Chapter Framework</h2>
                <h2>Chapter 1: Introduction</h2>
                <p><strong>1.1 Background of the Study</strong> — Introduce the broad domain and historical progress.</p>
                <p><strong>1.2 Problem Statement</strong> — Articulate the central challenge or knowledge gap.</p>
                <p><strong>1.3 Research Objectives</strong> — Define primary and secondary aims.</p>
                <p><strong>1.4 Significance of the Study</strong> — Outline theoretical and practical benefits.</p>
                <p><strong>1.5 Scope & Delimitations</strong> — Define study boundaries and assumptions.</p>
            `;
        }

        editor.commands.setContent(content);
        handleSave(content);
        setShowTemplateModal(false);
    };

    // BibTeX Metadata Parser
    const handleBibTeXPaste = (val: string) => {
        setBibtexString(val);
        try {
            const authorMatch = val.match(/author\s*=\s*[{"]([^}"]+)[}"]/i);
            const titleMatch = val.match(/title\s*=\s*[{"]([^}"]+)[}"]/i);
            const yearMatch = val.match(/year\s*=\s*[{"]([^}"]+)[}"]/i);
            const journalMatch = val.match(/(journal|booktitle)\s*=\s*[{"]([^}"]+)[}"]/i);
            const doiMatch = val.match(/doi\s*=\s*[{"]([^}"]+)[}"]/i);

            if (authorMatch) setCitationAuthor(authorMatch[1]);
            if (titleMatch) setCitationTitle(titleMatch[1]);
            if (yearMatch) setCitationYear(yearMatch[1]);
            if (journalMatch) setCitationJournal(journalMatch[2]);
            if (doiMatch) setCitationDoi(doiMatch[1]);
        } catch (e) {
            console.error('BibTeX parsing error:', e);
        }
    };

    // Dynamically compile & update References block
    const updateReferencesInDoc = useCallback((updatedCitations: typeof citationsList, style: typeof citationStyle) => {
        if (!editor) return;

        let refHtml = '<h2>References</h2>';
        if (updatedCitations.length === 0) {
            refHtml += '<p>No references added yet.</p>';
        } else {
            refHtml += '<ol>';
            updatedCitations.forEach((ref, index) => {
                const num = index + 1;
                const authorInitial = ref.author.split(',')[0] || ref.author;
                
                if (style === 'APA') {
                    refHtml += `<li>${ref.author} (${ref.year}). ${ref.title}. <em>${ref.journal || 'Journal'}</em>.${ref.doi ? ' https://doi.org/' + ref.doi : ''}</li>`;
                } else if (style === 'IEEE') {
                    refHtml += `<li>[${num}] ${ref.author}, "${ref.title}," <em>${ref.journal || 'Journal'}</em>, ${ref.year}.${ref.doi ? ' DOI: ' + ref.doi : ''}</li>`;
                } else if (style === 'MLA') {
                    refHtml += `<li>${ref.author}. "${ref.title}." <em>${ref.journal || 'Journal'}</em>, ${ref.year}.${ref.doi ? ' DOI: ' + ref.doi : ''}</li>`;
                } else {
                    refHtml += `<li>[${num}] ${authorInitial}. ${ref.title}. ${ref.journal || 'Journal'}. ${ref.year}.${ref.doi ? ' DOI: ' + ref.doi : ''}</li>`;
                }
            });
            refHtml += '</ol>';
        }

        const currentHtml = editor.getHTML();
        let newContent = '';
        const refIndex = currentHtml.indexOf('<h2>References</h2>');
        
        if (refIndex !== -1) {
            newContent = currentHtml.substring(0, refIndex) + refHtml;
        } else {
            newContent = currentHtml + '<br/>' + refHtml;
        }

        editor.commands.setContent(newContent);
        handleSave(newContent);
    }, [editor, handleSave]);

    // Insert citation at cursor position
    const handleCitationSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editor || !citationAuthor || !citationYear) return;

        const newRef = {
            id: 'cit-' + Date.now(),
            author: citationAuthor,
            title: citationTitle || 'Untitled Publication',
            year: citationYear,
            journal: citationJournal,
            doi: citationDoi
        };

        const newList = [...citationsList, newRef];
        setCitationsList(newList);

        let marker = '';
        if (citationStyle === 'APA') {
            const surname = citationAuthor.split(',')[0] || citationAuthor;
            marker = ` (${surname}, ${citationYear})`;
        } else if (citationStyle === 'IEEE' || citationStyle === 'Vancouver') {
            marker = ` [${newList.length}]`;
        } else if (citationStyle === 'MLA') {
            const surname = citationAuthor.split(',')[0] || citationAuthor;
            marker = ` (${surname})`;
        }

        editor.chain().focus().insertContent(marker).run();
        updateReferencesInDoc(newList, citationStyle);

        // Reset
        setCitationAuthor('');
        setCitationTitle('');
        setCitationYear('');
        setCitationJournal('');
        setCitationDoi('');
        setBibtexString('');
        setShowCitationModal(false);
    };

    // Insert LaTeX Equation block
    const handleInsertFormula = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editor || !latexFormula) return;

        const mathBlock = `<p class="math-block">$$\\text{ } ${latexFormula} \\text{ }$$</p>`;
        editor.chain().focus().insertContent(mathBlock).run();
        setLatexFormula('');
        setShowFormulaModal(false);
    };

    // Export triggers
    const triggerExport = async (format: 'pdf' | 'docx' | 'latex') => {
        setExporting(true);
        try {
            const token = localStorage.getItem('token');
            const endpoint = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5055'}/api/research/${projectId}/export?format=${format}&doubleSpaced=${doubleSpaced}`;
            
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const text = await response.json();
                throw new Error(text.message || 'Export compilation failed');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${(projectTitle || 'document').replace(/\s+/g, '_')}.${format === 'latex' ? 'tex' : format}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setShowExportModal(false);
        } catch (err: any) {
            alert(err.message || 'Failed to download document');
        } finally {
            setExporting(false);
        }
    };

    if (loadStatus === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-[500px] gap-3 text-gray-500 bg-white">
                <Loader2 className="animate-spin text-emerald-700" size={22} />
                <span className="text-sm font-medium">Loading collaborative document canvas…</span>
            </div>
        );
    }

    if (loadStatus === 'error') {
        return (
            <div className="flex items-center justify-center min-h-[500px] gap-3 text-red-500 bg-white">
                <AlertCircle size={22} />
                <span className="text-sm font-medium">Failed to load document. Please refresh.</span>
            </div>
        );
    }

    const editorNames = Object.values(activeEditors);

    return (
        <div className="flex flex-col h-full w-full bg-white border border-gray-200 overflow-hidden rounded-2xl relative">
            {/* MS Word Academic Enhanced Toolbar */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-emerald-50/50 flex-wrap">
                <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    active={editor?.isActive('bold')}
                    title="Bold"
                >
                    <Bold size={15} />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    active={editor?.isActive('italic')}
                    title="Italic"
                >
                    <Italic size={15} />
                </ToolbarButton>
                <div className="w-px h-5 bg-gray-300 mx-1" />
                <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                    active={editor?.isActive('heading', { level: 2 })}
                    title="Heading 2"
                >
                    <Heading2 size={15} />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                    active={editor?.isActive('heading', { level: 3 })}
                    title="Heading 3"
                >
                    <Heading3 size={15} />
                </ToolbarButton>
                <div className="w-px h-5 bg-gray-300 mx-1" />
                <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                    active={editor?.isActive('bulletList')}
                    title="Bullet List"
                >
                    <List size={15} />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                    active={editor?.isActive('orderedList')}
                    title="Numbered List"
                >
                    <ListOrdered size={15} />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                    active={editor?.isActive('blockquote')}
                    title="Blockquote"
                >
                    <Quote size={15} />
                </ToolbarButton>
                <div className="w-px h-5 bg-gray-300 mx-1" />
                <ToolbarButton
                    onClick={() => editor?.chain().focus().undo().run()}
                    active={false}
                    title="Undo"
                >
                    <Undo size={15} />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor?.chain().focus().redo().run()}
                    active={false}
                    title="Redo"
                >
                    <Redo size={15} />
                </ToolbarButton>

                <div className="w-px h-5 bg-gray-300 mx-1" />
                
                {/* Academic Template Library Button */}
                <button
                    onClick={() => setShowTemplateModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-white border border-emerald-200 rounded-lg text-emerald-800 hover:bg-emerald-50 transition"
                    title="Load Academic Template"
                >
                    <BookOpen size={13} />
                    Templates
                </button>

                {/* Academic Citation Engine Button */}
                <button
                    onClick={() => setShowCitationModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-white border border-emerald-200 rounded-lg text-emerald-800 hover:bg-emerald-50 transition"
                    title="Insert Scholarly Citation"
                >
                    <Bookmark size={13} />
                    Citation
                </button>

                {/* LaTeX Equation Editor Button */}
                <button
                    onClick={() => setShowFormulaModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-white border border-emerald-200 rounded-lg text-emerald-800 hover:bg-emerald-50 transition"
                    title="Insert LaTeX Formula"
                >
                    <Sigma size={13} />
                    Formula
                </button>

                {/* Export Options Button */}
                <button
                    onClick={() => setShowExportModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition shadow-sm ml-1"
                    title="Export in Academic Formats"
                >
                    <FileDown size={13} />
                    Export
                </button>

                {/* Spacer + Real-Time Editing & Save Status */}
                <div className="ml-auto flex items-center gap-3">
                    {editorNames.length > 0 && (
                        <span className="text-[11px] text-amber-900 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 animate-pulse shadow-sm">
                            <Edit3 size={12} className="text-amber-700 animate-spin" />
                            Editing by {editorNames.join(', ')}...
                        </span>
                    )}

                    {lastContributor && (
                        <span className="text-[11px] text-emerald-900 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full font-semibold hidden md:inline-block">
                            Edited by <span className="font-bold">{lastContributor}</span>
                        </span>
                    )}

                    {lastSaved && saveStatus === 'idle' && (
                        <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">
                            Saved at {lastSaved}
                        </span>
                    )}
                    {saveStatus === 'saving' && (
                        <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                            <Loader2 size={12} className="animate-spin" /> Saving...
                        </span>
                    )}
                    {saveStatus === 'saved' && (
                        <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Saved
                        </span>
                    )}
                    {saveStatus === 'error' && (
                        <span className="text-[11px] text-red-500 font-semibold flex items-center gap-1">
                            <AlertCircle size={12} /> Save failed
                        </span>
                    )}
                    <button
                        onClick={() => handleSave()}
                        disabled={saveStatus === 'saving'}
                        style={{ backgroundColor: '#006533', color: '#ffffff' }}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60 transition-colors shadow-sm hover:opacity-90"
                    >
                        <Save size={13} />
                        Save
                    </button>
                </div>
            </div>

            {/* Live Editing Alert Bar across top of document */}
            {editorNames.length > 0 && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-xs text-amber-900 font-bold flex items-center justify-between animate-in slide-in-from-top-1">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                        ✏️ {editorNames.join(', ')} is currently editing this document...
                    </span>
                    <span className="text-[10px] text-amber-700 font-medium">Live Collaboration Active</span>
                </div>
            )}

            {/* Document Workspace page canvas */}
            <div className="flex-grow overflow-auto p-6 bg-slate-100/70 flex justify-center">
                <div 
                    style={{ backgroundColor: '#ffffff', color: '#111827' }}
                    className="w-full max-w-4xl border border-gray-300 shadow-md min-h-[750px] my-2 rounded-sm p-1"
                >
                    <EditorContent editor={editor} className="h-full bg-white text-gray-900" />
                </div>
            </div>

            {/* MODAL 1: Academic Templates Selector */}
            {showTemplateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-150 animate-in zoom-in-95">
                        <div className="px-6 py-4 bg-emerald-800 text-white flex justify-between items-center">
                            <h3 className="font-bold text-sm tracking-wide">ACADEMIC TEMPLATES LIBRARY</h3>
                            <button onClick={() => setShowTemplateModal(false)} className="text-white/80 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
                            <TemplateOptionCard 
                                title="Standard Academic Journal Paper"
                                desc="Double-spaced framework structured in APA/IEEE layout with abstract, intro, methods, results and conclusion."
                                onClick={() => handleTemplateSelect('journal')}
                            />
                            <TemplateOptionCard 
                                title="Institutional / Grant Funding Proposal"
                                desc="Includes project summaries, institutional statements of need, budgets request details, and plans."
                                onClick={() => handleTemplateSelect('proposal')}
                            />
                            <TemplateOptionCard 
                                title="Research Ethics Board (REB) Application Form"
                                desc="Form templates with protocols, human subject consent workflows, and secure storage rules."
                                onClick={() => handleTemplateSelect('ethics')}
                            />
                            <TemplateOptionCard 
                                title="Postgraduate Thesis Chapter Framework"
                                desc="Introductory background, specific problem statement formulation, questions, and significance."
                                onClick={() => handleTemplateSelect('thesis')}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: Citation Manager Dialog */}
            {showCitationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-150 animate-in zoom-in-95">
                        <div className="px-6 py-4 bg-emerald-800 text-white flex justify-between items-center">
                            <h3 className="font-bold text-sm tracking-wide">SCHOLARLY CITATION ENGINE</h3>
                            <button onClick={() => setShowCitationModal(false)} className="text-white/80 hover:text-white"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleCitationSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Citation Style</label>
                                <select 
                                    value={citationStyle}
                                    onChange={e => setCitationStyle(e.target.value as any)}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
                                >
                                    <option value="APA">APA 7th Edition</option>
                                    <option value="IEEE">IEEE Reference Layout</option>
                                    <option value="MLA">MLA Format</option>
                                    <option value="Vancouver">Vancouver System</option>
                                </select>
                            </div>

                            <div className="border-t border-b border-gray-100 py-3 my-2">
                                <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Paste BibTeX String (Optional)</label>
                                <textarea
                                    className="w-full border border-gray-200 rounded-xl p-2 text-xs font-mono bg-gray-50 focus:bg-white"
                                    rows={3}
                                    placeholder="@article{key, author={...}, title={...}, year={...}}"
                                    value={bibtexString}
                                    onChange={e => handleBibTeXPaste(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Author(s)</label>
                                    <input 
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-emerald-600 outline-none"
                                        type="text" 
                                        placeholder="e.g. Doe, J."
                                        value={citationAuthor}
                                        onChange={e => setCitationAuthor(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Publication Year</label>
                                    <input 
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-emerald-600 outline-none"
                                        type="text" 
                                        placeholder="e.g. 2026"
                                        value={citationYear}
                                        onChange={e => setCitationYear(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Publication Title</label>
                                <input 
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-emerald-600 outline-none"
                                    type="text" 
                                    placeholder="e.g. Advances in deep learning"
                                    value={citationTitle}
                                    onChange={e => setCitationTitle(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Journal / Book Title</label>
                                    <input 
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-emerald-600 outline-none"
                                        type="text" 
                                        placeholder="e.g. Science Journal"
                                        value={citationJournal}
                                        onChange={e => setCitationJournal(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">DOI / URL</label>
                                    <input 
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-emerald-600 outline-none"
                                        type="text" 
                                        placeholder="e.g. 10.1000/xyz"
                                        value={citationDoi}
                                        onChange={e => setCitationDoi(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                style={{ backgroundColor: '#006533', color: '#ffffff' }}
                                className="w-full py-2.5 rounded-xl font-bold text-white text-xs hover:opacity-90 transition shadow-sm"
                            >
                                Insert Citation Reference
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: LaTeX Math Formula Dialog */}
            {showFormulaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-150 animate-in zoom-in-95">
                        <div className="px-6 py-4 bg-emerald-800 text-white flex justify-between items-center">
                            <h3 className="font-bold text-sm tracking-wide">LATEX MATHEMATICAL EQUATION</h3>
                            <button onClick={() => setShowFormulaModal(false)} className="text-white/80 hover:text-white"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleInsertFormula} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">LaTeX Notation</label>
                                <textarea
                                    className="w-full border border-gray-300 rounded-xl p-3 text-sm font-mono focus:border-emerald-600 outline-none bg-gray-50 focus:bg-white"
                                    rows={4}
                                    placeholder="e.g. x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
                                    value={latexFormula}
                                    onChange={e => setLatexFormula(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Math Visual Preview */}
                            {latexFormula && (
                                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Formula Visual Preview</span>
                                    <div className="text-center font-serif text-lg text-emerald-950 font-bold overflow-x-auto py-2">
                                        $${latexFormula}$$
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                style={{ backgroundColor: '#006533', color: '#ffffff' }}
                                className="w-full py-2.5 rounded-xl font-bold text-white text-xs hover:opacity-90 transition shadow-sm"
                            >
                                Insert Mathematical Block
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: Exporter Settings Dialog */}
            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-150 animate-in zoom-in-95">
                        <div className="px-6 py-4 bg-emerald-800 text-white flex justify-between items-center">
                            <h3 className="font-bold text-sm tracking-wide">EXPORT RESEARCH DOCUMENT</h3>
                            <button onClick={() => setShowExportModal(false)} className="text-white/80 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                                <div>
                                    <span className="block text-xs font-bold text-gray-800">Double-Spacing Rule</span>
                                    <span className="block text-[10px] text-gray-500">Apply formal academic line height formatting (2.0)</span>
                                </div>
                                <button
                                    onClick={() => setDoubleSpaced(!doubleSpaced)}
                                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center ${doubleSpaced ? 'bg-emerald-600' : 'bg-gray-300'}`}
                                >
                                    <span className={`w-4 h-4 rounded-full bg-white absolute transition-transform ${doubleSpaced ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-3 pt-2">
                                <button
                                    disabled={exporting}
                                    onClick={() => triggerExport('pdf')}
                                    className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 hover:border-emerald-600 rounded-xl hover:bg-emerald-50/20 transition disabled:opacity-50"
                                >
                                    <FileDown className="text-red-600" size={24} />
                                    <span className="text-xs font-bold text-gray-700">PDF File</span>
                                </button>
                                <button
                                    disabled={exporting}
                                    onClick={() => triggerExport('docx')}
                                    className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 hover:border-emerald-600 rounded-xl hover:bg-emerald-50/20 transition disabled:opacity-50"
                                >
                                    <FileDown className="text-blue-600" size={24} />
                                    <span className="text-xs font-bold text-gray-700">Word (.docx)</span>
                                </button>
                                <button
                                    disabled={exporting}
                                    onClick={() => triggerExport('latex')}
                                    className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 hover:border-emerald-600 rounded-xl hover:bg-emerald-50/20 transition disabled:opacity-50"
                                >
                                    <FileDown className="text-indigo-600" size={24} />
                                    <span className="text-xs font-bold text-gray-700">LaTeX (.tex)</span>
                                </button>
                            </div>

                            {exporting && (
                                <div className="text-center pt-2 text-xs font-semibold text-emerald-800 flex items-center justify-center gap-2">
                                    <Loader2 className="animate-spin" size={14} /> Compiling academic document...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .ProseMirror {
                    background-color: #ffffff !important;
                    color: #111827 !important;
                    min-height: 700px;
                    outline: none;
                }
                .ProseMirror p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: #9ca3af;
                    pointer-events: none;
                    height: 0;
                }
                .ProseMirror h2 { font-size: 1.4rem; font-weight: 700; margin: 1.2rem 0 0.5rem; color: #000000 !important; }
                .ProseMirror h3 { font-size: 1.15rem; font-weight: 600; margin: 1rem 0 0.4rem; color: #111827 !important; }
                .ProseMirror p { color: #111827 !important; margin-bottom: 1rem; line-height: 1.6; }
                .ProseMirror ul { list-style: disc; padding-left: 1.5rem; color: #111827 !important; }
                .ProseMirror ol { list-style: decimal; padding-left: 1.5rem; color: #111827 !important; }
                .ProseMirror blockquote { border-left: 4px solid #006533; padding-left: 1rem; color: #374151 !important; font-style: italic; margin: 0.8rem 0; }
                .ProseMirror strong { font-weight: 700; color: #000000 !important; }
                .ProseMirror em { font-style: italic; color: #111827 !important; }
                
                /* Custom Math block rendering on tip tap canvas */
                .math-block {
                    text-align: center;
                    background-color: #f0fdf4;
                    border: 1px solid #b7ebc6;
                    border-radius: 8px;
                    padding: 12px;
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: bold;
                    color: #1b5e20;
                    margin: 1.5rem 0;
                }
            `}} />
        </div>
    );
}

function ToolbarButton({
    onClick,
    active,
    title,
    children,
}: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`p-1.5 rounded-md transition-colors ${
                active
                    ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300'
                    : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
            }`}
        >
            {children}
        </button>
    );
}

function TemplateOptionCard({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-emerald-600 bg-white hover:bg-emerald-50/10 transition flex justify-between items-center group"
        >
            <div className="pr-4">
                <span className="block text-xs font-bold text-gray-800 group-hover:text-emerald-900">{title}</span>
                <span className="block text-[11px] text-gray-500 mt-1">{desc}</span>
            </div>
            <Plus className="text-gray-400 group-hover:text-emerald-700 flex-shrink-0" size={18} />
        </button>
    );
}
