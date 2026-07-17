"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Send, User as UserIcon } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface Message {
    id: string;
    text: string;
    senderId: string;
    createdAt: string;
    sender: {
        name: string;
        staffProfile?: { passportUrl: string };
    };
}

interface ProjectChatProps {
    projectId: string;
    currentUserId: string;
    initialMessages?: Message[];
}

export default function ProjectChat({ projectId, currentUserId, initialMessages = [] }: ProjectChatProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState('');
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMessages(initialMessages);
    }, [initialMessages]);

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

        socket.on('new-message', (message: Message) => {
            setMessages(prev => {
                if (prev.find(m => m.id === message.id)) return prev;
                return [...prev, message];
            });
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, [projectId]);

    useEffect(() => {
        // Scroll to bottom when messages change
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !socketRef.current) return;

        // Emit to server
        socketRef.current.emit('send-message', {
            projectId,
            text: input.trim()
        });
        
        setInput('');
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-xl">
                <h3 className="font-semibold text-gray-800 dark:text-white">Workspace Chat</h3>
                <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
            </div>
            
            <div className="flex-grow p-4 overflow-y-auto space-y-4 max-h-[500px]">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                        <p>No messages yet.</p>
                        <p>Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMe = msg.senderId === currentUserId;
                        return (
                            <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex max-w-[80%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`flex-shrink-0 ${isMe ? 'ml-2' : 'mr-2'} mt-1`}>
                                        {msg.sender?.staffProfile?.passportUrl ? (
                                            <img src={msg.sender.staffProfile.passportUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover shadow" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow">
                                                <UserIcon size={16} />
                                            </div>
                                        )}
                                    </div>
                                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <span className="text-[10px] text-gray-500 mb-1">{isMe ? 'You' : (msg.sender?.name || 'Unknown User')}</span>
                                        <div className={`p-3 rounded-2xl shadow-sm text-sm ${
                                            isMe 
                                                ? 'bg-blue-600 text-white rounded-tr-sm' 
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white rounded-tl-sm'
                                        }`}>
                                            {msg.text}
                                        </div>
                                        <span className="text-[10px] text-gray-400 mt-1">
                                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-b-xl border-t border-gray-100 dark:border-gray-700">
                <form onSubmit={handleSend} className="flex space-x-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-grow p-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-full focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button 
                        type="submit"
                        disabled={!input.trim()}
                        className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}
