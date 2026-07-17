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
                class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-8 text-gray-855 dark:text-gray-150 leading-relaxed bg-white dark:bg-gray-900',
            },
        },
        onUpdate: ({ editor }) => {
            // Debounced auto-save: 2 seconds after the user stops typing
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
            autoSaveTimer.current = setTimeout(() => {
                handleSave(editor.getHTML());
            }, 2000);
        },
    });

    // Load saved content on mount
    useEffect(() => {
        if (!editor) return;

        api.get(`/api/research/${projectId}/document`)
            .then((res) => {
                const html = res.data.contentHtml || '';
                editor.commands.setContent(html); // Load the content into editor
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <div className="flex items-center justify-center min-h-[500px] gap-3 text-gray-400 dark:text-gray-500">
                <Loader2 className="animate-spin" size={22} />
                <span className="text-sm font-medium">Loading document…</span>
            </div>
        );
    }

    if (loadStatus === 'error') {
        return (
            <div className="flex items-center justify-center min-h-[500px] gap-3 text-red-400 dark:text-red-500">
                <AlertCircle size={22} />
                <span className="text-sm font-medium">Failed to load document. Please refresh.</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/70 flex-wrap">
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
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
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
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
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
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
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
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium hidden sm:inline">
                            Saved at {lastSaved}
                        </span>
                    )}
                    {saveStatus === 'saving' && (
                        <span className="text-[11px] text-blue-500 dark:text-blue-400 font-semibold flex items-center gap-1">
                            <Loader2 size={12} className="animate-spin" /> Saving…
                        </span>
                    )}
                    {saveStatus === 'saved' && (
                        <span className="text-[11px] text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Saved
                        </span>
                    )}
                    {saveStatus === 'error' && (
                        <span className="text-[11px] text-red-500 dark:text-red-400 font-semibold flex items-center gap-1">
                            <AlertCircle size={12} /> Save failed
                        </span>
                    )}
                    <button
                        onClick={() => handleSave()}
                        disabled={saveStatus === 'saving'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 dark:bg-blue-800 text-white text-xs font-bold hover:bg-blue-850 dark:hover:bg-blue-750 disabled:opacity-60 transition-colors shadow-sm"
                        title="Save (Ctrl+S)"
                    >
                        <Save size={13} />
                        Save
                    </button>
                </div>
            </div>

            {/* Editor area */}
            <div className="flex-grow overflow-auto">
                <EditorContent editor={editor} className="h-full" />
            </div>

            <style jsx global>{`
                .ProseMirror p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: #adb5bd;
                    pointer-events: none;
                    height: 0;
                }
                .ProseMirror h2 { font-size: 1.4rem; font-weight: 700; margin: 1.2rem 0 0.5rem; }
                .ProseMirror h3 { font-size: 1.15rem; font-weight: 600; margin: 1rem 0 0.4rem; }
                .ProseMirror ul { list-style: disc; padding-left: 1.5rem; }
                .ProseMirror ol { list-style: decimal; padding-left: 1.5rem; }
                .ProseMirror blockquote { border-left: 3px solid #d1d5db; padding-left: 1rem; color: #6b7280; font-style: italic; margin: 0.8rem 0; }
                .ProseMirror strong { font-weight: 700; }
                .ProseMirror em { font-style: italic; }
            `}</style>
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
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
        >
            {children}
        </button>
    );
}
