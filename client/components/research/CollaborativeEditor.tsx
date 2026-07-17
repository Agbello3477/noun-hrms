"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

interface CollaborativeEditorProps {
    projectId: string;
    userName: string;
    userColor?: string;
}

const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#ec4899'];
const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];

interface ReadyEditorProps {
    ydoc: Y.Doc;
    provider: WebsocketProvider;
    userName: string;
    userColor: string;
}

/**
 * Inner editor — rendered ONLY when ydoc + provider are both ready.
 *
 * Wrapped in React.memo with a constant comparator so it NEVER re-renders
 * due to a parent state change (e.g., status update). This prevents TipTap
 * from calling reconfigure() on an already-running collaborative editor,
 * which causes the "Cannot read properties of undefined (reading 'doc')" crash.
 *
 * Extensions are also memoized so even if the component did re-render,
 * TipTap would see the same array reference and skip reconfiguration.
 */
const ReadyEditor = React.memo(
    function ReadyEditor({ ydoc, provider, userName, userColor }: ReadyEditorProps) {
        // Memoize with empty deps — ydoc and provider are stable for the
        // entire lifetime of this component (it unmounts when session resets).
        const extensions = useMemo(
            () => [
                StarterKit.configure({}),
                Collaboration.configure({
                    document: ydoc,
                }),
                CollaborationCursor.configure({
                    provider,
                    user: {
                        name: userName,
                        color: userColor,
                    },
                }),
            ],
            [] // eslint-disable-line react-hooks/exhaustive-deps
        );

        const editor = useEditor({
            extensions,
            editorProps: {
                attributes: {
                    class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-8 bg-white dark:bg-gray-900 rounded-xl shadow border border-gray-100 dark:border-gray-800',
                },
            },
        });

        return <EditorContent editor={editor} />;
    },
    // Custom comparator — always return true (never re-render from parent).
    // ReadyEditor is only replaced when the parent swaps it out entirely
    // (by unmounting via session → null → new session).
    () => true
);

ReadyEditor.displayName = 'ReadyEditor';

/**
 * Status indicator — kept in a separate component so its re-renders
 * don't propagate into ReadyEditor.
 */
function ConnectionBadge({ status }: { status: string }) {
    return (
        <div className="flex items-center space-x-2 text-sm">
            <span
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                    status === 'connected' ? 'bg-green-500' : 'bg-amber-400'
                }`}
            />
            <span className="text-gray-500 capitalize">{status}</span>
        </div>
    );
}

/**
 * Outer shell — manages WebSocket lifecycle.
 * Does NOT pass any changing state into ReadyEditor after it mounts.
 */
export default function CollaborativeEditor({
    projectId,
    userName,
    userColor,
}: CollaborativeEditorProps) {
    // Stable color ref — computed once per component instance, never changes
    const colorRef = useRef(userColor ?? getRandomColor());

    const [status, setStatus] = useState('connecting');
    const [session, setSession] = useState<{
        ydoc: Y.Doc;
        provider: WebsocketProvider;
    } | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const ydoc = new Y.Doc();
        const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5055';
        const wsBaseUrl = rawBaseUrl.replace(/^http/, 'ws');

        const wsProvider = new WebsocketProvider(
            wsBaseUrl,
            `/api/collaboration/doc?projectId=${projectId}&token=${token}`,
            ydoc
        );

        wsProvider.on('status', (event: { status: string }) => {
            setStatus(event.status);
        });

        setSession({ ydoc, provider: wsProvider });

        return () => {
            wsProvider.disconnect();
            ydoc.destroy();
            setSession(null);
            setStatus('connecting');
        };
    }, [projectId]);

    return (
        <div className="flex flex-col h-full w-full">
            <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-xl font-bold">Research Document</h2>
                <ConnectionBadge status={status} />
            </div>

            <div className="flex-grow overflow-auto editor-container">
                {session ? (
                    <ReadyEditor
                        ydoc={session.ydoc}
                        provider={session.provider}
                        userName={userName}
                        userColor={colorRef.current}
                    />
                ) : (
                    <div className="flex items-center justify-center min-h-[500px] text-gray-400 text-sm">
                        Connecting to collaboration server…
                    </div>
                )}
            </div>

            <style jsx global>{`
                .collaboration-cursor__caret {
                    border-left: 2px solid #000;
                    border-right: 2px solid #000;
                    margin-left: -2px;
                    margin-right: -2px;
                    pointer-events: none;
                    position: relative;
                    word-break: normal;
                }
                .collaboration-cursor__label {
                    border-radius: 4px 4px 4px 0;
                    color: #fff;
                    font-size: 12px;
                    font-weight: 600;
                    left: -2px;
                    line-height: normal;
                    padding: 2px 6px;
                    position: absolute;
                    top: -1.5em;
                    user-select: none;
                    white-space: nowrap;
                }
            `}</style>
        </div>
    );
}
