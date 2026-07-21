"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import api from '@/lib/api';
import { Save, Loader2, CheckCircle2, AlertCircle, Bold, Italic, List, ListOrdered, Heading2, Heading3, Quote, Undo, Redo } from 'lucide-react';

interface RichTextEditorProps {
    projectId: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function RichTextEditor({ projectId }: RichTextEditorProps) {
    const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const editor = useEditor({
        extensions: [StarterKit.configure({})],
        editorProps: {
            attributes: {
                class: 'prose max-w-none focus:outline-none min-h-[700px] p-12 text-gray-900 leading-relaxed bg-white',
                style: 'background-color: #ffffff !important; color: #111827 !important;',
            },
        },
        onUpdate: ({ editor }) => {
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
            autoSaveTimer.current = setTimeout(() => {
                handleSave(editor.getHTML());
            }, 2000);
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
        };
    }, [editor, projectId]);

    const handleSave = useCallback(async (html?: string) => {
        if (!editor) return;
        const contentHtml = html ?? editor.getHTML();
        setSaveStatus('saving');
        try {
            const res = await api.put(`/api/research/${projectId}/document`, { contentHtml });
            setLastSaved(new Date(res.data.updatedAt).toLocaleTimeString());
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (err) {
            console.error('Failed to save document:', err);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 4000);
        }
    }, [editor, projectId]);

    if (loadStatus === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-[500px] gap-3 text-gray-500 bg-white">
                <Loader2 className="animate-spin text-emerald-700" size={22} />
                <span className="text-sm font-medium">Loading Microsoft Word document surface…</span>
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

    return (
        <div className="flex flex-col h-full w-full bg-gray-100 border border-gray-200 overflow-hidden">
            {/* MS Word Toolbar */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-gray-50 flex-wrap">
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

                {/* Spacer + Save button */}
                <div className="ml-auto flex items-center gap-3">
                    {lastSaved && saveStatus === 'idle' && (
                        <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">
                            Saved at {lastSaved}
                        </span>
                    )}
                    {saveStatus === 'saving' && (
                        <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                            <Loader2 size={12} className="animate-spin" /> Saving…
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
                        title="Save (Ctrl+S)"
                    >
                        <Save size={13} />
                        Save
                    </button>
                </div>
            </div>

            {/* Microsoft Word Page Container (Pure White Paper Sheet #ffffff) */}
            <div className="flex-grow overflow-auto p-6 bg-gray-200/60 flex justify-center">
                <div 
                    style={{ backgroundColor: '#ffffff', color: '#111827' }}
                    className="w-full max-w-4xl border border-gray-300 shadow-md min-h-[750px] my-2 rounded-sm p-1"
                >
                    <EditorContent editor={editor} className="h-full bg-white text-gray-900" />
                </div>
            </div>

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
