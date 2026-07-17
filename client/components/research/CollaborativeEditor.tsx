"use client";

import React, { useEffect, useState, useRef } from 'react';
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

export default function CollaborativeEditor({ projectId, userName, userColor = getRandomColor() }: CollaborativeEditorProps) {
    const [status, setStatus] = useState('connecting');
    // Key fix: store provider in state so editor re-mounts when provider is ready
    const [provider, setProvider] = useState<WebsocketProvider | null>(null);
    const ydocRef = useRef<Y.Doc>(new Y.Doc());

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5055';
        const wsBaseUrl = rawBaseUrl.replace(/^http/, 'ws');

        const wsProvider = new WebsocketProvider(
            wsBaseUrl,
            `/api/collaboration/doc?projectId=${projectId}&token=${token}`,
            ydocRef.current
        );

        wsProvider.on('status', (event: { status: string }) => {
            setStatus(event.status);
        });

        // Set provider in state — this triggers editor to mount with a valid reference
        setProvider(wsProvider);

        return () => {
            wsProvider.disconnect();
            setProvider(null);
            ydocRef.current.destroy();
            ydocRef.current = new Y.Doc();
        };
    }, [projectId]);

    const editor = useEditor(
        {
            extensions: [
                StarterKit.configure({
                    // History is handled by Yjs
                    history: false,
                }),
                Collaboration.configure({
                    document: ydocRef.current,
                }),
                // Only mount the cursor extension when the provider is ready (non-null)
                ...(provider
                    ? [
                          CollaborationCursor.configure({
                              provider,
                              user: {
                                  name: userName,
                                  color: userColor,
                              },
                          }),
                      ]
                    : []),
            ],
            editorProps: {
                attributes: {
                    class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-8 bg-white dark:bg-gray-900 rounded-xl shadow border border-gray-100 dark:border-gray-800',
                },
            },
        },
        // Re-create the editor when the provider changes from null → ready
        [provider]
    );

    return (
        <div className="flex flex-col h-full w-full">
            <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-xl font-bold">Research Document</h2>
                <div className="flex items-center space-x-2 text-sm">
                    <span
                        className={`w-2 h-2 rounded-full ${
                            status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                    ></span>
                    <span className="text-gray-500 capitalize">{status}</span>
                </div>
            </div>

            <div className="flex-grow overflow-auto editor-container">
                {provider ? (
                    <EditorContent editor={editor} />
                ) : (
                    <div className="flex items-center justify-center min-h-[500px] text-gray-400 text-sm">
                        Connecting to collaboration server...
                    </div>
                )}
            </div>

            {/* Injected CSS to handle remote cursors */}
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
